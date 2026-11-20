import { render, screen } from '@testing-library/react';
import ShareActions from '../ShareActions';

describe('ShareActions', () => {
  it('uses the supplied URL for social share links', () => {
    const url = 'https://shed210.com/news/test-article';

    render(<ShareActions title="Test Article" path={url} />);

    expect(screen.getByRole('link', { name: 'Share on X' })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent(url))
    );
  });
});
