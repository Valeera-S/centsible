import { useRef, useState, type FormEvent } from 'react';
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

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  const host = globalThis as Record<string, unknown>;
  return (host.SpeechRecognition ??
    host.webkitSpeechRecognition ??
    null) as SpeechRecognitionCtor | null;
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
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const ctor = speechRecognitionCtor();

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

  function startListening() {
    if (!ctor || listening) return;
    const recognition = new ctor();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setText((current) => (current ? `${current} ${transcript}` : transcript));
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
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
      {ctor && (
        <button
          type="button"
          aria-label={strings.voice.start}
          className={listening ? 'is-listening' : ''}
          onClick={startListening}
        >
          {listening ? strings.voice.listening : strings.voice.start}
        </button>
      )}
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
