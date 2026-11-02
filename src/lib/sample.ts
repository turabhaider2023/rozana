import type { MonthBudget, Payment, Recurring, Transaction, TxType } from "../types";
import { clampDay, daysInMonth, monthKeyFromDate, pad, shiftMonth } from "./dates";

interface TemplateRow {
  day: number;
  type: TxType;
  categoryId: string;
  amount: number;
  payment: Payment;
  note: string;
}

const TEMPLATE: TemplateRow[] = [
  { day: 3, type: "expense", categoryId: "groceries", amount: 2460, payment: "upi", note: "Weekly groceries" },
  { day: 3, type: "expense", categoryId: "transport", amount: 180, payment: "upi", note: "Metro card" },
  { day: 4, type: "expense", categoryId: "food", amount: 320, payment: "upi", note: "Lunch with team" },
  { day: 6, type: "expense", categoryId: "food", amount: 150, payment: "cash", note: "Chai and snacks" },
  { day: 7, type: "expense", categoryId: "fun", amount: 700, payment: "card", note: "Movie night" },
  { day: 8, type: "expense", categoryId: "transport", amount: 420, payment: "upi", note: "Cab to office" },
  { day: 9, type: "expense", categoryId: "health", amount: 540, payment: "upi", note: "Pharmacy" },
  { day: 10, type: "expense", categoryId: "groceries", amount: 1880, payment: "upi", note: "Vegetables and milk" },
  { day: 11, type: "expense", categoryId: "food", amount: 280, payment: "upi", note: "Dinner" },
  { day: 12, type: "expense", categoryId: "personal", amount: 650, payment: "upi", note: "Haircut" },
  { day: 13, type: "expense", categoryId: "shopping", amount: 2199, payment: "card", note: "Shirt" },
  { day: 14, type: "expense", categoryId: "family", amount: 1500, payment: "upi", note: "Sent home" },
  { day: 15, type: "expense", categoryId: "bills", amount: 1450, payment: "upi", note: "Electricity" },
  { day: 16, type: "expense", categoryId: "food", amount: 210, payment: "cash", note: "Breakfast" },
  { day: 17, type: "expense", categoryId: "transport", amount: 260, payment: "upi", note: "Fuel" },
  { day: 18, type: "expense", categoryId: "fun", amount: 499, payment: "card", note: "Streaming and snacks" },
  { day: 19, type: "income", categoryId: "freelance", amount: 4000, payment: "bank", note: "Weekend project" },
  { day: 20, type: "expense", categoryId: "groceries", amount: 2120, payment: "upi", note: "Groceries" },
  { day: 21, type: "expense", categoryId: "food", amount: 860, payment: "card", note: "Dinner out" },
  { day: 22, type: "expense", categoryId: "education", amount: 799, payment: "card", note: "Online course" },
  { day: 24, type: "expense", categoryId: "health", amount: 1200, payment: "upi", note: "Doctor visit" },
  { day: 25, type: "expense", categoryId: "transport", amount: 350, payment: "upi", note: "Auto and metro" },
  { day: 26, type: "expense", categoryId: "food", amount: 190, payment: "upi", note: "Lunch" },
  { day: 27, type: "expense", categoryId: "bills", amount: 399, payment: "upi", note: "Mobile recharge" },
  { day: 28, type: "expense", categoryId: "shopping", amount: 980, payment: "upi", note: "Household items" },
  { day: 30, type: "expense", categoryId: "family", amount: 2000, payment: "bank", note: "Family expense" },
];

const RECURRING_SEED: Array<Omit<Recurring, "appliedMonths" | "skippedMonths">> = [
  {
    id: "sample-salary",
    type: "income",
    amount: 72000,
    categoryId: "salary",
    note: "Monthly salary",
    payment: "bank",
    dayOfMonth: 1,
    active: true,
    sample: true,
  },
  {
    id: "sample-rent",
    type: "expense",
    amount: 18000,
    categoryId: "rent",
    note: "House rent",
    payment: "bank",
    dayOfMonth: 2,
    active: true,
    sample: true,
  },
  {
    id: "sample-wifi",
    type: "expense",
    amount: 899,
    categoryId: "bills",
    note: "Wifi bill",
    payment: "upi",
    dayOfMonth: 5,
    active: true,
    sample: true,
  },
];

export interface SampleBundle {
  transactions: Transaction[];
  recurring: Recurring[];
  budgets: MonthBudget[];
  months: string[];
}

export function buildSample(today: string): SampleBundle {
  const current = monthKeyFromDate(today);
  const previous = shiftMonth(current, -1);
  const months = [previous, current];
  const recurring: Recurring[] = RECURRING_SEED.map((item) => ({
    ...item,
    appliedMonths: [],
    skippedMonths: [],
  }));
  const transactions: Transaction[] = [];
  let stamp = 0;

  for (const month of months) {
    for (const item of recurring) {
      const date = clampDay(month, item.dayOfMonth);
      if (month === current && date > today) continue;
      item.appliedMonths.push(month);
      transactions.push(makeSample(item, date, month, stamp));
      stamp += 1;
    }
    for (const row of TEMPLATE) {
      if (row.day > daysInMonth(month)) continue;
      const date = `${month}-${pad(row.day)}`;
      if (month === current && date > today) continue;
      transactions.push(makeSample(row, date, month, stamp));
      stamp += 1;
    }
  }

  const budgets: MonthBudget[] = months.map((month) => ({
    month,
    limit: 40000,
    categories: {
      food: 6000,
      groceries: 8000,
      transport: 3000,
      shopping: 4000,
      fun: 2500,
    },
  }));

  return { transactions, recurring, budgets, months };
}

export function preferredSampleMonth(today: string): string {
  const current = monthKeyFromDate(today);
  if (Number(today.slice(8, 10)) < 10) return shiftMonth(current, -1);
  return current;
}

function makeSample(
  row: { type: TxType; amount: number; categoryId: string; payment: Payment; note: string; id?: string },
  date: string,
  month: string,
  index: number,
): Transaction {
  const hours = pad(8 + (index % 10));
  const minutes = pad((index * 7) % 60);
  const createdAt = `${date}T${hours}:${minutes}:00.000Z`;
  return {
    id: `sample-${month}-${row.categoryId}-${date.slice(8)}-${index}`,
    type: row.type,
    amount: row.amount,
    categoryId: row.categoryId,
    date,
    note: row.note,
    payment: row.payment,
    recurringId: row.id,
    sample: true,
    createdAt,
    updatedAt: createdAt,
  };
}
