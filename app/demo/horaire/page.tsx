import { DemoCapture } from "@/app/demo/horaire/demo-capture";
import { VueCoupDoeil } from "@/components/horaire/vue-coup-doeil";
import { GRANDFORD_CYCLE } from "@/lib/engine";
import { type ReglagePaye, frequencePayeSchema } from "@/lib/schedule/payday";
import { todayCivil } from "@/lib/schedule/today";
import type { ScheduleException, SleepAdjustment, SleepWindow } from "@/lib/schedule/types";
import { dateCivileSchema, equipeSchema, heureSchema } from "@/lib/validation";
import { notFound } from "next/navigation";
import { z } from "zod";

// Démo de la vue « coup d'œil » SANS authentification — uniquement pour constater
// les preuves d'acceptation des Sprints 4-6 dans les environnements où GoTrue ne
// tourne pas (contrainte documentée depuis le Sprint 2 : Docker bloqué). N'expose que
// des données calculées (horaire déterministe public) ou factices, jamais une donnée
// réelle de foyer. Inaccessible sans GRANDFORD_DEMO=1 (jamais en prod).
//
//   /demo/horaire?equipe=A&date=2026-06-11            → pastille du travailleur
//   /demo/horaire?role=spouse&ecart=2026-06-12        → vue conjointe, écart factice
//   /demo/horaire?ot=2026-06-11&date=2026-06-11       → journée de temps supplémentaire (Sprint 29)
//   /demo/horaire?capture=1&date=2026-06-11           → flux de capture (Sprint 5),
//                                                       persistance en état local
//   …&sommeil=08:30-16:00                             → fenêtre configurée (FR-6)
//   …&sommeilActif=0                                  → interrupteur sommeil OFF (Sprint 19)
//   …&ajustement=2026-06-05@09:00-13:00               → ajustement d'UN jour (FR-6)
//   …&paye=2026-06-04@aux_2_semaines                  → jour de paye (Sprint 17, travailleur seul)
//   …&frigo=3                                         → pastille « notes non lues » (Sprint 26)
//   …&epicerie=2                                      → pastille « à acheter » épicerie (Sprint 27)

// 'HH:MM-HH:MM' → fenêtre, ex. : sommeil=08:30-16:00. Format STRICT : tout segment
// excédentaire est rejeté (jamais ignoré en silence), un seul découpage.
const fenetreParamSchema = z.string().transform((v, ctx): SleepWindow => {
  const [start = "", end = "", ...extra] = v.split("-");
  if (
    extra.length > 0 ||
    !heureSchema.safeParse(start).success ||
    !heureSchema.safeParse(end).success
  ) {
    ctx.addIssue({ code: "custom", message: "fenêtre attendue : HH:MM-HH:MM" });
    return z.NEVER;
  }
  return { start, end };
});

// 'YYYY-MM-DD@HH:MM-HH:MM' → ajustement daté, ex. : ajustement=2026-06-05@09:00-13:00.
const ajustementParamSchema = z.string().transform((v, ctx): SleepAdjustment => {
  const [date = "", fenetre = "", ...extra] = v.split("@");
  const window = fenetreParamSchema.safeParse(fenetre);
  if (extra.length > 0 || !dateCivileSchema.safeParse(date).success || !window.success) {
    ctx.addIssue({ code: "custom", message: "ajustement attendu : YYYY-MM-DD@HH:MM-HH:MM" });
    return z.NEVER;
  }
  return { onDate: date, window: window.data };
});

// 'YYYY-MM-DD@frequence' → réglage de paye, ex. : paye=2026-06-04@aux_2_semaines.
const payeParamSchema = z.string().transform((v, ctx): ReglagePaye => {
  const [date = "", frequence = "", ...extra] = v.split("@");
  const freq = frequencePayeSchema.safeParse(frequence);
  if (extra.length > 0 || !dateCivileSchema.safeParse(date).success || !freq.success) {
    ctx.addIssue({
      code: "custom",
      message: "paye attendue : YYYY-MM-DD@hebdomadaire|aux_2_semaines",
    });
    return z.NEVER;
  }
  return { anchorDate: date, frequence: freq.data };
});

const parametresSchema = z.object({
  equipe: equipeSchema.default("A"),
  date: dateCivileSchema.optional(),
  role: z.enum(["worker", "spouse"]).default("worker"),
  ecart: dateCivileSchema.optional(),
  // Journée de temps supplémentaire (Sprint 29) — démo seulement, pour constater le
  // marqueur OT (⚡). Injecte un écart `working_extra` ; visible des deux rôles (partageable).
  ot: dateCivileSchema.optional(),
  capture: z.literal("1").optional(),
  sommeil: fenetreParamSchema.optional(),
  // Interrupteur de la fenêtre de sommeil (Sprint 19) : '0' = désactivé, défaut activé.
  sommeilActif: z.enum(["0", "1"]).optional(),
  ajustement: ajustementParamSchema.optional(),
  paye: payeParamSchema.optional(),
  // Compte de notes du frigo non lues (Sprint 20) — démo seulement, pour constater la
  // pastille des tuiles de navigation (Sprint 26). Défaut 0 sans le param.
  frigo: z.coerce.number().int().min(0).optional(),
  // Compte d'articles d'épicerie « à acheter » (Sprint 27) — démo seulement, pour constater
  // la pastille de la tuile Épicerie. Défaut 0 sans le param.
  epicerie: z.coerce.number().int().min(0).optional(),
});

export default async function DemoHorairePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.GRANDFORD_DEMO !== "1") {
    notFound();
  }

  const lecture = parametresSchema.safeParse(await searchParams);
  if (!lecture.success) {
    notFound();
  }
  const params = lecture.data;
  if (params.capture === "1") {
    return (
      <DemoCapture
        team={params.equipe}
        initialToday={params.date ?? todayCivil()}
        sleepDefault={params.sommeil ?? null}
      />
    );
  }
  const ecarts: ScheduleException[] = [
    ...(params.ecart ? [{ onDate: params.ecart, effect: "off" as const, shift: null }] : []),
    ...(params.ot ? [{ onDate: params.ot, effect: "working_extra" as const, shift: null }] : []),
  ];

  return (
    <VueCoupDoeil
      role={params.role}
      team={params.equipe}
      template={GRANDFORD_CYCLE}
      exceptions={ecarts}
      sleepDefault={params.sommeil ?? null}
      sleepEnabled={params.sommeilActif !== "0"}
      sleepAdjustments={params.ajustement ? [params.ajustement] : []}
      initialToday={params.date ?? todayCivil()}
      workerName={params.role === "spouse" ? "Démo" : null}
      clockFrozen={params.date !== undefined}
      reglagePaye={params.paye ?? null}
      frigoNonLues={params.frigo ?? 0}
      epicerieARacheter={params.epicerie ?? 0}
    />
  );
}
