import { useState } from "react";
import { CATEGORY_COLORS } from "../data/catalog";
import type { CustomCategory, TxType } from "../types";

export function CategoryCreator({
  initialKind,
  allowKind = false,
  onCancel,
  onCreate,
  onDone,
}: {
  initialKind: TxType;
  allowKind?: boolean;
  onCancel?: () => void;
  onCreate: (name: string, kind: TxType, color: string) => { category: CustomCategory } | { error: string };
  onDone: (category: CustomCategory) => void;
}) {
  const [kind, setKind] = useState<TxType>(initialKind);
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const result = onCreate(name, allowKind ? kind : initialKind, color);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setName("");
    setError(null);
    onDone(result.category);
  }

  return (
    <div className="new-category">
      {allowKind ? (
        <div className="seg" role="group" aria-label="Category type">
          <button type="button" aria-pressed={kind === "expense"} onClick={() => setKind("expense")}>
            Expense
          </button>
          <button type="button" aria-pressed={kind === "income"} onClick={() => setKind("income")}>
            Income
          </button>
        </div>
      ) : null}
      <label className="field">
        <span className="label">Category name</span>
        <input
          value={name}
          maxLength={24}
          placeholder="EMI, pets, SIP…"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
      </label>
      <div className="swatches" role="group" aria-label="Category color">
        {CATEGORY_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className="swatch-btn"
            style={{ background: swatch }}
            aria-label={`Color ${swatch}`}
            aria-pressed={color === swatch}
            onClick={() => setColor(swatch)}
          />
        ))}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="form-actions">
        <button type="button" className="btn primary small" onClick={save}>
          Add category
        </button>
        {onCancel ? (
          <button type="button" className="btn ghost small" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
