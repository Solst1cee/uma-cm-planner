import { useRef, useState } from 'react';
import { useRoster } from './useRoster';

/** Upload glyph — same artwork as the planner inventory's Upload button
 *  (`PlanInventoryCard` `UploadIcon`) so the two read identically. */
const UploadIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M9 13h2V6.8l2.6 2.6L15 8l-5-5-5 5 1.4 1.4L9 6.8V13Z" />
    <path d="M3 12h2v3h10v-3h2v5H3v-5Z" />
  </svg>
);

/** "Upload data" — reads a UmaExtractor data.json into the local roster. Uses the
 *  planner inventory's hover-expand icon button (`cmp-inventory-action-btn`). */
export function UploadDataButton({ onImported }: { onImported?: () => void }) {
  const { importFromFile } = useRoster();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same filename
    if (!file) return;
    setStatus('Importing…');
    try {
      const { added, skipped } = await importFromFile(file);
      setStatus(`Imported ${added}${skipped ? `, skipped ${skipped}` : ''}`);
      onImported?.();
    } catch {
      setStatus('Import failed — not a valid UmaExtractor file');
    }
  };

  return (
    <span className="inh-upload">
      <button
        type="button"
        className="cmp-inventory-icon-btn cmp-inventory-action-btn"
        title="Upload data"
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon />
        <span>Upload</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="inh-upload-input"
        aria-label="Upload data"
        onChange={onChange}
      />
      {status && <span className="inh-upload-status muted small">{status}</span>}
    </span>
  );
}
