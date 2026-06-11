import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper de composition de classes Tailwind (fondation shadcn/ui).
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
