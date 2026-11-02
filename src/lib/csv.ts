import { categoriesFor, getCategory } from "../data/catalog";
import type { CustomCategory, Payment, Transaction, TxType } from "../types";
import { isValidDateKey, pad } from "./dates";
import { createId } from "./id";
import { parseAmount, roundMoney } from "./money";

export interface CsvImport {
  transactions: Transaction[];
  skipped: number;
  truncated: boolean;
  reason: string | null;
}

const HEADER_MAP: Record<string, "date" | "type" | "category" | "amount" | "payment" | "note"> = {
  date: "date",
  day: "date",
  type: "type",
  category: "category",
  "category name": "category",
  amount: "amount",
  amt: "amount",
  payment: "payment",
  "payment method": "payment",
  mode: "payment",
  note: "note",
  notes: "note",
  description: "note",
  narration: "note",
};

export function toCsv(transactions: Transaction[]): string {
  const lines = [["date", "type", "category", "amount", "payment", "note"].map(csvCell).join(",")];
  const ordered = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const entry of ordered) {
    lines.push(
      [
        entry.date,
        entry.type,
        getCategory(entry.categoryId)?.name ?? entry.categoryId,
        roundMoney(entry.amount),
        entry.payment,
        entry.note,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function parseCsv(text: string, custom: CustomCategory[] = []): CsvImport {
  const rows = readCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length === 0) {
    return { transactions: [], skipped: 0, truncated: false, reason: "The file has no rows." };
  }

  const headerCells = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = headerCells.some((cell) => cell === "date" || cell === "amount");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const columns = hasHeader ? mapHeaders(headerCells) : positionalColumns();

  if (hasHeader && columns.date === undefined) {
    return { transactions: [], skipped: dataRows.length, truncated: false, reason: "Add a date column." };
  }
  if (hasHeader && columns.amount === undefined) {
    return { transactions: [], skipped: dataRows.length, truncated: false, reason: "Add an amount column." };
  }

  const now = new Date().toISOString();
  const transactions: Transaction[] = [];
  let skipped = 0;
  let reason: string | null = null;
  const limited = dataRows.slice(0, 5000);
  const truncated = dataRows.length > 5000;

  limited.forEach((row, index) => {
    if (row.every((cell) => cell.trim() === "")) return;
    const parsed = parseRow(row, columns, custom);
    if (!parsed) {
      skipped += 1;
      if (!reason) reason = `Row ${index + (hasHeader ? 2 : 1)} could not be read.`;
      return;
    }
    transactions.push({
      ...parsed,
      id: createId(),
      createdAt: now,
      updatedAt: now,
    });
  });

  return { transactions, skipped, truncated, reason };
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function readCsv(input: string): string[][] {
  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

function mapHeaders(headers: string[]): Partial<Record<"date" | "type" | "category" | "amount" | "payment" | "note", number>> {
  const columns: Partial<Record<"date" | "type" | "category" | "amount" | "payment" | "note", number>> = {};
  headers.forEach((header, index) => {
    const key = HEADER_MAP[header];
    if (key && columns[key] === undefined) columns[key] = index;
  });
  return columns;
}

function positionalColumns(): Record<"date" | "type" | "category" | "amount" | "payment" | "note", number> {
  return { date: 0, type: 1, category: 2, amount: 3, payment: 4, note: 5 };
}

function cellAt(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return row[index]?.trim() ?? "";
}

function parseRow(
  row: string[],
  columns: Partial<Record<"date" | "type" | "category" | "amount" | "payment" | "note", number>>,
  custom: CustomCategory[],
): Omit<Transaction, "id" | "createdAt" | "updatedAt"> | null {
  const date = parseDateFlexible(cellAt(row, columns.date));
  const type = parseType(cellAt(row, columns.type));
  const amount = parseAmount(cellAt(row, columns.amount));
  const payment = parsePayment(cellAt(row, columns.payment));
  if (!date || !type || amount === null || !payment) return null;
  const category = matchCategory(cellAt(row, columns.category), type, custom);
  if (!category) return null;
  return {
    type,
    amount,
    categoryId: category.id,
    date,
    note: cellAt(row, columns.note).slice(0, 160),
    payment,
  };
}

export function parseDateFlexible(value: string): string | null {
  const trimmed = value.trim();
  if (isValidDateKey(trimmed)) return trimmed;
  const match = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(trimmed);
  if (match) {
    const key = `${match[3]}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`;
    return isValidDateKey(key) ? key : null;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial > 20000 && serial < 80000) {
      const utc = new Date(Math.round((serial - 25569) * 86400 * 1000));
      const key = `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
      return isValidDateKey(key) ? key : null;
    }
  }
  return null;
}

function parseType(value: string): TxType | null {
  if (!value) return "expense";
  const normalized = value.toLowerCase();
  if (normalized === "expense" || normalized === "spent" || normalized === "debit") return "expense";
  if (normalized === "income" || normalized === "credit" || normalized === "earned") return "income";
  return null;
}

function parsePayment(value: string): Payment | null {
  if (!value) return "upi";
  const normalized = value.toLowerCase();
  if (["upi", "gpay", "phonepe", "paytm"].includes(normalized)) return "upi";
  if (normalized === "cash") return "cash";
  if (normalized === "card" || normalized === "credit" || normalized === "debit card") return "card";
  if (["bank", "neft", "transfer", "netbanking"].includes(normalized)) return "bank";
  return null;
}

function matchCategory(value: string, kind: TxType, custom: CustomCategory[]) {
  const list = categoriesFor(kind, custom);
  const query = value.trim().toLowerCase();
  if (!query) return list.find((category) => category.id === (kind === "expense" ? "other" : "other-income"));
  return list.find((category) => category.id.toLowerCase() === query || category.name.toLowerCase() === query);
}
