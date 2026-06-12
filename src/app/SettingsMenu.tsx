/**
 * Header settings menu: JSON export/import of all local data (P2 —
 * IndexedDB is the only store, so export is the user's backup path).
 * Import is destructive ('replace') and confirms first.
 */
import { useRef, useState } from 'react';
import { exportBlob, importBlob } from '@/db';

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function SettingsMenu() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doExport = async () => {
    setError(null);
    setStatus(null);
    try {
      const data = await exportBlob();
      const file = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'uma-cm-planner-export.json';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Export downloaded.');
    } catch (err) {
      setError(`Export failed: ${message(err)}`);
    }
  };

  const doImport = async (file: File) => {
    setError(null);
    setStatus(null);
    if (
      !window.confirm(
        'Importing REPLACES all local data (plans, inventory, parents). Continue?',
      )
    ) {
      return;
    }
    try {
      const data: unknown = JSON.parse(await file.text());
      await importBlob(data, 'replace');
      setStatus('Import complete — reloading…');
      window.location.reload();
    } catch (err) {
      setError(`Import failed: ${message(err)}`);
    }
  };

  return (
    <details className="settings">
      <summary aria-label="Settings menu">⚙</summary>
      <div className="settings-body">
        <button type="button" onClick={() => void doExport()}>
          Export data (JSON)
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import data (replace)…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-label="Import file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // allow re-selecting the same file
            if (file) void doImport(file);
          }}
        />
        {status && <p className="muted small">{status}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
