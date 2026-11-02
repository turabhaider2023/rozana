import { useCategoryLookup } from "../data/catalog-context";
import { dayLabel, greeting, leadingBlanks, longDayLabel, monthLabel } from "../lib/dates";
import { formatMoney, formatShort } from "../lib/money";
import { cx } from "../lib/cx";
import type { MonthSummary } from "../lib/stats";
import type { Recurring, Transaction, TxType } from "../types";

export function Overview({
  month,
  today,
  name,
  summary,
  pending,
  selectedDate,
  allEmpty,
  onSelectDate,
  onAdd,
  onEdit,
  onOpenEntries,
  onOpenBudgets,
  onSample,
  onApplyPending,
  onSkipPending,
}: {
  month: string;
  today: string;
  name: string;
  summary: MonthSummary;
  pending: Recurring[];
  selectedDate: string | null;
  allEmpty: boolean;
  onSelectDate: (date: string) => void;
  onAdd: (date?: string, type?: TxType) => void;
  onEdit: (entry: Transaction) => void;
  onOpenEntries: (date: string) => void;
  onOpenBudgets: () => void;
  onSample: () => void;
  onApplyPending: () => void;
  onSkipPending: () => void;
}) {
  const lookup = useCategoryLookup();
  const blanks = leadingBlanks(month);
  const cells: Array<MonthSummary["byDay"][number] | null> = [
    ...Array.from({ length: blanks }, () => null),
    ...summary.byDay,
  ];
  const maxSpent = summary.byDay.reduce((max, day) => Math.max(max, day.spent), 0);
  const selected = summary.byDay.find((day) => day.date === selectedDate) ?? null;
  const room = roomStat(summary);
  const budgetTone = budgetToneFor(summary);
  const monthName = monthLabel(month);

  return (
    <div className="page">
      <header className="home-head">
        <h1>
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="lede">
          {summary.expenseCount === 0
            ? "Add each expense as it happens. The month will total itself."
            : `${summary.expenseCount} expense${summary.expenseCount === 1 ? "" : "s"} logged in ${monthName}.`}
        </p>
      </header>

      {allEmpty ? (
        <section className="empty">
          <h2>Start with today</h2>
          <p>Excel makes you chase cells. Here you enter an amount, pick a category, and the month stays added up.</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => onAdd(today.startsWith(month) ? today : undefined)}>
              Add an expense
            </button>
            <button type="button" className="btn ghost" onClick={() => onAdd(today.startsWith(month) ? today : undefined, "income")}>
              Add income
            </button>
            <button type="button" className="btn ghost" onClick={onSample}>
              Load an example month
            </button>
          </div>
        </section>
      ) : null}

      {pending.length > 0 ? (
        <section className="banner">
          <div>
            <strong>
              {pending.length} monthly {pending.length === 1 ? "item is" : "items are"} ready for {monthName}
            </strong>
            <p>{pending.map((item) => item.note || lookup(item.categoryId)?.name || "Item").join(", ")}</p>
          </div>
          <div className="banner-actions">
            <button type="button" className="btn primary small" onClick={onApplyPending}>
              Add them
            </button>
            <button type="button" className="btn ghost small" onClick={onSkipPending}>
              Skip this month
            </button>
          </div>
        </section>
      ) : null}

      <section className="stats">
        <article className="stat">
          <p className="stat-label">Spent</p>
          <p className="stat-value">{formatMoney(summary.spent)}</p>
          <p className="stat-hint">
            {summary.expenseCount === 0 ? "No expenses yet" : summary.expenseCount === 1 ? "1 expense" : `${summary.expenseCount} expenses`}
          </p>
        </article>
        <article className="stat" data-tone={summary.earned > 0 ? "good" : "neutral"}>
          <p className="stat-label">Income</p>
          <p className="stat-value">{formatMoney(summary.earned)}</p>
          <p className="stat-hint">
            {summary.incomeCount === 0 ? "Salary, refunds, side work" : summary.incomeCount === 1 ? "1 income entry" : `${summary.incomeCount} income entries`}
          </p>
        </article>
        <article className="stat" data-tone={budgetTone}>
          <p className="stat-label">{summary.budgetGap !== null && summary.budgetGap < 0 ? "Over budget" : "Budget left"}</p>
          <p className="stat-value">
            {summary.budgetGap === null
              ? "Not set"
              : formatMoney(Math.abs(summary.budgetGap))}
          </p>
          <p className="stat-hint">
            {summary.budgetLimit > 0 ? (
              `of ${formatMoney(summary.budgetLimit)}`
            ) : (
              <button type="button" className="text-btn" onClick={onOpenBudgets}>
                Set a monthly budget
              </button>
            )}
          </p>
        </article>
        <article className="stat" data-tone={room.tone}>
          <p className="stat-label">{room.label}</p>
          <p className="stat-value">{room.value}</p>
          <p className="stat-hint">{room.hint}</p>
        </article>
      </section>

      <section className="split">
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">{monthName}</h2>
            <span className="stat-hint">Tap a day</span>
          </div>
          <div className="dow" aria-hidden="true">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="cal-grid" role="grid" aria-label={`${monthName} calendar`}>
            {cells.map((day, index) =>
              day ? (
                <button
                  key={day.date}
                  type="button"
                  role="gridcell"
                  className={cx(
                    "cal-cell",
                    day.date === today && "today",
                    day.date === selectedDate && "selected",
                    day.date > today && "later",
                  )}
                  style={{ background: heat(day.spent, maxSpent) }}
                  aria-pressed={day.date === selectedDate}
                  aria-label={`${dayLabel(day.date)}, ${day.spent > 0 ? `${formatMoney(day.spent)} spent` : "no spending"}`}
                  onClick={() => onSelectDate(day.date)}
                >
                  <span className="cal-day">{Number(day.date.slice(8))}</span>
                  {day.spent > 0 ? (
                    <span className="cal-amt">{formatShort(day.spent)}</span>
                  ) : day.earned > 0 ? (
                    <span className="cal-amt in">+{formatShort(day.earned)}</span>
                  ) : (
                    <span className="cal-amt" />
                  )}
                </button>
              ) : (
                <div key={`blank-${index}`} className="cal-cell empty" />
              ),
            )}
          </div>
          <DayPanel
            today={today}
            selected={selected}
            onAdd={onAdd}
            onEdit={onEdit}
            onOpenEntries={onOpenEntries}
          />
        </div>
        <div className="stack">
          <BudgetPanel summary={summary} onOpenBudgets={onOpenBudgets} />
          <CategoryPanel summary={summary} />
        </div>
      </section>

      {summary.spent > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Each day</h2>
            <span className="stat-hint">Taller bars are heavier days</span>
          </div>
          <div className="daybars" role="list">
            {summary.byDay.map((day) => {
              const dayNumber = Number(day.date.slice(8));
              const showLabel = dayNumber === 1 || dayNumber === summary.daysInMonth || dayNumber % 5 === 0 || day.date === today;
              const height = day.spent <= 0 || maxSpent <= 0 ? 0 : Math.max(8, (Math.sqrt(day.spent) / Math.sqrt(maxSpent)) * 100);
              return (
                <button
                  key={day.date}
                  type="button"
                  className={cx("daybars-col", day.date === today && "today", day.date === selectedDate && "selected")}
                  aria-label={`${dayLabel(day.date)}, ${formatMoney(day.spent)}`}
                  onClick={() => onSelectDate(day.date)}
                >
                  <span className="fill-slot">
                    <span className="fill" style={{ height: `${height}%` }} />
                  </span>
                  <span className="daybars-label">{showLabel ? dayNumber : ""}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DayPanel({
  today,
  selected,
  onAdd,
  onEdit,
  onOpenEntries,
}: {
  today: string;
  selected: MonthSummary["byDay"][number] | null;
  onAdd: (date?: string, type?: TxType) => void;
  onEdit: (entry: Transaction) => void;
  onOpenEntries: (date: string) => void;
}) {
  const lookup = useCategoryLookup();
  if (!selected) {
    return (
      <div className="day-panel">
        <p className="lede">Select a day to see what you logged.</p>
      </div>
    );
  }
  return (
    <div className="day-panel">
      <div className="panel-head">
        <h3 className="panel-title">
          {longDayLabel(selected.date)}
          {selected.date === today ? <span className="pill">Today</span> : null}
        </h3>
        <button type="button" className="text-btn" onClick={() => onOpenEntries(selected.date)}>
          Open in entries
        </button>
      </div>
      <p className="stat-hint">
        {selected.spent > 0 ? `${formatMoney(selected.spent)} spent` : "No spending"}
        {selected.earned > 0 ? ` · ${formatMoney(selected.earned)} in` : ""}
      </p>
      {selected.transactions.length === 0 ? <p className="lede">Nothing on this day yet.</p> : null}
      <ul className="plain-list">
        {selected.transactions.map((entry) => {
          const category = lookup(entry.categoryId);
          return (
            <li key={entry.id}>
              <button type="button" className="tx-line" onClick={() => onEdit(entry)} title={entry.note || undefined}>
                <span className="cat-name">
                  <i className="dot" style={{ background: category?.color }} />
                  {category?.name ?? "Entry"}
                  {entry.note ? <span className="hint">{entry.note}</span> : null}
                </span>
                <span className={entry.type === "income" ? "money in" : "money out"}>
                  {entry.type === "income" ? "+" : "−"}
                  {formatMoney(entry.amount)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn small" onClick={() => onAdd(selected.date)}>
        Add to this day
      </button>
    </div>
  );
}

function BudgetPanel({ summary, onOpenBudgets }: { summary: MonthSummary; onOpenBudgets: () => void }) {
  if (summary.budgetLimit <= 0 || summary.usedRatio === null) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Budget</h2>
        </div>
        <p className="lede">Set a ceiling and Rozana will tell you what is left per day.</p>
        <button type="button" className="btn small" onClick={onOpenBudgets}>
          Set budget
        </button>
      </div>
    );
  }
  const ratio = summary.usedRatio;
  const hot = ratio >= 0.8 && ratio < 1;
  const over = ratio >= 1;
  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Budget</h2>
        <span className="stat-hint">{Math.round(ratio * 100)}%</span>
      </div>
      <div
        className="budget-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(ratio * 100))}
        aria-label="Monthly budget used"
      >
        <span className={cx(hot && "hot", over && "over")} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
      </div>
      <p className="stat-hint">
        {summary.budgetGap !== null && summary.budgetGap < 0
          ? `${formatMoney(Math.abs(summary.budgetGap))} over ${formatMoney(summary.budgetLimit)}`
          : `${formatMoney(summary.budgetGap ?? 0)} still inside ${formatMoney(summary.budgetLimit)}`}
      </p>
    </div>
  );
}

function CategoryPanel({ summary }: { summary: MonthSummary }) {
  const lookup = useCategoryLookup();
  const rows = summary.byCategory.slice(0, 6);
  const max = rows[0]?.amount ?? 0;
  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Where it went</h2>
      </div>
      {rows.length === 0 ? <p className="lede">Categories appear after the first expense.</p> : null}
      <div className="cat-list">
        {rows.map((row) => {
          const category = lookup(row.categoryId);
          const width = max > 0 ? Math.max(8, (row.amount / max) * 100) : 0;
          return (
            <div key={row.categoryId} className="cat-row">
              <span className="cat-name">
                <i className="dot" style={{ background: category?.color }} />
                {category?.name ?? row.categoryId}
              </span>
              <span className="money">{formatMoney(row.amount)}</span>
              <span className="track">
                <span style={{ width: `${width}%`, background: category?.color }} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function budgetToneFor(summary: MonthSummary): "neutral" | "good" | "warn" | "bad" {
  if (summary.budgetGap === null) return "neutral";
  if (summary.budgetGap < 0) return "bad";
  if (summary.usedRatio !== null && summary.usedRatio >= 0.8) return "warn";
  return "good";
}

function roomStat(summary: MonthSummary): { label: string; value: string; hint: string; tone: "neutral" | "good" | "warn" | "bad" } {
  if (summary.budgetLimit > 0 && summary.perDayLeft !== null && summary.daysLeftInclusive > 0) {
    if (summary.perDayLeft >= 0) {
      return {
        label: "Room per day",
        value: formatMoney(Math.round(summary.perDayLeft)),
        hint: `${summary.daysLeftInclusive} days left, including today`,
        tone: summary.usedRatio !== null && summary.usedRatio >= 0.8 ? "warn" : "good",
      };
    }
    return {
      label: "Room per day",
      value: formatMoney(0),
      hint: `${formatMoney(Math.abs(summary.budgetGap ?? 0))} over the monthly budget`,
      tone: "bad",
    };
  }
  return {
    label: "Daily average",
    value: summary.spent > 0 && summary.elapsedDays > 0 ? formatMoney(Math.round(summary.dailyAverage)) : "—",
    hint:
      summary.spent <= 0
        ? "No spending yet"
        : summary.elapsedDays <= 0
          ? "Logged before the month starts"
          : summary.isPastMonth
            ? `Across ${summary.elapsedDays} days`
            : `Across ${summary.elapsedDays} days so far`,
    tone: "neutral",
  };
}

function heat(spent: number, max: number): string | undefined {
  if (spent <= 0 || max <= 0) return undefined;
  const scale = Math.sqrt(spent) / Math.sqrt(max);
  return `rgba(223, 106, 50, ${(0.16 + scale * 0.62).toFixed(3)})`;
}
