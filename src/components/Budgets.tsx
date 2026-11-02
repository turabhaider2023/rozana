import { useEffect, useState } from "react";
import { categoriesFor, PAYMENT_OPTIONS } from "../data/catalog";
import { useCategoryList, useCategoryLookup, useCustomCategories } from "../data/catalog-context";
import { monthLabel } from "../lib/dates";
import { formatMoney, parseAmount } from "../lib/money";
import { cx } from "../lib/cx";
import type { MonthSummary } from "../lib/stats";
import type { CustomCategory, Payment, Recurring, RecurringInput, TxType } from "../types";
import { CategoryCreator } from "./CategoryCreator";

interface RecurringDraft {
  id: string | null;
  type: TxType;
  amount: string;
  categoryId: string;
  day: string;
  payment: Payment;
  note: string;
  active: boolean;
  alsoThisMonth: boolean;
}

export function Budgets({
  month,
  summary,
  recurring,
  onSetLimit,
  onSetCategory,
  onCreateRecurring,
  onUpdateRecurring,
  onToggleRecurring,
  onDeleteRecurring,
  onOpenData,
  onCreateCategory,
  onRemoveCategory,
}: {
  month: string;
  summary: MonthSummary;
  recurring: Recurring[];
  onSetLimit: (limit: number) => void;
  onSetCategory: (categoryId: string, limit: number) => void;
  onCreateRecurring: (input: RecurringInput, applyMonth: string | null) => boolean;
  onUpdateRecurring: (id: string, input: RecurringInput, active: boolean) => boolean;
  onToggleRecurring: (id: string, active: boolean) => void;
  onDeleteRecurring: (item: Recurring) => void;
  onOpenData: () => void;
  onCreateCategory: (name: string, kind: TxType, color: string) => { category: CustomCategory } | { error: string };
  onRemoveCategory: (id: string) => string | null;
}) {
  const [draft, setDraft] = useState<RecurringDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const monthName = monthLabel(month);
  const lookup = useCategoryLookup();
  const custom = useCustomCategories();
  const expenseCategories = useCategoryList("expense");

  function openNew() {
    setError(null);
    setDraft({
      id: null,
      type: "expense",
      amount: "",
      categoryId: "rent",
      day: "1",
      payment: "bank",
      note: "",
      active: true,
      alsoThisMonth: true,
    });
  }

  function openEdit(item: Recurring) {
    setError(null);
    setDraft({
      id: item.id,
      type: item.type,
      amount: String(item.amount),
      categoryId: item.categoryId,
      day: String(item.dayOfMonth),
      payment: item.payment,
      note: item.note,
      active: item.active,
      alsoThisMonth: false,
    });
  }

  function saveDraft() {
    if (!draft) return;
    const amount = parseAmount(draft.amount);
    const day = Number(draft.day);
    if (amount === null) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setError("Use a day from 1 to 31. Short months land on the last day.");
      return;
    }
    const input: RecurringInput = {
      type: draft.type,
      amount,
      categoryId: draft.categoryId,
      note: draft.note.trim(),
      payment: draft.payment,
      dayOfMonth: day,
    };
    const ok = draft.id
      ? onUpdateRecurring(draft.id, input, draft.active)
      : onCreateRecurring(input, draft.alsoThisMonth ? month : null);
    if (!ok) {
      setError("Check the amount, category, and day.");
      return;
    }
    setDraft(null);
    setError(null);
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="lede">A ceiling for {monthName}, plus the bills that come back every month.</p>
        </div>
        <button type="button" className="btn ghost" onClick={onOpenData}>
          Backup & import
        </button>
      </header>

      <section className="panel">
        <div className="limit-hero">
          <div>
            <p className="stat-label">Monthly budget</p>
            <p className="lede">Counts expenses only. Income stays separate, so salary does not hide spending.</p>
            {summary.budgetLimit > 0 && summary.usedRatio !== null ? (
              <>
                <div className="budget-bar" aria-hidden="true">
                  <span
                    className={cx(summary.usedRatio >= 0.8 && summary.usedRatio < 1 && "hot", summary.usedRatio >= 1 && "over")}
                    style={{ width: `${Math.min(summary.usedRatio * 100, 100)}%` }}
                  />
                </div>
                <p className="stat-hint">
                  {formatMoney(summary.spent)} spent
                  {summary.budgetGap !== null && summary.budgetGap < 0
                    ? ` · ${formatMoney(Math.abs(summary.budgetGap))} over`
                    : ` · ${formatMoney(summary.budgetGap ?? 0)} left`}
                </p>
              </>
            ) : null}
          </div>
          <label className="field">
            <span className="label">Limit for {monthName}</span>
            <MoneyField value={summary.budgetLimit} label="Monthly budget" onSave={onSetLimit} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Category caps</h2>
          <span className="stat-hint">Leave blank for no cap</span>
        </div>
        <div className="cap-list">
          {expenseCategories.map((category) => {
            const spent = summary.byCategory.find((row) => row.categoryId === category.id)?.amount ?? 0;
            const cap = summary.categoryLimits[category.id] ?? 0;
            const ratio = cap > 0 ? spent / cap : 0;
            return (
              <div key={category.id} className="cap-row">
                <div>
                  <div className="cat-name">
                    <i className="dot" style={{ background: category.color }} />
                    {category.name}
                  </div>
                  <p className={cx("stat-hint", ratio >= 1 && "over")}>
                    {spent > 0 ? `${formatMoney(spent)} spent` : "Nothing yet"}
                    {cap > 0 ? ` of ${formatMoney(cap)}` : ""}
                  </p>
                  {cap > 0 ? (
                    <span className="track">
                      <span
                        style={{
                          width: `${Math.min(ratio * 100, 100)}%`,
                          background: ratio >= 1 ? "#a33b32" : category.color,
                        }}
                      />
                    </span>
                  ) : null}
                </div>
                <MoneyField
                  value={cap}
                  label={`${category.name} cap`}
                  onSave={(limit) => onSetCategory(category.id, limit)}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Your categories</h2>
          {!addingCategory ? (
            <button type="button" className="btn small" onClick={() => setAddingCategory(true)}>
              New category
            </button>
          ) : null}
        </div>
        <p className="lede">Food, rent, and salary are already here. Add EMI, pets, SIP, or anything else you track.</p>
        {addingCategory ? (
          <CategoryCreator
            initialKind="expense"
            allowKind
            onCancel={() => setAddingCategory(false)}
            onCreate={onCreateCategory}
            onDone={() => {
              setAddingCategory(false);
              setCategoryError(null);
            }}
          />
        ) : null}
        {categoryError ? <p className="error-text">{categoryError}</p> : null}
        {custom.length === 0 ? <p className="stat-hint">No custom categories yet.</p> : null}
        <div className="custom-list">
          {custom.map((category) => (
            <div key={category.id} className="custom-row">
              <span className="cat-name">
                <i className="dot" style={{ background: category.color }} />
                {category.name}
                <span className="hint">{category.kind === "income" ? "Income" : "Expense"}</span>
              </span>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => setCategoryError(onRemoveCategory(category.id))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Every month</h2>
          <button type="button" className="btn small" onClick={openNew}>
            Add monthly item
          </button>
        </div>
        <p className="lede">Rent, salary, wifi. Add them once, then drop them into each new month from Home.</p>
        {draft ? (
          <RecurringForm
            draft={draft}
            error={error}
            onChange={(next) => {
              setDraft(next);
              setError(null);
            }}
            onCancel={() => {
              setDraft(null);
              setError(null);
            }}
            onSave={saveDraft}
          />
        ) : null}
        {recurring.length === 0 ? <p className="stat-hint">No monthly items yet.</p> : null}
        <div className="rec-list">
          {recurring.map((item) => {
            const category = lookup(item.categoryId);
            return (
              <article key={item.id} className={cx("rec", !item.active && "paused")}>
                <div>
                  <strong>{item.note || category?.name}</strong>
                  <p className="stat-hint">
                    {category?.name} · day {item.dayOfMonth} · {item.payment.toUpperCase()} ·{" "}
                    {item.type === "income" ? "income" : "expense"}
                  </p>
                </div>
                <div className="rec-actions">
                  <span className={item.type === "income" ? "money in" : "money"}>{formatMoney(item.amount)}</span>
                  <button
                    type="button"
                    className={cx("switch", item.active && "on")}
                    aria-pressed={item.active}
                    onClick={() => onToggleRecurring(item.id, !item.active)}
                  >
                    {item.active ? "On" : "Paused"}
                  </button>
                  <button type="button" className="btn small ghost" onClick={() => openEdit(item)}>
                    Edit
                  </button>
                  <button type="button" className="btn small danger" onClick={() => onDeleteRecurring(item)}>
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RecurringForm({
  draft,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  draft: RecurringDraft;
  error: string | null;
  onChange: (draft: RecurringDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const custom = useCustomCategories();
  const options = categoriesFor(draft.type, custom);
  return (
    <form
      className="rec-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="seg" role="group" aria-label="Monthly item type">
        <button
          type="button"
          aria-pressed={draft.type === "expense"}
          onClick={() =>
            onChange({
              ...draft,
              type: "expense",
              categoryId: categoriesFor("expense", custom).some((category) => category.id === draft.categoryId)
                ? draft.categoryId
                : "rent",
            })
          }
        >
          Expense
        </button>
        <button
          type="button"
          aria-pressed={draft.type === "income"}
          onClick={() =>
            onChange({
              ...draft,
              type: "income",
              categoryId: categoriesFor("income", custom).some((category) => category.id === draft.categoryId)
                ? draft.categoryId
                : "salary",
            })
          }
        >
          Income
        </button>
      </div>
      <div className="split-fields">
        <label className="field">
          <span className="label">Amount</span>
          <input
            inputMode="decimal"
            value={draft.amount}
            placeholder="0"
            onChange={(event) => onChange({ ...draft, amount: event.target.value })}
          />
        </label>
        <label className="field">
          <span className="label">Day of month</span>
          <input
            type="number"
            min={1}
            max={31}
            value={draft.day}
            onChange={(event) => onChange({ ...draft, day: event.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span className="label">Category</span>
        <select
          className="select"
          value={draft.categoryId}
          onChange={(event) => onChange({ ...draft, categoryId: event.target.value })}
        >
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Payment</span>
        <select
          className="select"
          value={draft.payment}
          onChange={(event) => onChange({ ...draft, payment: event.target.value as Payment })}
        >
          {PAYMENT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Note</span>
        <input
          value={draft.note}
          maxLength={160}
          placeholder="House rent"
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
        />
      </label>
      {draft.id ? (
        <label className="check">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => onChange({ ...draft, active: event.target.checked })}
          />
          <span>Keep adding this in future months</span>
        </label>
      ) : (
        <label className="check">
          <input
            type="checkbox"
            checked={draft.alsoThisMonth}
            onChange={(event) => onChange({ ...draft, alsoThisMonth: event.target.checked })}
          />
          <span>Also add it to this month</span>
        </label>
      )}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Save monthly item
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function MoneyField({ value, onSave, label }: { value: number; onSave: (value: number) => void; label: string }) {
  const [raw, setRaw] = useState(value ? String(value) : "");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setRaw(value ? String(value) : "");
    setInvalid(false);
  }, [value]);

  return (
    <input
      aria-label={label}
      inputMode="decimal"
      placeholder="No limit"
      className={invalid ? "invalid" : undefined}
      value={raw}
      onChange={(event) => {
        setRaw(event.target.value);
        setInvalid(false);
      }}
      onBlur={() => {
        if (!raw.trim()) {
          if (value !== 0) onSave(0);
          return;
        }
        const parsed = parseAmount(raw, true);
        if (parsed === null) {
          setInvalid(true);
          setRaw(value ? String(value) : "");
          return;
        }
        if (parsed !== value) onSave(parsed);
      }}
    />
  );
}
