/** @jest-environment node */
const mockMutation = jest.fn();
jest.mock('convex/browser', () => ({ ConvexHttpClient: jest.fn(() => ({ mutation: mockMutation })) }));
import { createDiscussionCapability, hashDiscussionToken, saveQuoteDiscussion, DISCUSSION_TOKEN_LIFETIME_MS } from '../quoteDiscussion.server';
import { saveQuote, type QuoteRecord } from '../quotePersistence';
const env = process.env;
const quote: QuoteRecord = {
  name: 'Test', email: 'test@example.com', phone: '2105550100', structureType: 'storage_shed',
  length: 10, width: 10, deliveryRadius: 5, total: 100,
  smsConsent: { status: 'not_opted_in', source: 'website_quote_form', consentText: null, consentTextVersion: null, pageUrl: null, ipAddress: null, userAgent: null, recordedAt: 1 },
  breakdown: { base: 100, wallHeight: 0, roof: 0, siding: 0, door: 0, windows: 0, addOns: 0, delivery: 0, discount: 0, interiorUpgrades: [] },
};
beforeEach(() => {
  process.env = { ...env, CONVEX_QUOTE_WRITE_KEY: 'test-write-key', NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud' };
  delete process.env.QUOTE_DISCUSSIONS_ENABLED;
  mockMutation.mockReset(); mockMutation.mockResolvedValue(null);
});
afterEach(() => { process.env = env; jest.restoreAllMocks(); });
it('generates distinct random capabilities and stores only a hash with a 24-hour expiry', () => {
  jest.spyOn(Date, 'now').mockReturnValue(1000);
  const first = createDiscussionCapability();
  const second = createDiscussionCapability();
  expect(first.token).toMatch(/^[a-f0-9]{64}$/);
  expect(first.token).not.toBe(second.token);
  expect(first.hash).toBe(hashDiscussionToken(first.token));
  expect(first.hash).not.toBe(first.token);
  expect(first.expiresAt).toBe(1000 + DISCUSSION_TOKEN_LIFETIME_MS);
});
it('leaves existing quote behavior unchanged while disabled', async () => {
  const saved = await saveQuote(quote);
  expect(saved).not.toHaveProperty('discussionToken');
  expect(mockMutation.mock.calls[0][1]).not.toHaveProperty('discussionTokenHash');
});
it('binds the returned capability to the saved quote without persisting its raw token', async () => {
  process.env.QUOTE_DISCUSSIONS_ENABLED = 'true';
  const saved = await saveQuote(quote);
  expect(saved.discussionToken).toMatch(/^[a-f0-9]{64}$/);
  const payload = mockMutation.mock.calls[0][1];
  expect(payload).toMatchObject({ publicId: saved.id, discussionTokenHash: hashDiscussionToken(saved.discussionToken!), discussionTokenExpiresAt: expect.any(Number) });
  expect(JSON.stringify(payload)).not.toContain(saved.discussionToken);
});
it('does not issue discussion capabilities for other tenants', async () => {
  process.env.QUOTE_DISCUSSIONS_ENABLED = 'true';
  expect(await saveQuote({ ...quote, tenantSlug: 'other' })).not.toHaveProperty('discussionToken');
});
it('hashes capabilities before crossing the Convex boundary', async () => {
  const actionToken = 'b'.repeat(64);
  await saveQuoteDiscussion({ tenantSlug: 'shed210', quoteId: 'quote-id', actionToken });
  expect(mockMutation.mock.calls[0][1]).toEqual({ writeKey: 'test-write-key', tenantSlug: 'shed210', publicId: 'quote-id', tokenHash: hashDiscussionToken(actionToken) });
});
