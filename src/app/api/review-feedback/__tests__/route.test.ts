/** @jest-environment node */
import type { NextRequest } from 'next/server';
const mockForward = jest.fn();
const mockSharedLimit = jest.fn();
jest.mock('../../../../lib/reviewFeedback.server', () => ({
  forwardReviewFeedback: (...args: unknown[]) => mockForward(...args),
}));
jest.mock('../../../../lib/quoteRateLimit', () => ({ checkSharedQuoteRateLimit: (...args: unknown[]) => mockSharedLimit(...args) }));
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init: { status: number; headers: Record<string, string> }) => ({ body, ...init }) },
}));
import { POST } from '../route';

const valid = { code: '7KQ2M9XA', event: 'commented', rating: 3, comment: '  Delivery was late.  ' };
function request(body: unknown = valid, headers: Record<string, string> = {}) {
  return new Request('https://www.shed210.com/api/review-feedback', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://www.shed210.com', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as NextRequest;
}
const env = process.env;
let now = 2_000_000_000_000;
beforeEach(() => {
  process.env = { ...env, QUOTE_TENANT_SLUG: 'shed210' };
  jest.clearAllMocks();
  now += 61_000;
  jest.spyOn(Date, 'now').mockReturnValue(now);
  mockSharedLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mockForward.mockResolvedValue('recorded');
});
afterEach(() => { jest.restoreAllMocks(); process.env = env; });

it('forwards a trimmed comment and returns a noncached receipt', async () => {
  expect(await POST(request())).toMatchObject({ status: 200, headers: { 'Cache-Control': 'no-store' }, body: { ok: true } });
  expect(mockForward).toHaveBeenCalledWith({ linkCode: '7KQ2M9XA', event: 'commented', rating: 3, comment: 'Delivery was late.' });
  expect(mockSharedLimit).toHaveBeenCalledWith(expect.objectContaining({ clientIp: expect.stringMatching(/^review-feedback:/) }));
});

it('drops comments from rating and Google events', async () => {
  await POST(request({ code: '7KQ2M9XA', event: 'google_opened', rating: 5 }));
  expect(mockForward).toHaveBeenCalledWith({ linkCode: '7KQ2M9XA', event: 'google_opened', rating: 5, comment: null });
});

it('rejects cross-site posts before doing any work', async () => {
  expect(await POST(request(valid, { origin: 'https://evil.example' }))).toMatchObject({ status: 403 });
  expect(await POST(request(valid, { 'sec-fetch-site': 'cross-site' }))).toMatchObject({ status: 403 });
  expect(mockForward).not.toHaveBeenCalled();
});

it.each([
  { ...valid, code: '7kq2m9xa' },
  { ...valid, code: '7KQ2M9XU' },
  { ...valid, rating: 6 },
  { ...valid, rating: 2.5 },
  { ...valid, event: 'deleted' },
  { ...valid, comment: '   ' },
  { ...valid, comment: 'x'.repeat(1_001) },
  { ...valid, extra: true },
])('rejects malformed feedback %#', async (body) => {
  expect(await POST(request(body))).toMatchObject({ status: 400 });
  expect(mockForward).not.toHaveBeenCalled();
});

it('maps CRM outcomes to customer-safe responses', async () => {
  mockForward.mockResolvedValueOnce('not_found');
  expect(await POST(request())).toMatchObject({ status: 404, body: { error: 'This review link is no longer active.' } });
  mockForward.mockResolvedValueOnce('unavailable');
  expect(await POST(request())).toMatchObject({ status: 503 });
  mockForward.mockRejectedValueOnce(new Error('convex down'));
  expect(await POST(request())).toMatchObject({ status: 503 });
});

it('rate limits repeated posts from one client', async () => {
  mockSharedLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
  expect(await POST(request())).toMatchObject({ status: 429, headers: { 'Retry-After': '30' } });
  expect(mockForward).not.toHaveBeenCalled();
});

it('forwards a page open with its device and no rating', async () => {
  expect(await POST(request({ code: '7KQ2M9XA', event: 'opened', device: 'iphone' }))).toMatchObject({ status: 200 });
  expect(mockForward).toHaveBeenCalledWith({ linkCode: '7KQ2M9XA', event: 'opened', rating: null, comment: null, device: 'iphone' });
});

it.each([
  { code: '7KQ2M9XA', event: 'opened', rating: 5 },
  { code: '7KQ2M9XA', event: 'opened', comment: 'hi' },
  { code: '7KQ2M9XA', event: 'opened', device: 'windows-phone' },
  { code: '7KQ2M9XA', event: 'rated', rating: 5, device: 'iphone' },
  { code: '7KQ2M9XA', event: 'rated' },
])('rejects malformed opens and device-tagged ratings %#', async (body) => {
  expect(await POST(request(body))).toMatchObject({ status: 400 });
  expect(mockForward).not.toHaveBeenCalled();
});
