import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} title="Add expense">
        <p>content</p>
      </Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and children when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Add expense">
        <p>Form contents</p>
      </Modal>,
    );
    expect(screen.getByText('Add expense')).toBeInTheDocument();
    expect(screen.getByText('Form contents')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Add expense">
        <p>content</p>
      </Modal>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
