import { and, eq } from "drizzle-orm";
import { portfoliosTable } from "@workspace/db/schema";
import { getTemplate } from "./portfolio-catalog";

// Every private query scopes both the requested record and its authenticated owner.
export const ownerScope = (ownerId: string, id?: number) => id === undefined
  ? eq(portfoliosTable.ownerId, ownerId)
  : and(eq(portfoliosTable.ownerId, ownerId), eq(portfoliosTable.id, id));

/**
 * Why a portfolio can't be published with this template, or null if it can.
 * Routes pass the template resolved from the registry (admin uploads, hidden
 * templates); without it, only the built-in catalog is checked.
 */
export function publicationError(
  templateId: string,
  template: { premium: boolean; hidden?: boolean } | undefined = getTemplate(templateId),
): { status: number; message: string } | null {
  if (!template || template.hidden) return { status: 400, message: "Choose an available portfolio design." };
  if (template.premium) return { status: 402, message: "Premium publishing is not available yet. Choose the free design." };
  return null;
}
