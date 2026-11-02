import { isValidMonth, shiftMonth } from "../lib/dates";
import { Icon } from "./Icon";

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="month-switch">
      <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        <Icon name="left" />
      </button>
      <label className="month-field">
        <span className="sr-only">Choose month</span>
        <input
          type="month"
          value={month}
          onChange={(event) => {
            if (isValidMonth(event.target.value)) onChange(event.target.value);
          }}
        />
      </label>
      <button type="button" className="icon-btn" aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))}>
        <Icon name="right" />
      </button>
    </div>
  );
}
