export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function todayKey(now = new Date()): string {
  return toDateKey(now);
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function parseMonth(month: string): { year: number; monthIndex: number } {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthIndex: monthNumber - 1 };
}

export function shiftMonth(month: string, delta: number): string {
  const { year, monthIndex } = parseMonth(month);
  const date = new Date(year, monthIndex + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const { year, monthIndex } = parseMonth(month);
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function clampDay(month: string, day: number): string {
  const max = daysInMonth(month);
  const safe = Math.min(Math.max(Math.trunc(day) || 1, 1), max);
  return `${month}-${pad(safe)}`;
}

export function monthLabel(month: string): string {
  const { year, monthIndex } = parseMonth(month);
  return new Date(year, monthIndex, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function longDayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function leadingBlanks(month: string): number {
  const { year, monthIndex } = parseMonth(month);
  const sundayBased = new Date(year, monthIndex, 1).getDay();
  return (sundayBased + 6) % 7;
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function daysElapsed(month: string, today: string): number {
  const todayMonth = monthKeyFromDate(today);
  if (month > todayMonth) return 0;
  if (month < todayMonth) return daysInMonth(month);
  return Math.min(Number(today.slice(8, 10)), daysInMonth(month));
}

export function daysLeftInclusive(month: string, today: string): number {
  const total = daysInMonth(month);
  const todayMonth = monthKeyFromDate(today);
  if (month > todayMonth) return total;
  if (month < todayMonth) return 0;
  const day = Number(today.slice(8, 10));
  return Math.max(total - day + 1, 0);
}
