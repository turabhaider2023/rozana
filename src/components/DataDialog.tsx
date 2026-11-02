import { useRef } from "react";
import { Modal } from "./Modal";

export function DataDialog({
  name,
  hasSample,
  onName,
  onClose,
  onExportJson,
  onExportCsv,
  onImportJson,
  onImportCsv,
  onLoadSample,
  onClearSample,
  onReset,
  onError,
}: {
  name: string;
  hasSample: boolean;
  onName: (name: string) => void;
  onClose: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onImportJson: (text: string) => void;
  onImportCsv: (text: string) => void;
  onLoadSample: () => void;
  onClearSample: () => void;
  onReset: () => void;
  onError: (message: string) => void;
}) {
  const jsonRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  async function readFile(file: File | undefined, done: (text: string) => void) {
    if (!file) return;
    if (file.size > 2_000_000) {
      onError("That file is too large.");
      return;
    }
    done(await file.text());
  }

  return (
    <Modal
      title="Backup & import"
      subtitle="Everything stays in this browser. A file is the only way to move it."
      onClose={onClose}
    >
      <div className="stack">
        <label className="field">
          <span className="label">Your name</span>
          <input value={name} maxLength={32} placeholder="Add your name" onChange={(event) => onName(event.target.value)} />
        </label>

        <section className="dialog-block">
          <h3>Full backup</h3>
          <p className="hint">JSON keeps entries, budgets, and monthly items together.</p>
          <div className="actions">
            <button type="button" className="btn small" onClick={onExportJson}>
              Download backup
            </button>
            <button type="button" className="btn ghost small" onClick={() => jsonRef.current?.click()}>
              Restore backup
            </button>
          </div>
        </section>

        <section className="dialog-block">
          <h3>Spreadsheet</h3>
          <p className="hint">
            CSV columns: date, type, category, amount, payment, note. Dates can be 2026-11-02 or 02/11/2026. Type is
            expense or income. Payment is upi, cash, card, or bank. Import adds rows. It does not replace the ledger.
          </p>
          <div className="actions">
            <button type="button" className="btn small" onClick={onExportCsv}>
              Export CSV
            </button>
            <button type="button" className="btn ghost small" onClick={() => csvRef.current?.click()}>
              Import CSV
            </button>
          </div>
        </section>

        <section className="dialog-block">
          <h3>Example month</h3>
          <p className="hint">A realistic month you can delete later. Edited example rows are kept.</p>
          <div className="actions">
            {hasSample ? (
              <button type="button" className="btn ghost small" onClick={onClearSample}>
                Remove example entries
              </button>
            ) : (
              <button type="button" className="btn small" onClick={onLoadSample}>
                Load an example month
              </button>
            )}
          </div>
        </section>

        <section className="dialog-block">
          <h3>Erase this browser</h3>
          <p className="hint">Deletes entries, budgets, and monthly items stored here.</p>
          <button type="button" className="btn danger small" onClick={onReset}>
            Erase everything
          </button>
        </section>

        <input
          ref={jsonRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void readFile(file, onImportJson);
          }}
        />
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void readFile(file, onImportCsv);
          }}
        />
      </div>
    </Modal>
  );
}
