import { render, screen, fireEvent, act } from '@testing-library/react';
import FloatingCTA from '../FloatingCTA';
import { usePathname } from 'next/navigation';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

const mockUsePathname = usePathname as jest.Mock;

describe('FloatingCTA', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/test');
  });

  afterEach(() => {
    // clean up mocked scrollHeight
    delete (document.documentElement as { scrollHeight?: unknown }).scrollHeight;
  });

  it('shows link after scrolling', () => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'scrollY', { value: 300, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      get: () => 1000,
      configurable: true,
    });
    render(<FloatingCTA />);
    act(() => {
      fireEvent.scroll(window);
      jest.runAllTimers();
    });
    const link = screen.getByRole('link', { name: /get instant price/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/quote');
    expect(link.parentElement).toHaveStyle('opacity: 1');
    const wrapper = link.parentElement?.parentElement;
    expect(wrapper).not.toHaveAttribute('inert');
    expect(wrapper).not.toHaveClass('pointer-events-none');
    jest.useRealTimers();
  });

  it('hides when scrolled to bottom', () => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'scrollY', { value: 800, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 2000, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      get: () => 1000,
      configurable: true,
    });
    render(<FloatingCTA />);
    act(() => {
      fireEvent.scroll(window);
      jest.runAllTimers();
    });
    const link = screen.getByRole('link', { hidden: true });
    expect(link.parentElement).toHaveStyle('opacity: 0');
    jest.useRealTimers();
  });

  it('cannot be clicked or focused while hidden near the top', () => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      get: () => 2000,
      configurable: true,
    });
    render(<FloatingCTA />);
    act(() => {
      fireEvent.scroll(window);
      jest.runAllTimers();
    });
    const link = screen.getByRole('link', { name: /get instant price/i, hidden: true });
    expect(link.parentElement).toHaveStyle('opacity: 0');
    // The outer fixed wrapper (not just the faded inner div) must be inert, or
    // its transparent box would still sit over the page and take the click.
    const wrapper = link.parentElement?.parentElement;
    expect(wrapper).toHaveAttribute('inert');
    expect(wrapper).toHaveClass('fixed', 'pointer-events-none');
    jest.useRealTimers();
  });

  it('becomes clickable again once scrolled into view', () => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      get: () => 2000,
      configurable: true,
    });
    render(<FloatingCTA />);
    act(() => {
      fireEvent.scroll(window);
      jest.runAllTimers();
    });
    const wrapper = screen.getByRole('link', { hidden: true }).parentElement?.parentElement;
    expect(wrapper).toHaveAttribute('inert');

    act(() => {
      window.scrollY = 300;
      fireEvent.scroll(window);
      jest.runAllTimers();
    });
    expect(wrapper).not.toHaveAttribute('inert');
    expect(wrapper).not.toHaveClass('pointer-events-none');
    expect(screen.getByRole('link', { name: /get instant price/i })).toHaveAttribute('href', '/quote');
    jest.useRealTimers();
  });

  it('hides on quote page', () => {
    mockUsePathname.mockReturnValue('/quote');
    render(<FloatingCTA />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('hides on home page', () => {
    mockUsePathname.mockReturnValue('/');
    render(<FloatingCTA />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
