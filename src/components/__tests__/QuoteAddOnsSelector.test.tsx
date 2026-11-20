import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuoteAddOnsSelector } from '@/components/quote/QuoteAddOnsSelector';

function SelectorHarness() {
  const [addOns, setAddOns] = useState<string[]>([]);

  return (
    <QuoteAddOnsSelector
      addOns={addOns}
      door="single_shed"
      onToggleAddOn={(option, checked) =>
        setAddOns((current) =>
          checked
            ? [...current, option]
            : current.filter((selected) => selected !== option)
        )
      }
    />
  );
}

describe('QuoteAddOnsSelector', () => {
  it('keeps add-on groups compact and summarizes selections when closed', () => {
    render(<SelectorHarness />);

    const exteriorToggle = screen.getByRole('button', {
      name: /exterior upgrades/i,
    });
    const interiorToggle = screen.getByRole('button', {
      name: /interior upgrades/i,
    });

    expect(exteriorToggle).toHaveAttribute('aria-expanded', 'false');
    expect(interiorToggle).toHaveAttribute('aria-expanded', 'false');
    expect(exteriorToggle).toHaveTextContent('7 options');
    expect(interiorToggle).toHaveTextContent('4 options');
    expect(screen.queryByRole('checkbox', { name: /ramp/i })).not.toBeInTheDocument();

    fireEvent.click(exteriorToggle);
    expect(exteriorToggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      document.getElementById(exteriorToggle.getAttribute('aria-controls') ?? '')
    ).toBeInTheDocument();

    const ramp = screen.getByRole('checkbox', { name: /ramp single shed door/i });
    fireEvent.click(ramp);
    expect(exteriorToggle).toHaveTextContent('1 selected');

    fireEvent.click(interiorToggle);
    expect(exteriorToggle).toHaveAttribute('aria-expanded', 'false');
    expect(interiorToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('checkbox', { name: /ramp/i })).not.toBeInTheDocument();

    fireEvent.click(exteriorToggle);
    expect(screen.getByRole('checkbox', { name: /ramp/i })).toBeChecked();
  });

  it('keeps add-on errors visible without trapping the disclosure controls', () => {
    render(
      <QuoteAddOnsSelector
        addOns={[]}
        door="single_shed"
        error="Select only available upgrades"
        errorId="err-addOns"
        onToggleAddOn={jest.fn()}
      />
    );

    const exteriorToggle = screen.getByRole('button', {
      name: /exterior upgrades/i,
    });
    const interiorToggle = screen.getByRole('button', {
      name: /interior upgrades/i,
    });

    expect(exteriorToggle).toHaveAttribute('aria-expanded', 'false');
    expect(exteriorToggle).toHaveAttribute('aria-describedby', 'err-addOns');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Select only available upgrades'
    );
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'err-addOns');

    fireEvent.click(interiorToggle);
    expect(interiorToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('alert')).toBeVisible();
  });
});
