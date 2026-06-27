import { useId, useRef, useState } from 'react';
import { useRoster } from './useRoster';

/** "Upload data" — reads a UmaExtractor data.json into the local roster. */
export function UploadDataButton({ onImported }: { onImported?: () => void }) {
  const { importFromFile } = useRoster();
  const inputId = useId();
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
      <label htmlFor={inputId} className="cmp-small-btn">Upload data</label>
      <input
        id={inputId}
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
