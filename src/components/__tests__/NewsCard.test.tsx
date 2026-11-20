import { render, screen } from '@testing-library/react';
import NewsCard from '../NewsCard';

describe('NewsCard', () => {
  it('passes alt text to the image', () => {
    render(
      <NewsCard
        slug="test-slug"
        title="Test Article"
        date="2023-01-01"
        excerpt="Excerpt"
        hero="/test.jpg"
        alt="A test shed"
      />
    );
    expect(screen.getByAltText('A test shed')).toBeInTheDocument();
  });

  it('renders placeholder when no hero is provided', () => {
    render(
      <NewsCard
        slug="test-slug"
        title="Test Article"
        date="2023-01-01"
        excerpt="Excerpt"
        alt="no hero"
      />
    );
    expect(screen.queryByRole('img')).toBeNull();
  });
});
