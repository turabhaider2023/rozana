import { getCategory, isCategoryColor } from "../data/catalog";
import type { CustomCategory, LedgerState, MonthBudget, Payment, Recurring, Transaction, TxType } from "../types";
import { isValidDateKey, isValidMonth } from "./dates";
import { roundMoney } from "./money";

export const STORAGE_KEY = "rozana.ledger.v1";

const PAYMENTS = new Set<Payment>(["cash", "upi", "card", "bank"]);

export function emptyState(): LedgerState {
  return {
    version: 1,
    transactions: [],
    recurring: [],
    budgets: [],
    categories: [],
    settings: { displayName: "" },
  };
}

export interface BootResult {
  state: LedgerState;
  corrupt: boolean;
}

export function loadState(): BootResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: emptyState(), corrupt: false };
    try {
      const normalized = normalizeState(JSON.parse(raw) as unknown);
      if (normalized) return { state: normalized, corrupt: false };
    } catch {
      /* The saved text is not JSON. Keep a copy below. */
    }
    try {
      localStorage.setItem(`${STORAGE_KEY}.corrupt`, raw);
    } catch {
      /* Ignore quota failures while saving the recovery copy. */
    }
    return { state: emptyState(), corrupt: true };
  } catch {
    return { state: emptyState(), corrupt: false };
  }
}

export function normalizeState(input: unknown): LedgerState | null {
  if (!isRecord(input)) return null;
  if (input.version !== undefined && input.version !== 1) return null;
  if (!Array.isArray(input.transactions)) return null;

  const categories = Array.isArray(input.categories) ? parseCategories(input.categories) : [];
  const transactions = input.transactions
    .map((entry) => asTransaction(entry, categories))
    .filter((entry): entry is Transaction => entry !== null);
  if (input.transactions.length > 0 && transactions.length === 0) return null;

  const recurring = Array.isArray(input.recurring)
    ? input.recurring.map((entry) => asRecurring(entry, categories)).filter((entry): entry is Recurring => entry !== null)
    : [];
  const budgets = Array.isArray(input.budgets)
    ? input.budgets.map((entry) => asBudget(entry, categories)).filter((entry): entry is MonthBudget => entry !== null)
    : [];
  const displayName =
    isRecord(input.settings) && typeof input.settings.displayName === "string"
      ? input.settings.displayName.slice(0, 32)
      : "";

  return {
    version: 1,
    transactions,
    recurring,
    budgets,
    categories,
    settings: { displayName },
  };
}

function parseCategories(value: unknown[]): CustomCategory[] {
  const seen = new Set<string>();
  const categories: CustomCategory[] = [];
  for (const item of value) {
    const category = asCategory(item);
    if (!category || seen.has(category.id) || getCategory(category.id)) continue;
    seen.add(category.id);
    categories.push(category);
  }
  return categories;
}

function asCategory(value: unknown): CustomCategory | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id || value.id.length > 80) return null;
  if (value.kind !== "expense" && value.kind !== "income") return null;
  if (typeof value.name !== "string") return null;
  const name = value.name.trim().replace(/\s+/g, " ").slice(0, 24);
  if (!name) return null;
  if (typeof value.color !== "string" || !isCategoryColor(value.color)) return null;
  return { id: value.id, name, kind: value.kind, color: value.color };
}

function asTransaction(value: unknown, custom: CustomCategory[]): Transaction | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  if (value.type !== "expense" && value.type !== "income") return null;
  if (typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount <= 0) return null;
  if (typeof value.categoryId !== "string") return null;
  if (typeof value.date !== "string" || !isValidDateKey(value.date)) return null;
  if (typeof value.note !== "string") return null;
  if (typeof value.payment !== "string" || !PAYMENTS.has(value.payment as Payment)) return null;
  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") return null;
  const category = getCategory(value.categoryId, custom);
  if (!category || category.kind !== value.type) return null;
  return {
    id: value.id,
    type: value.type,
    amount: roundMoney(value.amount),
    categoryId: value.categoryId,
    date: value.date,
    note: value.note.slice(0, 160),
    payment: value.payment as Payment,
    recurringId: typeof value.recurringId === "string" ? value.recurringId : undefined,
    sample: value.sample === true ? true : undefined,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function asRecurring(value: unknown, custom: CustomCategory[]): Recurring | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  if (value.type !== "expense" && value.type !== "income") return null;
  if (typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount <= 0) return null;
  if (typeof value.categoryId !== "string") return null;
  if (typeof value.note !== "string") return null;
  if (typeof value.payment !== "string" || !PAYMENTS.has(value.payment as Payment)) return null;
  if (typeof value.dayOfMonth !== "number" || value.dayOfMonth < 1 || value.dayOfMonth > 31) return null;
  const category = getCategory(value.categoryId, custom);
  if (!category || category.kind !== value.type) return null;
  return {
    id: value.id,
    type: value.type as TxType,
    amount: roundMoney(value.amount),
    categoryId: value.categoryId,
    note: value.note.slice(0, 160),
    payment: value.payment as Payment,
    dayOfMonth: Math.trunc(value.dayOfMonth),
    active: value.active !== false,
    appliedMonths: monthList(value.appliedMonths),
    skippedMonths: monthList(value.skippedMonths),
    sample: value.sample === true ? true : undefined,
  };
}

function asBudget(value: unknown, custom: CustomCategory[]): MonthBudget | null {
  if (!isRecord(value)) return null;
  if (typeof value.month !== "string" || !isValidMonth(value.month)) return null;
  if (typeof value.limit !== "number" || !Number.isFinite(value.limit) || value.limit < 0 || value.limit > 100_000_000) {
    return null;
  }
  const categories: Record<string, number> = {};
  if (isRecord(value.categories)) {
    for (const [key, amount] of Object.entries(value.categories)) {
      const category = getCategory(key, custom);
      if (!category || category.kind !== "expense") continue;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) continue;
      categories[key] = roundMoney(amount);
    }
  }
  return { month: value.month, limit: roundMoney(value.limit), categories };
}

function monthList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && isValidMonth(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
