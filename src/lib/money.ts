const whole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const precise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormat = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMoney(value: number): string {
  const rounded = roundMoney(value);
  if (Number.isInteger(rounded)) return whole.format(rounded);
  return precise.format(rounded);
}

export function formatNumber(value: number): string {
  return numberFormat.format(roundMoney(value));
}

export function formatShort(value: number): string {
  const amount = Math.abs(roundMoney(value));
  if (amount >= 10000000) return `₹${trimNumber(amount / 10000000)}cr`;
  if (amount >= 100000) return `₹${trimNumber(amount / 100000)}L`;
  if (amount >= 1000) return `₹${trimNumber(amount / 1000)}k`;
  return `₹${Math.round(amount)}`;
}

function trimNumber(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded);
}

export function parseAmount(raw: string, allowZero = false): number | null {
  const cleaned = raw.trim().replace(/[₹\s,]/g, "");
  if (!cleaned) return allowZero ? 0 : null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = roundMoney(Number(cleaned));
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000) return null;
  if (value === 0 && !allowZero) return null;
  return value;
}
