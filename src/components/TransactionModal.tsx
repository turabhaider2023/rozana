import { useEffect, useRef, useState, type FormEvent } from "react";
import { categoriesFor, PAYMENT_OPTIONS } from "../data/catalog";
import { useCategoryList, useCustomCategories } from "../data/catalog-context";
import { isValidDateKey } from "../lib/dates";
import { parseAmount } from "../lib/money";
import type { CustomCategory, Payment, TransactionInput, TxType } from "../types";
import { CategoryCreator } from "./CategoryCreator";
import { Modal } from "./Modal";

export function TransactionModal({
  mode,
  initial,
  recurring,
  onClose,
  onSubmit,
  onDelete,
  onCreateCategory,
}: {
  mode: "create" | "edit";
  initial: TransactionInput;
  recurring: boolean;
  onClose: () => void;
  onSubmit: (input: TransactionInput, repeat: boolean) => void;
  onDelete?: () => void;
  onCreateCategory: (name: string, kind: TxType, color: string) => { category: CustomCategory } | { error: string };
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<TxType>(initial.type);
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : "");
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [date, setDate] = useState(initial.date);
  const [payment, setPayment] = useState<Payment>(initial.payment);
  const [note, setNote] = useState(initial.note);
  const [repeat, setRepeat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const custom = useCustomCategories();
  const options = useCategoryList(type);
  const day = Number(date.slice(8, 10));

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  function chooseType(next: TxType) {
    setType(next);
    const nextOptions = categoriesFor(next, custom);
    if (!nextOptions.some((category) => category.id === categoryId)) {
      setCategoryId(nextOptions[0]?.id ?? "");
    }
    if (next === "income" && payment === "upi") setPayment("bank");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setError("Enter an amount greater than zero.");
      amountRef.current?.focus();
      return;
    }
    if (!isValidDateKey(date)) {
      setError("Choose a valid date.");
      return;
    }
    if (!options.some((category) => category.id === categoryId)) {
      setError("Choose a category.");
      return;
    }
    setError(null);
    onSubmit(
      { type, amount: parsed, categoryId, date, note: note.trim(), payment },
      mode === "create" && repeat,
    );
  }

  return (
    <Modal
      title={mode === "create" ? "New entry" : "Edit entry"}
      subtitle={mode === "create" ? "Saved in this browser and added to the month right away." : "Update this entry. The month totals change immediately."}
      onClose={onClose}
    >
      <form className="stack" onSubmit={handleSubmit} noValidate>
        <div className="seg" role="group" aria-label="Entry type">
          <button type="button" aria-pressed={type === "expense"} onClick={() => chooseType("expense")}>
            Expense
          </button>
          <button type="button" aria-pressed={type === "income"} onClick={() => chooseType("income")}>
            Income
          </button>
        </div>
        <label className="field">
          <span className="label">Amount</span>
          <span className="amount-wrap">
            <span aria-hidden="true">₹</span>
            <input
              ref={amountRef}
              className="amount-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              aria-label="Amount in rupees"
              onChange={(event) => {
                setAmount(event.target.value);
                setError(null);
              }}
            />
          </span>
        </label>
        <div className="field">
          <span className="label">Category</span>
          <div className="chips">
            {options.map((category) => (
              <button
                key={category.id}
                type="button"
                className="chip"
                aria-pressed={category.id === categoryId}
                title={category.hint}
                onClick={() => setCategoryId(category.id)}
              >
                <i className="dot" style={{ background: category.color }} />
                {category.name}
              </button>
            ))}
          </div>
          {addingCategory ? (
            <CategoryCreator
              initialKind={type}
              onCancel={() => setAddingCategory(false)}
              onCreate={onCreateCategory}
              onDone={(category) => {
                setCategoryId(category.id);
                setAddingCategory(false);
              }}
            />
          ) : (
            <button type="button" className="text-btn" onClick={() => setAddingCategory(true)}>
              New category
            </button>
          )}
        </div>
        <div className="split-fields">
          <label className="field">
            <span className="label">Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <div className="field">
            <span className="label">Payment</span>
            <div className="seg grid4" role="group" aria-label="Payment method">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={payment === option.id}
                  onClick={() => setPayment(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="field">
          <span className="label">Note</span>
          <input
            value={note}
            maxLength={160}
            placeholder="Lunch, rent, recharge…"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {mode === "create" ? (
          <label className="check">
            <input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} />
            <span>Repeat on day {Number.isFinite(day) && day > 0 ? day : "—"} of every month</span>
          </label>
        ) : null}
        {mode === "edit" && recurring ? (
          <p className="hint">This came from a monthly item. Saving changes only this date. Edit the repeat under Budgets.</p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
        <div className={onDelete ? "modal-foot split" : "modal-foot"}>
          {onDelete ? (
            <button type="button" className="btn danger" onClick={onDelete}>
              Remove
            </button>
          ) : null}
          <button type="submit" className="btn primary">
            Save entry
          </button>
        </div>
      </form>
    </Modal>
  );
}
