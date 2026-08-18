import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from './Select';

describe('Select', () => {
  it('associates the label with the select via id', () => {
    render(
      <Select label="Split type" name="splitType">
        <option value="EQUAL">Equal</option>
      </Select>,
    );
    const select = screen.getByLabelText('Split type');
    expect(select).toBeInTheDocument();
    expect(select).toHaveAttribute('id', 'splitType');
  });

  it('falls back to the name for the id when no id prop is given', () => {
    render(
      <Select name="cadence">
        <option value="WEEKLY">Weekly</option>
      </Select>,
    );
    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'cadence');
  });

  it('renders the passed-in options as children', () => {
    render(
      <Select label="Paid by" name="paidById">
        <option value="u1">Alice</option>
        <option value="u2">Bob</option>
      </Select>,
    );
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument();
  });

  it('shows the error message and applies the error border class', () => {
    render(
      <Select label="Paid by" name="paidById" error="Required">
        <option value="u1">Alice</option>
      </Select>,
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveClass('border-red-400');
  });

  it('does not render a label element when no label is given', () => {
    render(
      <Select name="cadence">
        <option value="WEEKLY">Weekly</option>
      </Select>,
    );
    expect(screen.queryByText('Weekly', { selector: 'label' })).not.toBeInTheDocument();
  });
});
