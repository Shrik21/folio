import { and, eq } from "drizzle-orm";
import { portfoliosTable } from "@workspace/db/schema";
import { getTemplate } from "./portfolio-catalog";

// Every private query scopes both the requested record and its authenticated owner.
export const ownerScope = (ownerId: string, id?: number) => id === undefined
  ? eq(portfoliosTable.ownerId, ownerId)
  : and(eq(portfoliosTable.ownerId, ownerId), eq(portfoliosTable.id, id));

export function publicationError(templateId: string): { status: number; message: string } | null {
  const template = getTemplate(templateId);
  if (!template) return { status: 400, message: "Choose an available portfolio design." };
  if (template.premium) return { status: 402, message: "Premium publishing is not available yet. Choose the free design." };
  return null;
}
