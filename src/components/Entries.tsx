import { useState } from "react";
import { paymentLabel } from "../data/catalog";
import { useCategoryList, useCategoryLookup } from "../data/catalog-context";
import { dayLabel, monthLabel } from "../lib/dates";
import { downloadFile, toCsv } from "../lib/csv";
import { formatMoney } from "../lib/money";
import { cx } from "../lib/cx";
import type { Transaction, TxType } from "../types";
import { Icon } from "./Icon";

export function Entries({
  month,
  today,
  transactions,
  dayFilter,
  onClearDay,
  onEdit,
  onDelete,
  onAdd,
}: {
  month: string;
  today: string;
  transactions: Transaction[];
  dayFilter: string | null;
  onClearDay: () => void;
  onEdit: (entry: Transaction) => void;
  onDelete: (entry: Transaction) => void;
  onAdd: (date?: string, type?: TxType) => void;
}) {
  const [kind, setKind] = useState<"all" | TxType>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [query, setQuery] = useState("");
  const lookup = useCategoryLookup();
  const expenseCategories = useCategoryList("expense");
  const incomeCategories = useCategoryList("income");
  const monthName = monthLabel(month);

  const filtered = transactions.filter((entry) => {
    if (dayFilter && entry.date !== dayFilter) return false;
    if (kind !== "all" && entry.type !== kind) return false;
    if (categoryId !== "all" && entry.categoryId !== categoryId) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const category = lookup(entry.categoryId)?.name ?? "";
    return `${entry.note} ${category} ${entry.payment} ${entry.amount} ${entry.date}`.toLowerCase().includes(needle);
  });

  const groups = new Map<string, Transaction[]>();
  for (const entry of filtered) {
    const list = groups.get(entry.date) ?? [];
    list.push(entry);
    groups.set(entry.date, list);
  }
  const dates = [...groups.keys()];

  function exportView() {
    downloadFile(`rozana-${month}.csv`, toCsv(filtered), "text/csv;charset=utf-8");
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Entries</h1>
          <p className="lede">
            {filtered.length === transactions.length
              ? `${transactions.length} in ${monthName}, grouped by day.`
              : `${filtered.length} of ${transactions.length} shown.`}
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={exportView} disabled={filtered.length === 0}>
          <Icon name="download" />
          Export CSV
        </button>
      </header>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <span className="sr-only">Search entries</span>
          <input
            value={query}
            placeholder="Search note, category, amount"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="seg" role="group" aria-label="Filter by type">
          {(
            [
              ["all", "All"],
              ["expense", "Expenses"],
              ["income", "Income"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
        <label>
          <span className="sr-only">Category</span>
          <select className="select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="all">All categories</option>
            <optgroup label="Expenses">
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Income">
              {incomeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {dayFilter ? (
          <button type="button" className="pill" onClick={onClearDay}>
            {dayLabel(dayFilter)}
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>

      {transactions.length === 0 ? (
        <section className="empty">
          <h2>No entries in {monthName}</h2>
          <p>Add what you spent and it will show up here, one day at a time.</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => onAdd()}>
              Add an entry
            </button>
          </div>
        </section>
      ) : null}

      {transactions.length > 0 && filtered.length === 0 ? (
        <section className="empty">
          <h2>Nothing matches</h2>
          <p>Try another category, or clear the search.</p>
        </section>
      ) : null}

      {dates.map((date) => {
        const items = groups.get(date) ?? [];
        const spent = items.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
        const earned = items.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
        return (
          <section key={date} className="day-group">
            <div className="day-head">
              <h2>
                {dayLabel(date)}
                {date === today ? <span className="pill static">Today</span> : null}
              </h2>
              <div className="day-totals">
                {spent > 0 ? <span className="money out">{formatMoney(spent)}</span> : null}
                {earned > 0 ? <span className="money in">+{formatMoney(earned)}</span> : null}
              </div>
            </div>
            {items.map((entry) => {
              const category = lookup(entry.categoryId);
              return (
                <div key={entry.id} className="tx">
                  <button type="button" className="tx-main" onClick={() => onEdit(entry)}>
                    <span className="swatch" style={{ background: category?.color }} />
                    <span className="tx-copy">
                      <strong>{category?.name ?? "Entry"}</strong>
                      <span>
                        {entry.note ? `${entry.note} · ` : ""}
                        {paymentLabel(entry.payment)}
                      </span>
                    </span>
                    <span className={cx("tx-amount", entry.type === "income" ? "in" : "out")}>
                      {entry.type === "income" ? "+" : "−"}
                      {formatMoney(entry.amount)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${category?.name ?? "entry"} ${formatMoney(entry.amount)}`}
                    onClick={() => onDelete(entry)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
