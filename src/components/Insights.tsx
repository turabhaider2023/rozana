import { paymentLabel } from "../data/catalog";
import { useCategoryLookup, useCustomCategories } from "../data/catalog-context";
import { dayLabel } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { monthNarrative, type MonthSummary } from "../lib/stats";
import type { Transaction } from "../types";

export function Insights({
  summary,
  monthName,
  previousName,
  onEdit,
  onAdd,
}: {
  summary: MonthSummary;
  monthName: string;
  previousName: string;
  onEdit: (entry: Transaction) => void;
  onAdd: () => void;
}) {
  const custom = useCustomCategories();
  const lookup = useCategoryLookup();
  const narrative = monthNarrative(summary, monthName, previousName, custom);
  const weekdayMax = Math.max(...summary.weekday.map((point) => point.average), 0);
  const paymentMax = summary.byPayment[0]?.amount ?? 0;
  const empty = summary.expenseCount === 0 && summary.incomeCount === 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="lede">What {monthName} is saying, compared with {previousName}.</p>
        </div>
      </header>
      <p className="narrative">{narrative}</p>

      <section className="insight-grid">
        <article className="stat">
          <p className="stat-label">This month</p>
          <p className="stat-value">{formatMoney(summary.spent)}</p>
          <p className="stat-hint">{summary.expenseCount === 1 ? "1 expense" : `${summary.expenseCount} expenses`}</p>
        </article>
        <article className="stat">
          <p className="stat-label">{previousName}</p>
          <p className="stat-value">{summary.previousSpent > 0 ? formatMoney(summary.previousSpent) : "—"}</p>
          <p className="stat-hint">{summary.previousSpent > 0 ? "Spent last month" : "No expenses that month"}</p>
        </article>
        <article className="stat" data-tone={paceTone(summary)}>
          <p className="stat-label">{summary.projectedIsPace ? "Projected" : "Logged"}</p>
          <p className="stat-value">{formatMoney(summary.projected)}</p>
          <p className="stat-hint">
            {summary.projectedIsPace ? "If the rest of the month matches the pace so far" : "Already written into this month"}
          </p>
        </article>
      </section>

      {empty ? (
        <section className="empty">
          <h2>Nothing to explain yet</h2>
          <p>Add a few days of spending and this page will compare categories, weekdays, and last month.</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={onAdd}>
              Add an entry
            </button>
          </div>
        </section>
      ) : null}

      {summary.expenseCount > 0 ? (
        <section className="split">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Weekday pace</h2>
              <span className="stat-hint">Average per day</span>
            </div>
            <div className="cat-list">
              {summary.weekday.map((point) => (
                <div key={point.label} className="cat-row">
                  <span className="cat-name">{point.label}</span>
                  <span className="money">{formatMoney(point.average)}</span>
                  <span className="track">
                    <span style={{ width: `${weekdayMax > 0 ? Math.max(4, (point.average / weekdayMax) * 100) : 0}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title">How you paid</h2>
              </div>
              <div className="cat-list">
                {summary.byPayment.map((row) => (
                  <div key={row.payment} className="cat-row">
                    <span className="cat-name">{paymentLabel(row.payment)}</span>
                    <span className="money">{formatMoney(row.amount)}</span>
                    <span className="track">
                      <span style={{ width: `${paymentMax > 0 ? (row.amount / paymentMax) * 100 : 0}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {summary.incomeByCategory.length > 0 ? (
              <div className="panel">
                <div className="panel-head">
                  <h2 className="panel-title">Income</h2>
                </div>
                <div className="cat-list">
                  {summary.incomeByCategory.map((row) => (
                    <div key={row.categoryId} className="cat-row">
                      <span className="cat-name">{lookup(row.categoryId)?.name ?? row.categoryId}</span>
                      <span className="money in">+{formatMoney(row.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {summary.topExpenses.length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Largest expenses</h2>
          </div>
          <ul className="plain-list">
            {summary.topExpenses.map((entry) => {
              const category = lookup(entry.categoryId);
              return (
                <li key={entry.id}>
                  <button type="button" className="tx-line" onClick={() => onEdit(entry)}>
                    <span className="cat-name">
                      <i className="dot" style={{ background: category?.color }} />
                      <span className="tx-copy">
                        <strong>{entry.note || category?.name}</strong>
                        <span>
                          {entry.note ? category?.name : paymentLabel(entry.payment)} · {dayLabel(entry.date)}
                        </span>
                      </span>
                    </span>
                    <span className="money out">−{formatMoney(entry.amount)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function paceTone(summary: MonthSummary): "neutral" | "good" | "warn" | "bad" {
  if (summary.budgetLimit <= 0) return "neutral";
  if (summary.projected > summary.budgetLimit) return "bad";
  if (summary.projected > summary.budgetLimit * 0.8) return "warn";
  return "good";
}
