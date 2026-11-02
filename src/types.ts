export type TxType = "expense" | "income";

export type Payment = "cash" | "upi" | "card" | "bank";

export type View = "home" | "entries" | "budgets" | "insights";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  date: string;
  note: string;
  payment: Payment;
  recurringId?: string;
  sample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Recurring {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  payment: Payment;
  dayOfMonth: number;
  active: boolean;
  appliedMonths: string[];
  skippedMonths: string[];
  sample?: boolean;
}

export interface MonthBudget {
  month: string;
  limit: number;
  categories: Record<string, number>;
}

export interface Settings {
  displayName: string;
}

export interface CustomCategory {
  id: string;
  name: string;
  kind: TxType;
  color: string;
}

export interface LedgerState {
  version: 1;
  transactions: Transaction[];
  recurring: Recurring[];
  budgets: MonthBudget[];
  categories: CustomCategory[];
  settings: Settings;
}

export interface TransactionInput {
  type: TxType;
  amount: number;
  categoryId: string;
  date: string;
  note: string;
  payment: Payment;
}

export interface RecurringInput {
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  payment: Payment;
  dayOfMonth: number;
}
