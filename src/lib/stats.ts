import { getCategory } from "../data/catalog";
import type { CustomCategory, LedgerState, Payment, Transaction } from "../types";
import {
  daysElapsed,
  daysInMonth,
  daysLeftInclusive,
  monthKeyFromDate,
  parseMonth,
  shiftMonth,
} from "./dates";
import { formatMoney, roundMoney } from "./money";

export interface CategoryTotal {
  categoryId: string;
  amount: number;
  count: number;
}

export interface PaymentTotal {
  payment: Payment;
  amount: number;
}

export interface DayBucket {
  date: string;
  spent: number;
  earned: number;
  count: number;
  transactions: Transaction[];
}

export interface WeekdayPoint {
  label: string;
  total: number;
  average: number;
  days: number;
}

export interface MonthSummary {
  month: string;
  spent: number;
  earned: number;
  net: number;
  expenseCount: number;
  incomeCount: number;
  byCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  byDay: DayBucket[];
  byPayment: PaymentTotal[];
  budgetLimit: number;
  categoryLimits: Record<string, number>;
  budgetGap: number | null;
  usedRatio: number | null;
  elapsedDays: number;
  daysInMonth: number;
  daysLeftInclusive: number;
  dailyAverage: number;
  perDayLeft: number | null;
  projected: number;
  projectedIsPace: boolean;
  previousSpent: number;
  previousEarned: number;
  previousDaily: number;
  isCurrentMonth: boolean;
  isPastMonth: boolean;
  isFutureMonth: boolean;
  topExpenses: Transaction[];
  weekday: WeekdayPoint[];
}

export function budgetFor(state: LedgerState, month: string) {
  return state.budgets.find((budget) => budget.month === month) ?? { month, limit: 0, categories: {} };
}

export function pendingRecurring(state: LedgerState, month: string) {
  return state.recurring.filter(
    (item) => item.active && !item.appliedMonths.includes(month) && !item.skippedMonths.includes(month),
  );
}

export function buildSummary(state: LedgerState, month: string, today: string): MonthSummary {
  const todayMonth = monthKeyFromDate(today);
  const dim = daysInMonth(month);
  const elapsed = daysElapsed(month, today);
  const left = daysLeftInclusive(month, today);
  const monthTx = state.transactions.filter((entry) => entry.date.startsWith(month));
  const expenses = monthTx.filter((entry) => entry.type === "expense");
  const income = monthTx.filter((entry) => entry.type === "income");
  const spent = roundMoney(expenses.reduce((sum, entry) => sum + entry.amount, 0));
  const earned = roundMoney(income.reduce((sum, entry) => sum + entry.amount, 0));
  const budget = budgetFor(state, month);
  const budgetLimit = budget.limit;
  const previous = shiftMonth(month, -1);
  const previousTx = state.transactions.filter((entry) => entry.date.startsWith(previous));
  const previousSpent = roundMoney(
    previousTx.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0),
  );
  const previousEarned = roundMoney(
    previousTx.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0),
  );
  const previousElapsed = daysElapsed(previous, today);
  const dailyAverage = elapsed > 0 ? roundMoney(spent / elapsed) : 0;
  const previousDaily = previousElapsed > 0 ? roundMoney(previousSpent / previousElapsed) : 0;
  const isCurrentMonth = month === todayMonth;
  const isPastMonth = month < todayMonth;
  const projectedIsPace = isCurrentMonth && elapsed >= 7 && elapsed < dim;
  const projected = projectedIsPace ? roundMoney((spent / elapsed) * dim) : spent;
  const perDayLeft = budgetLimit > 0 && left > 0 ? roundMoney((budgetLimit - spent) / left) : null;

  const byDay: DayBucket[] = Array.from({ length: dim }, (_, index) => ({
    date: `${month}-${String(index + 1).padStart(2, "0")}`,
    spent: 0,
    earned: 0,
    count: 0,
    transactions: [],
  }));

  for (const entry of monthTx) {
    const bucket = byDay[Number(entry.date.slice(8, 10)) - 1];
    if (!bucket) continue;
    bucket.transactions.push(entry);
    bucket.count += 1;
    if (entry.type === "expense") bucket.spent = roundMoney(bucket.spent + entry.amount);
    else bucket.earned = roundMoney(bucket.earned + entry.amount);
  }
  for (const bucket of byDay) {
    bucket.transactions.sort(sortInsideDay);
  }

  return {
    month,
    spent,
    earned,
    net: roundMoney(earned - spent),
    expenseCount: expenses.length,
    incomeCount: income.length,
    byCategory: totalsFor(expenses),
    incomeByCategory: totalsFor(income),
    byDay,
    byPayment: paymentTotals(expenses),
    budgetLimit,
    categoryLimits: budget.categories,
    budgetGap: budgetLimit > 0 ? roundMoney(budgetLimit - spent) : null,
    usedRatio: budgetLimit > 0 ? spent / budgetLimit : null,
    elapsedDays: elapsed,
    daysInMonth: dim,
    daysLeftInclusive: left,
    dailyAverage,
    perDayLeft,
    projected,
    projectedIsPace,
    previousSpent,
    previousEarned,
    previousDaily,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth: month > todayMonth,
    topExpenses: [...expenses].sort((a, b) => b.amount - a.amount || (a.date < b.date ? 1 : -1)).slice(0, 5),
    weekday: weekdaySpend(expenses, month, today),
  };
}

export function monthNarrative(
  summary: MonthSummary,
  monthName: string,
  previousName: string,
  custom: CustomCategory[] = [],
): string {
  if (summary.expenseCount === 0 && summary.incomeCount === 0) {
    return `${monthName} has no entries yet. Add expenses as the days happen and this page will explain the month.`;
  }

  const sentences: string[] = [];
  if (summary.expenseCount === 0) {
    sentences.push(`${monthName} has ${formatMoney(summary.earned)} in income and no expenses yet.`);
  } else {
    const entryWord = summary.expenseCount === 1 ? "entry" : "entries";
    sentences.push(
      `${monthName} shows ${formatMoney(summary.spent)} spent across ${summary.expenseCount} ${entryWord}.`,
    );
  }

  const top = summary.byCategory[0];
  if (top && summary.spent > 0) {
    const category = getCategory(top.categoryId, custom);
    if (category) sentences.push(`${category.name} is the largest share.`);
  }

  if (summary.budgetLimit > 0 && summary.budgetGap !== null) {
    if (summary.budgetGap < 0) {
      sentences.push(
        `That is ${formatMoney(Math.abs(summary.budgetGap))} over the ${formatMoney(summary.budgetLimit)} budget.`,
      );
    } else {
      sentences.push(
        `${formatMoney(summary.budgetGap)} is still inside the ${formatMoney(summary.budgetLimit)} budget.`,
      );
    }
  }

  if (summary.isCurrentMonth && summary.elapsedDays >= 7 && summary.previousDaily > 0 && summary.dailyAverage > 0) {
    const change = percentDelta(summary.dailyAverage, summary.previousDaily);
    if (change !== null) {
      sentences.push(`Per day, that is ${change} than ${previousName}.`);
    }
  } else if (summary.isPastMonth && summary.previousSpent > 0 && summary.spent > 0) {
    const change = percentDelta(summary.spent, summary.previousSpent);
    if (change !== null) sentences.push(`That is ${change} than ${previousName}.`);
  }

  if (summary.earned > 0 && summary.expenseCount > 0) {
    const saved = roundMoney(summary.earned - summary.spent);
    if (saved >= 0) sentences.push(`Income covers the month, with ${formatMoney(saved)} left over.`);
    else sentences.push(`Expenses run ${formatMoney(Math.abs(saved))} beyond income.`);
  }

  if (summary.projectedIsPace && summary.budgetLimit > 0) {
    const endGap = roundMoney(summary.budgetLimit - summary.projected);
    if (endGap < 0) {
      sentences.push(`At this pace the month finishes about ${formatMoney(Math.abs(endGap))} over budget.`);
    } else {
      sentences.push(`At this pace the month finishes about ${formatMoney(endGap)} under budget.`);
    }
  }

  return sentences.join(" ");
}

function totalsFor(entries: Transaction[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const entry of entries) {
    const current = map.get(entry.categoryId) ?? { categoryId: entry.categoryId, amount: 0, count: 0 };
    current.amount = roundMoney(current.amount + entry.amount);
    current.count += 1;
    map.set(entry.categoryId, current);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function paymentTotals(expenses: Transaction[]): PaymentTotal[] {
  const map = new Map<Payment, number>();
  for (const entry of expenses) {
    map.set(entry.payment, roundMoney((map.get(entry.payment) ?? 0) + entry.amount));
  }
  return [...map.entries()]
    .map(([payment, amount]) => ({ payment, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function weekdaySpend(expenses: Transaction[], month: string, today: string): WeekdayPoint[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const todayMonth = monthKeyFromDate(today);
  const { year, monthIndex } = parseMonth(month);
  const dim = daysInMonth(month);
  const countUntil = month === todayMonth ? Math.min(Number(today.slice(8, 10)), dim) : dim;

  for (let day = 1; day <= countUntil; day += 1) {
    const index = (new Date(year, monthIndex, day).getDay() + 6) % 7;
    counts[index] += 1;
  }

  for (const entry of expenses) {
    if (month === todayMonth && entry.date > today) continue;
    const [entryYear, entryMonth, entryDay] = entry.date.split("-").map(Number);
    const index = (new Date(entryYear, entryMonth - 1, entryDay).getDay() + 6) % 7;
    totals[index] = roundMoney(totals[index] + entry.amount);
  }

  return labels.map((label, index) => ({
    label,
    total: totals[index],
    days: counts[index],
    average: counts[index] > 0 ? roundMoney(totals[index] / counts[index]) : 0,
  }));
}

function sortInsideDay(a: Transaction, b: Transaction): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

function percentDelta(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return null;
  const direction = change > 0 ? "more" : "less";
  return `${Math.abs(Math.round(change))}% ${direction}`;
}
