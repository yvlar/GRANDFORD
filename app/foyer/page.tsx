import { SelecteurEquipe } from "@/components/equipe/selecteur-equipe";
import { ActiverRappels } from "@/components/notifications/activer-rappels";
import { FenetreSommeil } from "@/components/sommeil/fenetre-sommeil";
import { BoutonSoumettre } from "@/components/ui/bouton-soumettre";
import { CLASSES_TUILE, ContenuTuile, TuileNav } from "@/components/ui/tuile-nav";
import { GRANDFORD_CYCLE } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import { signIcalToken } from "@/lib/ical/generate";
import { requestOrigin } from "@/lib/request-origin";
import { fetchActiveGabarit } from "@/lib/schedule/cycle-template";
import {
  parseAuditRows,
  parsePaydayRow,
  parseSleepEnabled,
  parseSleepRow,
} from "@/lib/schedule/db-rows";
import { FORMAT_DATE_COURTE, dateUTC } from "@/lib/schedule/format";
import { GABARITS_PREDEFINIS } from "@/lib/schedule/predefined-templates";
import { defaultSleepWindow } from "@/lib/schedule/status";
import { createClient } from "@/lib/supabase/server";
import { equipeSchema } from "@/lib/validation";
import { redirect } from "next/navigation";
import {
  annulerInvitation,
  changerGabarit,
  creerInvitation,
  definirReglagePaye,
  mettreAJourNom,
  quitterFoyer,
  revoquerMembre,
} from "./actions";

// Gestion du foyer (FR-12) : membres, invitation à usage unique, révocation.
// Tout ce que cette page voit passe par la RLS — les invitations, par exemple,
// ne reviennent que pour le propriétaire (0 ligne pour la conjointe).

// Carte de regroupement : réduit la charge cognitive d'une longue liste plate de
// réglages (anti-TDAH, NFR-12) en blocs thématiques avec une hiérarchie à 2 niveaux
// (titre de carte vs sous-titres internes).
function Carte({ titre, children }: { titre?: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={titre}
      className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
    >
      {titre ? <h2 className="text-lg font-bold text-neutral-100">{titre}</h2> : null}
      {children}
    </section>
  );
}

const ERREURS: Record<string, string> = {
  invitation: fr.foyer.erreurInvitation,
  revocation: fr.foyer.erreurRevocation,
  equipe: fr.equipe.erreur,
  sommeil: fr.sommeil.erreurEnregistrement,
  nom: fr.foyer.erreurNom,
  gabarit: fr.foyer.gabarit.erreur,
  paye: fr.paye.erreurEnregistrement,
};

export default async function FoyerPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const t = fr.foyer;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion?suivant=%2Ffoyer");
  }

  const { data: monAdhesion } = await supabase
    .from("memberships")
    .select("id, household_id, role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!monAdhesion) {
    redirect("/onboarding");
  }

  // L'équipe du travailleur (Sprint 4) et sa fenêtre de sommeil (Sprint 6, FR-6) :
  // affichées et modifiables ici. Requêtes jointes au Promise.all (moins
  // d'allers-retours sur le chemin chaud de la page).
  const affectationQuery =
    monAdhesion.role === "worker"
      ? supabase
          .from("worker_assignments")
          .select("team")
          .eq("household_id", monAdhesion.household_id)
          .eq("profile_id", user.id)
          .maybeSingle()
      : null;
  const sommeilQuery =
    monAdhesion.role === "worker"
      ? supabase
          .from("sleep_defaults")
          .select("start_time, end_time, enabled")
          .eq("household_id", monAdhesion.household_id)
          .eq("profile_id", user.id)
          .maybeSingle()
      : null;
  // Jour de paye (Sprint 17) : worker-private. Lu pour préremplir le formulaire ; la RLS
  // owner-only le réserve au travailleur (la conjointe n'a ni ce champ ni cet accès, R7).
  const payeQuery =
    monAdhesion.role === "worker"
      ? supabase
          .from("payday_settings")
          .select("anchor_date, frequence")
          .eq("household_id", monAdhesion.household_id)
          .eq("profile_id", user.id)
          .maybeSingle()
      : null;

  const [
    { data: foyer },
    { data: membres },
    { data: invitations },
    affectationRes,
    sommeilRes,
    { data: historiqueRaw },
    gabaritInfo,
    payeRes,
  ] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, owner_id")
      .eq("id", monAdhesion.household_id)
      .single(),
    supabase
      .from("memberships")
      .select("id, role, profile_id, profiles(full_name)")
      .eq("household_id", monAdhesion.household_id)
      .order("created_at"),
    supabase
      .from("invitations")
      .select("id, code")
      .eq("household_id", monAdhesion.household_id)
      .is("used_at", null)
      // Filtre d'affichage seulement (horloge du serveur Next) : l'expiration qui
      // fait foi est revérifiée en BD par redeem_invitation.
      .gt("expires_at", new Date().toISOString())
      .order("created_at"),
    affectationQuery,
    sommeilQuery,
    // FR-13 : 50 dernières entrées du journal — action + date de l'écart uniquement.
    // metadata.effect et metadata.shift stockés en BD mais jamais affichés (R7).
    // WHY entity="exception" : seul ce type est audité aujourd'hui ; élargir le filtre
    // si un 2e type est ajouté (ex. 'member_revoked').
    supabase
      .from("audit_log")
      .select("id, action, metadata, created_at")
      .eq("household_id", monAdhesion.household_id)
      .eq("entity", "exception")
      .order("created_at", { ascending: false })
      .limit(50),
    // FR-17 : gabarit actif du foyer — nom inclus pour affichage. Fallback NFR-4.
    fetchActiveGabarit(supabase, monAdhesion.household_id),
    payeQuery,
  ]);
  if (!foyer) {
    redirect("/onboarding");
  }
  if (affectationRes?.error) {
    throw affectationRes.error;
  }
  if (sommeilRes?.error) {
    throw sommeilRes.error;
  }
  if (payeRes?.error) {
    throw payeRes.error;
  }
  const monAffectation = affectationRes?.data ?? null;
  const maFenetre = parseSleepRow(sommeilRes?.data ?? null);
  const sommeilActif = parseSleepEnabled(sommeilRes?.data ?? null);
  const maPaye = parsePaydayRow(payeRes?.data ?? null);

  const historique = parseAuditRows(historiqueRaw ?? []);

  const template = gabaritInfo?.template ?? GRANDFORD_CYCLE;
  const gabaritNom = gabaritInfo?.name ?? GABARITS_PREDEFINIS[0].name;

  const estProprietaire = foyer.owner_id === user.id;
  const monMembre = (membres ?? []).find((m) => m.profile_id === user.id);
  const monNom = monMembre?.profiles?.full_name ?? null;
  const nomTravailleur =
    (membres ?? []).find((m) => m.role === "worker")?.profiles?.full_name ?? null;
  const origin = await requestOrigin();
  const params = await searchParams;
  const erreur = params.erreur ? ERREURS[params.erreur] : undefined;

  const icalSecret = process.env.ICAL_SECRET ?? null;
  const icalToken = icalSecret
    ? signIcalToken(monAdhesion.household_id, monAdhesion.role as "worker" | "spouse", icalSecret)
    : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-neutral-950 p-4 text-neutral-50 sm:p-6">
      {/* Navigation (NFR-12) : deux grandes tuiles contrastées plutôt que des liens textuels.
          Retour vers l'horaire à gauche (sans ce lien, un nouveau membre arrivé sur /foyer après
          l'onboarding n'a aucun chemin vers son horaire) ; déconnexion à droite — qui reste un
          <button> dans un <form> POST (une action qui change l'état n'est jamais un GET). */}
      <nav className="grid grid-cols-2 gap-3">
        <TuileNav href="/" icone="📅" libelle={t.monHoraire} />
        <form action="/auth/deconnexion" method="post" className="contents">
          <button type="submit" className={CLASSES_TUILE}>
            <ContenuTuile icone="🚪" libelle={t.seDeconnecter} />
          </button>
        </form>
      </nav>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{foyer.name}</h1>
      </header>

      {erreur ? (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-red-200">
          {erreur}
        </p>
      ) : null}

      <Carte titre={t.membres}>
        <ul className="flex flex-col gap-2">
          {(membres ?? []).map((membre) => (
            <li
              key={membre.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3"
            >
              <span className="flex flex-col">
                <span className="text-lg font-medium">
                  {membre.profiles?.full_name ?? t.sansNom}{" "}
                  {membre.profile_id === user.id ? (
                    <span className="text-sm text-neutral-400">{t.vous}</span>
                  ) : null}
                </span>
                <span className="text-sm text-neutral-400">
                  {membre.role === "worker" ? t.roleWorker : t.roleSpouse}
                </span>
              </span>
              {estProprietaire && membre.profile_id !== user.id ? (
                <form action={revoquerMembre.bind(null, membre.id)}>
                  <BoutonSoumettre variant="danger" className="px-3 text-sm">
                    {t.revoquer}
                  </BoutonSoumettre>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </Carte>

      {/* Section Travailleur : nom visible pour les deux rôles (travailleur = éditable,
          conjointe = lecture seule). Permet de saisir le nom quand OAuth ne l'a pas fourni. */}
      <Carte titre={t.roleWorker}>
        {monAdhesion.role === "worker" ? (
          <form action={mettreAJourNom} className="flex flex-col gap-2">
            <label htmlFor="nom" className="sr-only">
              {t.roleWorker}
            </label>
            <input
              id="nom"
              name="nom"
              type="text"
              defaultValue={monNom ?? ""}
              placeholder={t.nomPlaceholder}
              maxLength={120}
              className="min-h-11 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-base placeholder:text-neutral-500"
            />
            <BoutonSoumettre variant="secondaire" className="self-start">
              {t.enregistrerNom}
            </BoutonSoumettre>
          </form>
        ) : (
          <p className="text-lg font-semibold text-emerald-300">{nomTravailleur ?? t.sansNom}</p>
        )}
      </Carte>

      {/* Réglages de l'horaire (travailleur) : équipe + gabarit + sommeil regroupés. */}
      {monAdhesion.role === "worker" ? (
        <Carte titre={t.groupes.reglagesHoraire}>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-neutral-300">{fr.equipe.actuelle}</h3>
            <SelecteurEquipe
              householdId={monAdhesion.household_id}
              retour="/foyer"
              equipeActuelle={monAffectation ? equipeSchema.parse(monAffectation.team) : null}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-neutral-300">{fr.foyer.gabarit.titre}</h3>
            <p className="text-sm text-neutral-400">
              {fr.foyer.gabarit.actuel} :{" "}
              <span className="font-semibold text-emerald-300">{gabaritNom}</span>
            </p>
            <form action={changerGabarit.bind(null, foyer.id)} className="flex flex-col gap-2">
              <label htmlFor="gabaritNom" className="sr-only">
                {fr.foyer.gabarit.titre}
              </label>
              <select
                id="gabaritNom"
                name="gabaritNom"
                defaultValue={gabaritNom}
                className="min-h-11 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-base text-neutral-200"
              >
                {GABARITS_PREDEFINIS.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
              <BoutonSoumettre variant="secondaire" className="self-start">
                {fr.foyer.gabarit.confirmer}
              </BoutonSoumettre>
            </form>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-neutral-300">{fr.sommeil.titre}</h3>
            <FenetreSommeil
              householdId={monAdhesion.household_id}
              fenetreActuelle={maFenetre}
              fenetreProposee={defaultSleepWindow(template)}
              active={sommeilActif}
            />
          </div>
          {/* Jour de paye (Sprint 17) — worker-private : ce bloc n'existe que dans la branche
              travailleur ; la conjointe ne le voit jamais (R7). */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-neutral-300">{fr.paye.titre}</h3>
            <p className="text-sm text-neutral-400">{fr.paye.consigne}</p>
            <form
              action={definirReglagePaye.bind(null, monAdhesion.household_id)}
              className="flex flex-col gap-2"
            >
              <label htmlFor="anchorDate" className="text-sm text-neutral-300">
                {fr.paye.ancreLabel}
              </label>
              <input
                id="anchorDate"
                name="anchorDate"
                type="date"
                required
                defaultValue={maPaye?.anchorDate ?? ""}
                className="min-h-11 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-base text-neutral-200"
              />
              <label htmlFor="frequence" className="text-sm text-neutral-300">
                {fr.paye.frequenceLabel}
              </label>
              <select
                id="frequence"
                name="frequence"
                defaultValue={maPaye?.frequence ?? "aux_2_semaines"}
                className="min-h-11 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-base text-neutral-200"
              >
                <option value="aux_2_semaines">{fr.paye.frequences.aux_2_semaines}</option>
                <option value="hebdomadaire">{fr.paye.frequences.hebdomadaire}</option>
              </select>
              <BoutonSoumettre variant="secondaire" className="self-start">
                {fr.paye.enregistrer}
              </BoutonSoumettre>
            </form>
          </div>
        </Carte>
      ) : null}

      {/* Rappels (FR-10, bidirectionnel) + export iCal (FR-14, token HMAC stateless). */}
      <Carte titre={t.groupes.rappelsExport}>
        <div className="flex flex-col items-start gap-3">
          <h3 className="text-sm font-semibold text-neutral-300">{fr.rappels.titre}</h3>
          <ActiverRappels
            householdId={monAdhesion.household_id}
            clePubliqueVapid={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
          />
        </div>
        <div className="flex flex-col items-start gap-2">
          <h3 className="text-sm font-semibold text-neutral-300">{fr.ical.titre}</h3>
          <p className="text-sm text-neutral-400">{fr.ical.consigne}</p>
          {icalToken ? (
            <a
              href={`/api/ical/${icalToken}`}
              download="grandford.ics"
              className="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 px-4 text-sm font-semibold text-neutral-200 hover:bg-neutral-900"
            >
              {monAdhesion.role === "worker"
                ? fr.ical.telechargerTravailleur
                : fr.ical.telechargerConjointe}
            </a>
          ) : (
            <p className="text-sm text-neutral-500">{fr.rappels.nonConfigure}</p>
          )}
        </div>
      </Carte>

      {estProprietaire ? (
        <Carte>
          <form action={creerInvitation.bind(null, foyer.id)}>
            <BoutonSoumettre variant="primaire" pleineLargeur className="text-lg">
              {t.inviter}
            </BoutonSoumettre>
          </form>

          {invitations && invitations.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-neutral-300">{t.invitationsEnAttente}</h3>
              <p className="text-sm text-neutral-400">{t.invitationConsigne}</p>
              <ul className="flex flex-col gap-2">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3"
                  >
                    <span className="text-sm text-neutral-400">{t.copierLien}</span>
                    <code className="break-all text-sm text-emerald-300">
                      {`${origin}/invitation/${invitation.code}`}
                    </code>
                    <form action={annulerInvitation.bind(null, invitation.id)}>
                      <BoutonSoumettre variant="secondaire" className="self-start px-3 text-sm">
                        {t.annulerInvitation}
                      </BoutonSoumettre>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Carte>
      ) : (
        <Carte>
          <form action={quitterFoyer.bind(null, monAdhesion.id)}>
            <BoutonSoumettre variant="secondaire">{t.quitterFoyer}</BoutonSoumettre>
          </form>
        </Carte>
      )}

      {/* FR-13 — Historique des écarts : vue identique travailleur et conjointe.
          Affiche uniquement la date de l'écart et l'action — jamais l'effet ni le motif (R7). */}
      <Carte titre={t.historique.titre}>
        {historique.length === 0 ? (
          <p className="text-sm text-neutral-400">{t.historique.vide}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historique.map((entree) => (
              <li
                key={entree.id}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3"
              >
                <span className="font-medium">
                  {entree.action in t.historique.actions
                    ? t.historique.actions[entree.action as keyof typeof t.historique.actions]
                    : entree.action}
                </span>
                {entree.onDate ? (
                  <span className="text-sm text-neutral-400">
                    {FORMAT_DATE_COURTE.format(dateUTC(entree.onDate))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </main>
  );
}
