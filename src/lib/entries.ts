import type { Transaction } from "../types";

export function compareEntries(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

export function entrySignature(entry: Pick<Transaction, "date" | "type" | "categoryId" | "amount" | "payment" | "note">): string {
  return [
    entry.date,
    entry.type,
    entry.categoryId,
    entry.amount.toFixed(2),
    entry.payment,
    entry.note.trim().toLowerCase(),
  ].join("|");
}
