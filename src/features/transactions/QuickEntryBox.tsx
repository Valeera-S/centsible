import { useState, type FormEvent } from 'react';
import { todayIso } from '../../domain/dates';
import {
  parseQuickEntry,
  type QuickEntryError,
  type QuickEntryItem,
} from '../../domain/parse/quickEntry';
import { strings } from '../../i18n/strings';

interface QuickEntryBoxProps {
  onCommit: (items: QuickEntryItem[]) => Promise<void> | void;
}

function errorMessage(error: QuickEntryError): string {
  switch (error.reason) {
    case 'no-amount':
      return strings.quickEntry.errorNoAmount(error.segment);
    case 'no-description':
      return strings.quickEntry.errorNoDescription(error.segment);
    case 'bad-date':
      return strings.quickEntry.errorBadDate(error.segment);
  }
}

export function QuickEntryBox({ onCommit }: QuickEntryBoxProps) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<QuickEntryError[]>([]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const result = parseQuickEntry(trimmed, todayIso());
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    await onCommit(result.items);
    setText('');
    setErrors([]);
  }

  return (
    <form className="quick-entry" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        placeholder={strings.quickEntry.placeholder}
        onChange={(event) => {
          setText(event.target.value);
          setErrors([]);
        }}
      />
      <button type="submit">{strings.quickEntry.submit}</button>
      {errors.length > 0 && (
        <div role="alert" className="quick-entry-errors">
          {errors.map((error) => (
            <p key={error.segment + error.reason}>{errorMessage(error)}</p>
          ))}
        </div>
      )}
    </form>
  );
}
