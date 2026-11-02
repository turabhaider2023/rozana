import { useEffect, useMemo, useRef, useState } from "react";
import { Budgets } from "./components/Budgets";
import { DataDialog } from "./components/DataDialog";
import { Entries } from "./components/Entries";
import { Icon } from "./components/Icon";
import { Insights } from "./components/Insights";
import { Modal } from "./components/Modal";
import { MonthSwitcher } from "./components/MonthSwitcher";
import { Overview } from "./components/Overview";
import { NAV_ITEMS, Sidebar } from "./components/Sidebar";
import { TransactionModal } from "./components/TransactionModal";
import { getCategory } from "./data/catalog";
import { CatalogProvider } from "./data/catalog-context";
import { useLedger } from "./hooks/useLedger";
import { cx } from "./lib/cx";
import { downloadFile, parseCsv, toCsv } from "./lib/csv";
import { currentMonth, dayLabel, isValidMonth, monthLabel, shiftMonth, todayKey } from "./lib/dates";
import { compareEntries } from "./lib/entries";
import { formatMoney } from "./lib/money";
import { preferredSampleMonth } from "./lib/sample";
import { readSession, writeSession } from "./lib/session";
import { buildSummary, pendingRecurring } from "./lib/stats";
import { normalizeState } from "./lib/storage";
import type { LedgerState, Transaction, TransactionInput, TxType, View } from "./types";

interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface ToastState {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

type ModalState =
  | { mode: "closed" }
  | { mode: "create"; date: string; type: TxType }
  | { mode: "edit"; transaction: Transaction };

function readInitialMonth(): string {
  const saved = readSession("rozana.month");
  if (saved && isValidMonth(saved)) return saved;
  return currentMonth();
}

function dateForMonth(month: string, transactions: Transaction[]): string | null {
  const today = todayKey();
  if (today.startsWith(month)) return today;
  let latest: string | null = null;
  for (const entry of transactions) {
    if (entry.date.startsWith(month) && (!latest || entry.date > latest)) latest = entry.date;
  }
  return latest;
}

function readInitialView(): View {
  const saved = readSession("rozana.view");
  if (saved === "home" || saved === "entries" || saved === "budgets" || saved === "insights") return saved;
  return "home";
}

export default function App() {
  const ledger = useLedger();
  const [month, setMonth] = useState(readInitialMonth);
  const [view, setView] = useState<View>(readInitialView);
  const [selectedDate, setSelectedDate] = useState<string | null>(() =>
    dateForMonth(readInitialMonth(), ledger.state.transactions),
  );
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [dataOpen, setDataOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastId = useRef(0);
  const today = todayKey();

  const summary = useMemo(() => buildSummary(ledger.state, month, today), [ledger.state, month, today]);
  const pending = useMemo(() => pendingRecurring(ledger.state, month), [ledger.state, month]);
  const monthTransactions = useMemo(
    () => ledger.state.transactions.filter((entry) => entry.date.startsWith(month)).sort(compareEntries),
    [ledger.state.transactions, month],
  );
  const hasSample =
    ledger.state.transactions.some((entry) => entry.sample) || ledger.state.recurring.some((item) => item.sample);
  const displayName = ledger.state.settings.displayName.trim();
  const budgetDetail =
    summary.budgetGap === null
      ? "No budget yet"
      : summary.budgetGap >= 0
        ? `${formatMoney(summary.budgetGap)} left in budget`
        : `${formatMoney(Math.abs(summary.budgetGap))} over budget`;

  const openCreateRef = useRef<(date?: string, type?: TxType) => void>(() => undefined);

  function showToast(message: string, action?: ToastState["action"]) {
    toastId.current += 1;
    setToast({ id: toastId.current, message, action });
  }

  function goMonth(next: string) {
    if (!isValidMonth(next)) return;
    setMonth(next);
    setDayFilter(null);
    setSelectedDate(dateForMonth(next, ledger.state.transactions));
  }

  function openCreate(date?: string, type: TxType = "expense") {
    const current = todayKey();
    const inMonth = selectedDate && selectedDate.startsWith(month) ? selectedDate : null;
    const fallback = current.startsWith(month) ? current : `${month}-01`;
    setDataOpen(false);
    setModal({ mode: "create", date: date ?? inMonth ?? fallback, type });
  }

  openCreateRef.current = openCreate;

  function openEdit(entry: Transaction) {
    setDataOpen(false);
    setModal({ mode: "edit", transaction: entry });
  }

  function handleCreate(input: TransactionInput, repeat: boolean) {
    if (!ledger.addEntry(input, repeat)) {
      showToast("That entry could not be saved.");
      return;
    }
    setMonth(input.date.slice(0, 7));
    setSelectedDate(input.date);
    setDayFilter(null);
    setModal({ mode: "closed" });
    showToast(repeat ? "Saved, and set to repeat each month." : "Entry saved.");
  }

  function handleUpdate(id: string, input: TransactionInput) {
    if (!ledger.updateEntry(id, input)) {
      showToast("That entry could not be saved.");
      return;
    }
    setMonth(input.date.slice(0, 7));
    setSelectedDate(input.date);
    setModal({ mode: "closed" });
    showToast("Entry updated.");
  }

  function requestDelete(entry: Transaction) {
    const category = getCategory(entry.categoryId, ledger.state.categories)?.name ?? "Entry";
    setConfirm({
      title: "Remove this entry?",
      body: `${formatMoney(entry.amount)} · ${category} · ${dayLabel(entry.date)}. You can undo it for a few seconds.`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => {
        ledger.deleteTransaction(entry.id);
        setConfirm(null);
        setModal({ mode: "closed" });
        showToast("Entry removed.", {
          label: "Undo",
          onClick: () => ledger.restoreTransaction(entry),
        });
      },
    });
  }

  function runSample() {
    const current = todayKey();
    const result = ledger.loadSample(current);
    if (result.added === 0) {
      showToast("Example entries are already on this device.");
      return;
    }
    const next = preferredSampleMonth(current);
    setMonth(next);
    setSelectedDate(current.startsWith(next) ? current : null);
    setDayFilter(null);
    setView("home");
    showToast("Example month added. Open this month to log today, or stay and look around.");
  }

  function requestSample() {
    if (ledger.state.transactions.length > 0) {
      setDataOpen(false);
      setConfirm({
        title: "Add example entries?",
        body: "A sample month will sit beside your own entries. You can remove the untouched example later.",
        confirmLabel: "Add example",
        onConfirm: () => {
          setConfirm(null);
          runSample();
        },
      });
      return;
    }
    setDataOpen(false);
    runSample();
  }

  function requestReset() {
    setDataOpen(false);
    setConfirm({
      title: "Erase everything on this browser?",
      body: "Entries, budgets, and monthly items saved here will be deleted.",
      confirmLabel: "Erase",
      danger: true,
      onConfirm: () => {
        ledger.resetAll();
        const current = currentMonth();
        setMonth(current);
        setSelectedDate(todayKey());
        setDayFilter(null);
        setView("home");
        setConfirm(null);
        showToast("All data erased from this browser.");
      },
    });
  }

  function handleBackup(text: string) {
    let next: LedgerState | null = null;
    try {
      next = normalizeState(JSON.parse(text) as unknown);
    } catch {
      next = null;
    }
    if (!next) {
      showToast("That file isn't a Rozana backup.");
      return;
    }
    const parsed = next;
    setDataOpen(false);
    setConfirm({
      title: "Replace everything with this backup?",
      body: `${parsed.transactions.length} entries will replace what is saved in this browser.`,
      confirmLabel: "Replace",
      danger: true,
      onConfirm: () => {
        ledger.replaceAll(parsed);
        setConfirm(null);
        showToast("Backup restored.");
      },
    });
  }

  function handleCsv(text: string) {
    const result = parseCsv(text, ledger.state.categories);
    if (result.transactions.length === 0) {
      showToast(result.reason ?? "Nothing in that file could be imported.");
      return;
    }
    const imported = ledger.importTransactions(result.transactions);
    const parts = [`Added ${imported.added}`];
    if (imported.duplicates) parts.push(`${imported.duplicates} duplicates skipped`);
    if (result.skipped) parts.push(`${result.skipped} invalid rows skipped`);
    if (result.truncated) parts.push("stopped after 5,000 rows");
    setDataOpen(false);
    showToast(`${parts.join(". ")}.`);
  }

  useEffect(() => {
    document.title = `Rozana · ${monthLabel(month)}`;
    writeSession("rozana.month", month);
  }, [month]);

  useEffect(() => {
    if (selectedDate?.startsWith(month)) return;
    const nextDate = dateForMonth(month, ledger.state.transactions);
    if (nextDate) setSelectedDate(nextDate);
  }, [month, ledger.state.transactions, selectedDate]);

  useEffect(() => {
    writeSession("rozana.view", view);
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, toast.action ? 7000 : 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const locked = modal.mode !== "closed" || dataOpen || confirm !== null;
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modal, dataOpen, confirm]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (event.key === "Escape") {
        if (confirm) {
          setConfirm(null);
          return;
        }
        if (dataOpen) {
          setDataOpen(false);
          return;
        }
        if (modal.mode !== "closed") setModal({ mode: "closed" });
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== "n") return;
      if (confirm || dataOpen || modal.mode !== "closed") return;
      event.preventDefault();
      openCreateRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, dataOpen, modal]);

  const createInitial: TransactionInput | null =
    modal.mode === "create"
      ? {
          type: modal.type,
          amount: 0,
          categoryId: modal.type === "income" ? "salary" : "food",
          date: modal.date,
          note: "",
          payment: modal.type === "income" ? "bank" : "upi",
        }
      : null;

  return (
    <CatalogProvider categories={ledger.state.categories}>
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Sidebar
        view={view}
        name={ledger.state.settings.displayName}
        spent={summary.spent}
        detail={budgetDetail}
        onView={setView}
        onName={ledger.setDisplayName}
        onOpenData={() => setDataOpen(true)}
      />
      <div className="workspace">
        <header className="topbar">
          <MonthSwitcher month={month} onChange={goMonth} />
          <div className="top-actions">
            <button type="button" className="icon-btn" aria-label="Backup and import" onClick={() => setDataOpen(true)}>
              <Icon name="download" />
            </button>
            <button type="button" className="btn primary" aria-keyshortcuts="n" onClick={() => openCreate()}>
              <Icon name="plus" />
              <span className="add-label">Add</span>
              <span className="kbd">N</span>
            </button>
          </div>
        </header>
        <main className="content" id="main">
          {ledger.persistError ? (
            <div className="banner warn">
              <div>
                <strong>Could not save.</strong>
                <p>{ledger.persistError}</p>
              </div>
            </div>
          ) : null}
          {ledger.corrupt ? (
            <div className="banner warn">
              <div>
                <strong>Saved data could not be read.</strong>
                <p>Rozana started fresh. A recovery copy is still in this browser.</p>
              </div>
              <div className="banner-actions">
                <button type="button" className="btn small" onClick={() => ledger.downloadRecovery()}>
                  Download copy
                </button>
                <button type="button" className="btn ghost small" onClick={ledger.dismissCorrupt}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {view === "home" ? (
            <Overview
              month={month}
              today={today}
              name={displayName}
              summary={summary}
              pending={pending}
              selectedDate={selectedDate}
              allEmpty={ledger.state.transactions.length === 0}
              onSelectDate={setSelectedDate}
              onAdd={openCreate}
              onEdit={openEdit}
              onOpenEntries={(date) => {
                setSelectedDate(date);
                setDayFilter(date);
                setView("entries");
              }}
              onOpenBudgets={() => setView("budgets")}
              onSample={requestSample}
              onApplyPending={() => {
                const count = ledger.applyPending(month);
                showToast(count ? `Added ${count} monthly ${count === 1 ? "item" : "items"}.` : "Nothing waiting for this month.");
              }}
              onSkipPending={() => {
                const count = ledger.skipPending(month);
                showToast(count ? "Skipped for this month. They come back next month." : "Nothing waiting for this month.");
              }}
            />
          ) : null}

          {view === "entries" ? (
            <Entries
              month={month}
              today={today}
              transactions={monthTransactions}
              dayFilter={dayFilter}
              onClearDay={() => setDayFilter(null)}
              onEdit={openEdit}
              onDelete={requestDelete}
              onAdd={openCreate}
            />
          ) : null}

          {view === "budgets" ? (
            <Budgets
              month={month}
              summary={summary}
              recurring={ledger.state.recurring}
              onSetLimit={(limit) => ledger.setMonthLimit(month, limit)}
              onSetCategory={(categoryId, limit) => ledger.setCategoryLimit(month, categoryId, limit)}
              onCreateRecurring={ledger.addRecurring}
              onUpdateRecurring={ledger.updateRecurring}
              onToggleRecurring={ledger.setRecurringActive}
              onDeleteRecurring={(item) => {
                const category = getCategory(item.categoryId, ledger.state.categories)?.name ?? "Item";
                setConfirm({
                  title: "Remove this monthly item?",
                  body: `${item.note || category} will stop repeating. Entries already added stay in their months.`,
                  confirmLabel: "Remove",
                  danger: true,
                  onConfirm: () => {
                    ledger.deleteRecurring(item.id);
                    setConfirm(null);
                    showToast("Monthly item removed.");
                  },
                });
              }}
              onOpenData={() => setDataOpen(true)}
              onCreateCategory={ledger.addCategory}
              onRemoveCategory={ledger.removeCategory}
            />
          ) : null}

          {view === "insights" ? (
            <Insights
              summary={summary}
              monthName={monthLabel(month)}
              previousName={monthLabel(shiftMonth(month, -1))}
              onEdit={openEdit}
              onAdd={() => openCreate()}
            />
          ) : null}
        </main>
      </div>

      <nav className="tabbar" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? "active" : undefined}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => setView(item.id)}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>

      {modal.mode === "edit" ? (
        <TransactionModal
          key={modal.transaction.id}
          mode="edit"
          recurring={Boolean(modal.transaction.recurringId)}
          initial={{
            type: modal.transaction.type,
            amount: modal.transaction.amount,
            categoryId: modal.transaction.categoryId,
            date: modal.transaction.date,
            note: modal.transaction.note,
            payment: modal.transaction.payment,
          }}
          onClose={() => setModal({ mode: "closed" })}
          onSubmit={(input) => handleUpdate(modal.transaction.id, input)}
          onDelete={() => requestDelete(modal.transaction)}
          onCreateCategory={ledger.addCategory}
        />
      ) : null}
      {modal.mode === "create" && createInitial ? (
        <TransactionModal
          key={`new-${modal.type}-${modal.date}`}
          mode="create"
          recurring={false}
          initial={createInitial}
          onClose={() => setModal({ mode: "closed" })}
          onSubmit={handleCreate}
          onCreateCategory={ledger.addCategory}
        />
      ) : null}

      {dataOpen ? (
        <DataDialog
          name={ledger.state.settings.displayName}
          hasSample={hasSample}
          onName={ledger.setDisplayName}
          onClose={() => setDataOpen(false)}
          onExportJson={() =>
            downloadFile(
              `rozana-backup-${today}.json`,
              JSON.stringify(ledger.state, null, 2),
              "application/json",
            )
          }
          onExportCsv={() => downloadFile(`rozana-${today}.csv`, toCsv(ledger.state.transactions), "text/csv;charset=utf-8")}
          onImportJson={handleBackup}
          onImportCsv={handleCsv}
          onLoadSample={requestSample}
          onClearSample={() => {
            const count = ledger.clearSample();
            setDataOpen(false);
            showToast(count ? "Example entries removed." : "No example entries to remove.");
          }}
          onReset={requestReset}
          onError={showToast}
        />
      ) : null}

      {confirm ? (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="lede">{confirm.body}</p>
          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button type="button" className={cx("btn", confirm.danger ? "danger" : "primary")} onClick={confirm.onConfirm}>
              {confirm.confirmLabel}
            </button>
          </div>
        </Modal>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              className="btn small"
              onClick={() => {
                toast.action?.onClick();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
    </CatalogProvider>
  );
}
