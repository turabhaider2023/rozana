import type { View } from "../types";
import { formatMoney } from "../lib/money";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";

export const NAV_ITEMS: { id: View; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "entries", label: "Entries", icon: "list" },
  { id: "budgets", label: "Budgets", icon: "target" },
  { id: "insights", label: "Insights", icon: "spark" },
];

export function Sidebar({
  view,
  name,
  spent,
  detail,
  onView,
  onName,
  onOpenData,
}: {
  view: View;
  name: string;
  spent: number;
  detail: string;
  onView: (view: View) => void;
  onName: (name: string) => void;
  onOpenData: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-mark">Rz</span>
        <span className="logo-text">
          <strong>Rozana</strong>
          <small>Daily expense ledger</small>
        </span>
      </div>
      <nav className="nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cx("nav-btn", view === item.id && "active")}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => onView(item.id)}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="side-foot">
        <div className="side-card">
          <p className="side-label">This month</p>
          <p className="side-strong">{formatMoney(spent)}</p>
          <p className="side-meta">{detail}</p>
        </div>
        <label className="name-field">
          <span>Your name</span>
          <input
            value={name}
            maxLength={32}
            placeholder="Add your name"
            onChange={(event) => onName(event.target.value)}
          />
        </label>
        <button type="button" className="btn ghost" onClick={onOpenData}>
          Backup & import
        </button>
        <p className="quiet">Saved on this device. Nothing is uploaded.</p>
      </div>
    </aside>
  );
}
