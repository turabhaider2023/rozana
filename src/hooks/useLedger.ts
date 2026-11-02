import { useEffect, useState } from "react";
import { categoryNameTaken, getCategory, isCategoryColor } from "../data/catalog";
import type { CustomCategory, LedgerState, MonthBudget, Recurring, RecurringInput, Transaction, TransactionInput, TxType } from "../types";
import { downloadFile } from "../lib/csv";
import { clampDay, isValidDateKey } from "../lib/dates";
import { entrySignature } from "../lib/entries";
import { createId } from "../lib/id";
import { roundMoney } from "../lib/money";
import { buildSample } from "../lib/sample";
import { emptyState, loadState, STORAGE_KEY } from "../lib/storage";

const PAYMENTS = new Set(["cash", "upi", "card", "bank"]);

export function useLedger() {
  const [boot] = useState(loadState);
  const [state, setState] = useState<LedgerState>(boot.state);
  const [corrupt, setCorrupt] = useState(boot.corrupt);
  const [persistError, setPersistError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setPersistError(null);
    } catch {
      setPersistError("Couldn't save on this browser. Free some space, then edit an entry to try again.");
    }
  }, [state]);

  function addEntry(input: TransactionInput, repeat: boolean): boolean {
    const clean = cleanEntry(input, state.categories);
    if (!clean) return false;
    const now = new Date().toISOString();
    setState((current) => {
      const recurringId = repeat ? createId() : undefined;
      const transaction: Transaction = {
        ...clean,
        id: createId(),
        recurringId,
        createdAt: now,
        updatedAt: now,
      };
      const recurring = recurringId
        ? [
            ...current.recurring,
            {
              id: recurringId,
              type: clean.type,
              amount: clean.amount,
              categoryId: clean.categoryId,
              note: clean.note,
              payment: clean.payment,
              dayOfMonth: Number(clean.date.slice(8, 10)),
              active: true,
              appliedMonths: [clean.date.slice(0, 7)],
              skippedMonths: [],
            } satisfies Recurring,
          ]
        : current.recurring;
      return { ...current, transactions: [...current.transactions, transaction], recurring };
    });
    return true;
  }

  function updateEntry(id: string, input: TransactionInput): boolean {
    const clean = cleanEntry(input, state.categories);
    if (!clean) return false;
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      transactions: current.transactions.map((entry) =>
        entry.id === id
          ? {
              ...clean,
              id: entry.id,
              recurringId: entry.recurringId,
              createdAt: entry.createdAt,
              updatedAt: now,
            }
          : entry,
      ),
    }));
    return true;
  }

  function deleteTransaction(id: string) {
    setState((current) => ({
      ...current,
      transactions: current.transactions.filter((entry) => entry.id !== id),
    }));
  }

  function restoreTransaction(entry: Transaction) {
    setState((current) =>
      current.transactions.some((item) => item.id === entry.id)
        ? current
        : { ...current, transactions: [...current.transactions, entry] },
    );
  }

  function applyPending(month: string): number {
    const waiting = state.recurring.filter(
      (item) => item.active && !item.appliedMonths.includes(month) && !item.skippedMonths.includes(month),
    );
    if (waiting.length === 0) return 0;
    const now = new Date().toISOString();
    setState((current) => {
      const pending = current.recurring.filter(
        (item) => item.active && !item.appliedMonths.includes(month) && !item.skippedMonths.includes(month),
      );
      if (pending.length === 0) return current;
      const ids = new Set(pending.map((item) => item.id));
      const created: Transaction[] = pending.map((item) => ({
        id: createId(),
        type: item.type,
        amount: item.amount,
        categoryId: item.categoryId,
        date: clampDay(month, item.dayOfMonth),
        note: item.note,
        payment: item.payment,
        recurringId: item.id,
        createdAt: now,
        updatedAt: now,
      }));
      return {
        ...current,
        transactions: [...current.transactions, ...created],
        recurring: current.recurring.map((item) =>
          ids.has(item.id) ? { ...item, appliedMonths: [...item.appliedMonths, month] } : item,
        ),
      };
    });
    return waiting.length;
  }

  function skipPending(month: string): number {
    const waiting = state.recurring.filter(
      (item) => item.active && !item.appliedMonths.includes(month) && !item.skippedMonths.includes(month),
    );
    if (waiting.length === 0) return 0;
    const ids = new Set(waiting.map((item) => item.id));
    setState((current) => ({
      ...current,
      recurring: current.recurring.map((item) =>
        ids.has(item.id) && !item.skippedMonths.includes(month)
          ? { ...item, skippedMonths: [...item.skippedMonths, month] }
          : item,
      ),
    }));
    return waiting.length;
  }

  function addRecurring(input: RecurringInput, applyMonth: string | null): boolean {
    const clean = cleanRecurring(input, state.categories);
    if (!clean) return false;
    const now = new Date().toISOString();
    setState((current) => {
      const id = createId();
      const item: Recurring = {
        ...clean,
        id,
        active: true,
        appliedMonths: applyMonth ? [applyMonth] : [],
        skippedMonths: [],
      };
      const transactions = applyMonth
        ? [
            ...current.transactions,
            {
              id: createId(),
              type: clean.type,
              amount: clean.amount,
              categoryId: clean.categoryId,
              date: clampDay(applyMonth, clean.dayOfMonth),
              note: clean.note,
              payment: clean.payment,
              recurringId: id,
              createdAt: now,
              updatedAt: now,
            } satisfies Transaction,
          ]
        : current.transactions;
      return { ...current, recurring: [...current.recurring, item], transactions };
    });
    return true;
  }

  function updateRecurring(id: string, input: RecurringInput, active: boolean): boolean {
    const clean = cleanRecurring(input, state.categories);
    if (!clean) return false;
    setState((current) => ({
      ...current,
      recurring: current.recurring.map((item) =>
        item.id === id ? { ...item, ...clean, active, sample: undefined } : item,
      ),
    }));
    return true;
  }

  function setRecurringActive(id: string, active: boolean) {
    setState((current) => ({
      ...current,
      recurring: current.recurring.map((item) => (item.id === id ? { ...item, active } : item)),
    }));
  }

  function deleteRecurring(id: string) {
    setState((current) => ({
      ...current,
      recurring: current.recurring.filter((item) => item.id !== id),
    }));
  }

  function setMonthLimit(month: string, limit: number) {
    const safe = roundMoney(Math.max(0, limit));
    setState((current) => ({ ...current, budgets: withBudget(current.budgets, month, (budget) => ({ ...budget, limit: safe })) }));
  }

  function addCategory(name: string, kind: TxType, color: string): { category: CustomCategory } | { error: string } {
    const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 24);
    if (cleanName.length < 2) return { error: "Use at least 2 letters." };
    if (categoryNameTaken(cleanName, kind, state.categories)) return { error: "That category already exists." };
    const chosen = isCategoryColor(color) ? color : "#d4522a";
    const category: CustomCategory = { id: createId(), name: cleanName, kind, color: chosen };
    setState((current) => {
      if (categoryNameTaken(cleanName, kind, current.categories)) return current;
      return { ...current, categories: [...current.categories, category] };
    });
    return { category };
  }

  function removeCategory(id: string): string | null {
    const category = state.categories.find((item) => item.id === id);
    if (!category) return "That category is part of the built-in list.";
    const used =
      state.transactions.some((entry) => entry.categoryId === id) ||
      state.recurring.some((item) => item.categoryId === id);
    if (used) return "This category is still used. Change those entries first.";
    setState((current) => ({
      ...current,
      categories: current.categories.filter((item) => item.id !== id),
      budgets: current.budgets.map((budget) => {
        if (!(id in budget.categories)) return budget;
        const categories = { ...budget.categories };
        delete categories[id];
        return { ...budget, categories };
      }),
    }));
    return null;
  }

  function setCategoryLimit(month: string, categoryId: string, limit: number) {
    const category = getCategory(categoryId, state.categories);
    if (!category || category.kind !== "expense") return;
    const safe = roundMoney(Math.max(0, limit));
    setState((current) => ({
      ...current,
      budgets: withBudget(current.budgets, month, (budget) => {
        const categories = { ...budget.categories };
        if (safe <= 0) delete categories[categoryId];
        else categories[categoryId] = safe;
        return { ...budget, categories };
      }),
    }));
  }

  function setDisplayName(name: string) {
    setState((current) => ({ ...current, settings: { displayName: name.slice(0, 32) } }));
  }

  function importTransactions(candidates: Transaction[]) {
    const keys = new Set(state.transactions.map(entrySignature));
    const fresh: Transaction[] = [];
    let duplicates = 0;
    for (const entry of candidates) {
      const key = entrySignature(entry);
      if (keys.has(key)) {
        duplicates += 1;
        continue;
      }
      keys.add(key);
      fresh.push(entry);
    }
    if (fresh.length > 0) {
      setState((current) => ({ ...current, transactions: [...current.transactions, ...fresh] }));
    }
    return { added: fresh.length, duplicates };
  }

  function replaceAll(next: LedgerState) {
    setState(next);
  }

  function loadSample(today: string) {
    if (state.transactions.some((entry) => entry.sample) || state.recurring.some((item) => item.sample)) {
      return { added: 0, months: [] as string[] };
    }
    const built = buildSample(today);
    setState((current) => {
      if (current.transactions.some((entry) => entry.sample) || current.recurring.some((item) => item.sample)) {
        return current;
      }
      return {
        ...current,
        transactions: [...current.transactions, ...built.transactions],
        recurring: [...current.recurring, ...built.recurring],
        budgets: mergeBudgets(current.budgets, built.budgets),
      };
    });
    return { added: built.transactions.length, months: built.months };
  }

  function clearSample() {
    const count = state.transactions.filter((entry) => entry.sample).length;
    setState((current) => ({
      ...current,
      transactions: current.transactions.filter((entry) => !entry.sample),
      recurring: current.recurring.filter((item) => !item.sample),
    }));
    return count;
  }

  function resetAll() {
    setState(emptyState());
  }

  function downloadRecovery() {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}.corrupt`);
      if (!raw) return false;
      downloadFile("rozana-recovery.json", raw, "application/json");
      return true;
    } catch {
      return false;
    }
  }

  return {
    state,
    corrupt,
    persistError,
    dismissCorrupt: () => setCorrupt(false),
    addEntry,
    updateEntry,
    deleteTransaction,
    restoreTransaction,
    applyPending,
    skipPending,
    addRecurring,
    updateRecurring,
    setRecurringActive,
    deleteRecurring,
    setMonthLimit,
    setCategoryLimit,
    addCategory,
    removeCategory,
    setDisplayName,
    importTransactions,
    replaceAll,
    loadSample,
    clearSample,
    resetAll,
    downloadRecovery,
  };
}

function cleanEntry(input: TransactionInput, custom: CustomCategory[]): TransactionInput | null {
  if (input.type !== "expense" && input.type !== "income") return null;
  if (!isValidDateKey(input.date)) return null;
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 100_000_000) return null;
  if (!PAYMENTS.has(input.payment)) return null;
  const category = getCategory(input.categoryId, custom);
  if (!category || category.kind !== input.type) return null;
  return {
    type: input.type,
    amount: roundMoney(input.amount),
    categoryId: input.categoryId,
    date: input.date,
    note: input.note.trim().slice(0, 160),
    payment: input.payment,
  };
}

function cleanRecurring(input: RecurringInput, custom: CustomCategory[]): RecurringInput | null {
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) return null;
  const entry = cleanEntry({ ...input, date: "2000-01-15" }, custom);
  if (!entry) return null;
  return {
    type: entry.type,
    amount: entry.amount,
    categoryId: entry.categoryId,
    note: entry.note,
    payment: entry.payment,
    dayOfMonth: input.dayOfMonth,
  };
}

function withBudget(budgets: MonthBudget[], month: string, update: (budget: MonthBudget) => MonthBudget): MonthBudget[] {
  const current = budgets.find((budget) => budget.month === month) ?? { month, limit: 0, categories: {} };
  const next = update(current);
  const rest = budgets.filter((budget) => budget.month !== month);
  if (next.limit <= 0 && Object.keys(next.categories).length === 0) return rest;
  return [...rest, next];
}

function mergeBudgets(current: MonthBudget[], incoming: MonthBudget[]): MonthBudget[] {
  return incoming.reduce((next, item) => {
    const existing = next.find((budget) => budget.month === item.month);
    const owned = existing && (existing.limit > 0 || Object.keys(existing.categories).length > 0);
    if (owned) return next;
    return withBudget(next, item.month, () => item);
  }, current);
}
