import { render, screen } from '@testing-library/react';
import ContactPageClient from '../ContactPageClient';

jest.mock('../StaticServiceAreaMap', () => ({
  __esModule: true,
  default: ({ className }: { className?: string }) => (
    <div data-testid="service-area-map" className={className} />
  ),
}));

describe('ContactPageClient', () => {
  it('renders direct contact actions without a booking iframe', () => {
    const { container } = render(<ContactPageClient />);

    expect(screen.getByRole('link', { name: /call us at \(855\) 578-0944/i })).toHaveAttribute(
      'href',
      'tel:+18555780944'
    );
    expect(screen.getByRole('link', { name: /text us at \(855\) 578-0944/i })).toHaveAttribute(
      'href',
      'sms:+18555780944'
    );
    expect(screen.getByRole('link', { name: /info@shed210.com/i })).toHaveAttribute(
      'href',
      'mailto:info@shed210.com'
    );
    expect(screen.queryByTitle(/schedule/i)).not.toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('renders service-area and faq content', () => {
    render(<ContactPageClient />);

    expect(screen.getByText(/service area overview/i)).toBeInTheDocument();
    expect(screen.getByText(/shed project faqs/i)).toBeInTheDocument();
    expect(screen.getByText(/we confirm build timing/i)).toBeInTheDocument();
    expect(screen.queryByText(/we confirm delivery timing/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('service-area-map')).toBeInTheDocument();
  });
});
