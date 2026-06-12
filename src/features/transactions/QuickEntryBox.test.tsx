import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
