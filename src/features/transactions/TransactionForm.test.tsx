import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_CATEGORIES } from '../../domain/categories';
import { TransactionForm } from './TransactionForm';

const categories = [...DEFAULT_CATEGORIES];

describe('TransactionForm', () => {
  it('saves a valid expense draft', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<TransactionForm categories={categories} onSave={onSave} onCancel={() => undefined} />);

    await user.type(screen.getByLabelText('Amount'), '12.50');
    await user.selectOptions(screen.getByLabelText('Category'), 'groceries');
    await user.type(screen.getByLabelText('Note'), 'weekly run');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const draft = onSave.mock.calls[0][0];
    expect(draft).toMatchObject({
      type: 'expense',
      amountCents: 1250,
      categoryId: 'groceries',
      note: 'weekly run',
    });
  });

  it('rejects an invalid amount with an error and no save', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<TransactionForm categories={categories} onSave={onSave} onCancel={() => undefined} />);

    await user.type(screen.getByLabelText('Amount'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid amount');
  });

  it('switches the category list when the type changes', async () => {
    const user = userEvent.setup();
    render(
      <TransactionForm
        categories={categories}
        onSave={() => undefined}
        onCancel={() => undefined}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Type'), 'income');
    const select = screen.getByLabelText('Category');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Stipend');
    expect(options).not.toContain('Dining');
  });
});
