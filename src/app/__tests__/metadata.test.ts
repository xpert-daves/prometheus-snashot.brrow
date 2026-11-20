import { metadata as homeMetadata } from '../page';
import { metadata as quoteMetadata } from '../quote/page';

describe('page metadata', () => {
  it('sets the homepage as the San Antonio shed builder conversion page', () => {
    expect(homeMetadata.title).toBe('Shed Builder in San Antonio, TX | Storage & Metal Sheds');
    expect(homeMetadata.description).toContain('San Antonio shed builder');
    expect(homeMetadata.alternates?.canonical).toBe('/');
  });

  it('sets quote page canonical metadata', () => {
    expect(quoteMetadata.title).toBe('Shed Quote Calculator in San Antonio');
    expect(quoteMetadata.description).toContain('instant shed pricing');
    expect(quoteMetadata.alternates?.canonical).toBe('/quote');
  });
});
