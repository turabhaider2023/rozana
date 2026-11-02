import type { CustomCategory, Payment, TxType } from "../types";

export interface Category {
  id: string;
  name: string;
  kind: TxType;
  color: string;
  hint: string;
}

export const CATEGORIES: Category[] = [
  { id: "food", name: "Food", kind: "expense", color: "#e07a3d", hint: "Meals, snacks, chai" },
  { id: "groceries", name: "Groceries", kind: "expense", color: "#6b8f71", hint: "Household shopping" },
  { id: "transport", name: "Transport", kind: "expense", color: "#3d7ea6", hint: "Cab, metro, fuel" },
  { id: "rent", name: "Rent", kind: "expense", color: "#8b5e3c", hint: "House rent" },
  { id: "bills", name: "Bills", kind: "expense", color: "#c4a15a", hint: "Wifi, power, recharge" },
  { id: "shopping", name: "Shopping", kind: "expense", color: "#b85c7a", hint: "Clothes and goods" },
  { id: "health", name: "Health", kind: "expense", color: "#c4534a", hint: "Medicine, doctor" },
  { id: "fun", name: "Fun", kind: "expense", color: "#7a62b8", hint: "Movies and outings" },
  { id: "education", name: "Learning", kind: "expense", color: "#3f6f8f", hint: "Courses and books" },
  { id: "personal", name: "Personal", kind: "expense", color: "#b08652", hint: "Care and grooming" },
  { id: "family", name: "Family", kind: "expense", color: "#9a6b4f", hint: "Home and family" },
  { id: "other", name: "Other", kind: "expense", color: "#7d756b", hint: "Everything else" },
  { id: "salary", name: "Salary", kind: "income", color: "#1f7a4d", hint: "Pay" },
  { id: "freelance", name: "Freelance", kind: "income", color: "#2a8f62", hint: "Side work" },
  { id: "refund", name: "Refund", kind: "income", color: "#3d8b7a", hint: "Money back" },
  { id: "other-income", name: "Other income", kind: "income", color: "#4e7c68", hint: "Other money in" },
];

export const CATEGORY_COLORS = [
  "#d4522a",
  "#c43d6e",
  "#7a4ea3",
  "#3d6ea8",
  "#1f7a6a",
  "#6b8f3a",
  "#c48a2a",
  "#8a5a3a",
  "#5c6b73",
  "#b4533a",
];

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

export function isCategoryColor(value: string): boolean {
  return CATEGORY_COLORS.includes(value);
}

export function getCategory(id: string, custom: CustomCategory[] = []): Category | undefined {
  return BY_ID.get(id) ?? toCategory(custom.find((category) => category.id === id));
}

export function categoriesFor(kind: TxType, custom: CustomCategory[] = []): Category[] {
  return [
    ...CATEGORIES.filter((category) => category.kind === kind),
    ...custom.filter((category) => category.kind === kind).map((category) => toCategory(category)!),
  ];
}

export function categoryNameTaken(name: string, kind: TxType, custom: CustomCategory[]): boolean {
  const query = name.trim().toLowerCase();
  if (!query) return false;
  return categoriesFor(kind, custom).some((category) => category.name.toLowerCase() === query);
}

function toCategory(category: CustomCategory | undefined): Category | undefined {
  if (!category) return undefined;
  return { id: category.id, name: category.name, kind: category.kind, color: category.color, hint: "Added by you" };
}

export const PAYMENT_OPTIONS: { id: Payment; label: string }[] = [
  { id: "upi", label: "UPI" },
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "bank", label: "Bank" },
];

export function paymentLabel(id: Payment): string {
  return PAYMENT_OPTIONS.find((option) => option.id === id)?.label ?? id;
}
