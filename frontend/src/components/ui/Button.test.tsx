import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Click me' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows a loading label and disables the button while isLoading', () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Save changes
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Please wait…' });
    expect(button).toBeDisabled();
    expect(screen.queryByText('Save changes')).not.toBeInTheDocument();
  });

  it('stays disabled when explicitly disabled, independent of isLoading', () => {
    render(<Button disabled>Save changes</Button>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save changes
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
