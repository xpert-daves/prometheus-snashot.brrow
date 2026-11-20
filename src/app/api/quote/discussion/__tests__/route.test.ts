/** @jest-environment node */
import type { NextRequest } from 'next/server';
import { ConvexError } from 'convex/values';
const mockSave = jest.fn();
const mockSharedLimit = jest.fn();
jest.mock('../../../../../lib/quoteDiscussion.server', () => ({
  quoteDiscussionsEnabled: () => process.env.QUOTE_DISCUSSIONS_ENABLED === 'true',
  saveQuoteDiscussion: (...args: unknown[]) => mockSave(...args),
}));
jest.mock('../../../../../lib/quoteRateLimit', () => ({ checkSharedQuoteRateLimit: (...args: unknown[]) => mockSharedLimit(...args) }));
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init: { status: number; headers: Record<string, string> }) => ({ body, ...init }) },
}));
import { POST } from '../route';

const quoteId = '74b95b32-ab23-4035-a00b-25f276cd69c1';
const actionToken = 'a'.repeat(64);
function request(body: unknown = { quoteId, actionToken }, headers: Record<string, string> = {}) {
  return new Request('https://shed210.com/api/quote/discussion', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://shed210.com', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as NextRequest;
}
const env = process.env;
let now = 2_000_000_000_000;
beforeEach(() => {
  process.env = { ...env, QUOTE_DISCUSSIONS_ENABLED: 'true', QUOTE_TENANT_SLUG: 'shed210' };
  jest.clearAllMocks();
  now += 61_000;
  jest.spyOn(Date, 'now').mockReturnValue(now);
  mockSharedLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mockSave.mockResolvedValue({ ok: true, requestId: `shed210:quote-discussion:${quoteId}`, status: 'created' });
});
afterEach(() => { jest.restoreAllMocks(); process.env = env; });

it('passes only the server tenant and per-quote capability; returns a noncached receipt', async () => {
  const result = await POST(request());
  expect(result).toMatchObject({ status: 200, headers: { 'Cache-Control': 'no-store' }, body: { ok: true, status: 'created' } });
  expect(mockSave).toHaveBeenCalledWith({ tenantSlug: 'shed210', quoteId, actionToken });
  expect(mockSharedLimit).toHaveBeenCalledWith(expect.objectContaining({ clientIp: expect.stringMatching(/^quote-discussion:/) }));
});
it('returns the same receipt on a retried request', async () => {
  mockSave.mockResolvedValue({ ok: true, requestId: 'stable-request', status: 'deduped' });
  expect(await POST(request())).toMatchObject({ status: 200, body: { requestId: 'stable-request', status: 'deduped' } });
});
it.each([
  { quoteId }, { quoteId, actionToken: 'invalid' }, { quoteId: 'bad', actionToken },
  { quoteId, actionToken, tenantSlug: 'another' }, { quoteId, actionToken, total: 1 },
])('rejects malformed or extra fields before storage: %j', async body => {
  expect(await POST(request(body))).toMatchObject({ status: 400 });
  expect(mockSave).not.toHaveBeenCalled();
});
it('rejects cross-origin and malformed Origin requests', async () => {
  expect(await POST(request(undefined, { origin: 'https://other.example' }))).toMatchObject({ status: 403 });
  expect(await POST(request(undefined, { origin: 'bad' }))).toMatchObject({ status: 403 });
  expect(mockSave).not.toHaveBeenCalled();
});
it('honors the feature switch and tenant scope', async () => {
  process.env.QUOTE_DISCUSSIONS_ENABLED = 'false';
  expect(await POST(request())).toMatchObject({ status: 503 });
  process.env.QUOTE_DISCUSSIONS_ENABLED = 'true'; process.env.QUOTE_TENANT_SLUG = 'other';
  expect(await POST(request())).toMatchObject({ status: 503 });
  expect(mockSave).not.toHaveBeenCalled();
});
it('enforces the body limit and shared rate limit', async () => {
  expect(await POST(request('x'.repeat(2049)))).toMatchObject({ status: 413 });
  mockSharedLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 45 });
  expect(await POST(request())).toMatchObject({ status: 429, headers: { 'Retry-After': '45' } });
  expect(mockSave).not.toHaveBeenCalled();
});
it.each([
  [new ConvexError('DISCUSSION_EXPIRED'), 410],
  [new ConvexError('DISCUSSION_UNAUTHORIZED'), 403],
  [new Error('secret backend details'), 503],
])('maps persistence errors without exposing backend details', async (error, status) => {
  mockSave.mockRejectedValue(error);
  const result = await POST(request());
  expect(result).toMatchObject({ status });
  expect(JSON.stringify(result)).not.toContain('secret backend details');
});
