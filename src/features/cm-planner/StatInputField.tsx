import { useEffect, useRef, useState } from 'react';
import { sanitizeStatDraft, statValueFromDraft } from './statInput';

/** Stat field with a local string draft so it can be cleared to empty (no sticky
 *  "0") and never shows a leading zero. Commits the parsed value live; normalizes
 *  an empty/invalid draft to 0 on blur. */
export function StatInput({
  value,
  label,
  onValueChange,
}: {
  value: number;
  label: string;
  onValueChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // Re-sync when the committed value changes from outside (plan load / external edit),
  // but not when our own live-commit echoes the same number back.
  const lastCommitted = useRef(value);
  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setDraft(String(value));
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={draft}
      onChange={(e) => {
        const next = sanitizeStatDraft(e.target.value);
        setDraft(next);
        const parsed = statValueFromDraft(next);
        lastCommitted.current = parsed;
        onValueChange(parsed);
      }}
      onBlur={() => {
        if (draft === '') {
          setDraft('0');
          lastCommitted.current = 0;
          onValueChange(0);
        }
      }}
    />
  );
}
