import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickEntryBox } from './QuickEntryBox';
import { todayIso } from '../../domain/dates';

describe('QuickEntryBox', () => {
  it('parses input and commits items on submit, then clears', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<QuickEntryBox onCommit={onCommit} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'coffee 6.5{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith([
      { description: 'coffee', amountCents: 650, date: todayIso(), type: 'expense' },
    ]);
    expect(input).toHaveValue('');
  });

  it('shows an error and keeps the text when the input has no amount', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<QuickEntryBox onCommit={onCommit} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'coffee{Enter}');

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('coffee');
    expect(screen.getByRole('alert')).toHaveTextContent('No amount found in "coffee"');
  });

  it('does nothing on empty submit', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<QuickEntryBox onCommit={onCommit} />);

    await user.type(screen.getByRole('textbox'), '{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('frequent suggestion chips', () => {
  it('renders chips and fills the input on click', async () => {
    const user = userEvent.setup();
    render(
      <QuickEntryBox
        onCommit={vi.fn()}
        suggestions={[
          { description: '午餐', amountCents: 1500 },
          { description: 'coffee', amountCents: 650 },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Fill 午餐' }));
    expect(screen.getByRole('textbox')).toHaveValue('午餐 15');

    await user.click(screen.getByRole('button', { name: 'Fill coffee' }));
    expect(screen.getByRole('textbox')).toHaveValue('coffee 6.5');
  });

  it('renders no chip row without suggestions', () => {
    render(<QuickEntryBox onCommit={vi.fn()} />);
    expect(screen.queryByTestId('suggestion-chips')).not.toBeInTheDocument();
  });
});

describe('voice input', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides the mic button when speech recognition is unsupported', () => {
    render(<QuickEntryBox onCommit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Voice input' })).not.toBeInTheDocument();
  });

  it('fills the input with the recognized transcript', async () => {
    class FakeRecognition {
      lang = '';
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        queueMicrotask(() => {
          this.onresult?.({ results: [[{ transcript: 'coffee 6.5' }]] });
          this.onend?.();
        });
      }
      stop() {}
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);

    const user = userEvent.setup();
    render(<QuickEntryBox onCommit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Voice input' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('coffee 6.5');
    });
  });
});
