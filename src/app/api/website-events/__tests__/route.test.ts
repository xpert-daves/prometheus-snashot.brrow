/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '../route';

const event = { eventId: 'event-00000001', sessionId: 'session-00000001', name: 'page_view', path: '/quote', offer: 'quote' };
let sequence = 0;
function request(body: unknown = { events: [event] }, headers: Record<string, string> = {}) {
  return new NextRequest('https://www.shed210.com/api/website-events', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { origin: 'https://www.shed210.com', 'content-type': 'application/json', 'x-vercel-forwarded-for': `192.0.2.${++sequence % 250 + 1}`, ...headers },
  });
}
const originalEnv = { ...process.env };
const originalFetch = global.fetch;
beforeEach(() => {
  process.env.VERCEL_ENV = 'production';
  process.env.FRONTIER_PIXEL_CRM_WEBSITE_EVENTS_KEY = 'test-tenant-key';
  delete process.env.FRONTIER_PIXEL_CRM_WEBSITE_EVENTS_URL;
  global.fetch = jest.fn().mockResolvedValue(Response.json({ ok: true, recorded: 1, deduped: 0 }));
});
afterEach(() => { process.env = { ...originalEnv }; global.fetch = originalFetch; });

it('pins tenant, origin and environment while stripping arbitrary browser fields', async () => {
  const response = await POST(request({ tenantSlug: 'frontierpixel', environment: 'internal', siteOrigin: 'https://evil.example', events: [{ ...event, email: 'private@example.com', goalKey: 'quote-request' }] }));
  expect(response.status).toBe(200);
  const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('https://youthful-horse-290.convex.site/api/intake/marketing-event');
  expect(JSON.parse(options.body)).toEqual({ tenantSlug: 'shed210', siteOrigin: 'https://www.shed210.com', environment: 'production', events: [event] });
  expect(options.headers.Authorization).toBe('Bearer test-tenant-key');
  expect(options.redirect).toBe('error');
  expect(await response.json()).toEqual({ ok: true, recorded: 1, deduped: 0 });
});

it('forwards which field blocked a quote, but never free text in its place', async () => {
  const failure = { ...event, name: 'form_error', failureCode: 'validation' };
  global.fetch = jest.fn().mockResolvedValue(Response.json({ ok: true, recorded: 2, deduped: 0 }));
  const response = await POST(request({ events: [
    { ...failure, failureField: 'phone' },
    { ...failure, eventId: 'event-00000002', failureField: '(210) 555-0100' },
  ] }));
  expect(response.status).toBe(200);
  const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).events;
  expect(sent).toEqual([{ ...failure, failureField: 'phone' }, { ...failure, eventId: 'event-00000002' }]);
});

it.each(['goal_completed', 'crm_accepted'])('rejects browser completion %s', async name => {
  expect((await POST(request({ events: [{ ...event, name }] }))).status).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});
it.each(['goal-forged001', 'accepted-forged001'])('rejects reserved event ID %s', async eventId => {
  expect((await POST(request({ events: [{ ...event, eventId }] }))).status).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});
it.each<Record<string, string>>([{ origin: 'https://evil.example' }, { origin: '' }, { 'sec-fetch-site': 'cross-site' }])('rejects foreign or absent origin', async headers => {
  expect((await POST(request(undefined, headers))).status).toBe(403);
  expect(global.fetch).not.toHaveBeenCalled();
});
it.each<Record<string, string>>([{ dnt: '1' }, { 'sec-gpc': '1' }])('honors browser privacy headers', async headers => {
  expect((await POST(request(undefined, headers))).status).toBe(204);
  expect(global.fetch).not.toHaveBeenCalled();
});
it('enforces body byte limit even with an understated content length', async () => {
  expect((await POST(request({ padding: 'x'.repeat(8200), events: [event] }, { 'content-length': '1' }))).status).toBe(413);
  expect(global.fetch).not.toHaveBeenCalled();
});
it.each([{ events: [] }, { events: Array(11).fill(event) }, { events: [{ ...event, path: '/quote?email=private' }] }, 'invalid-json'])('rejects invalid batches', async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});
it('keeps previews out of production counts', async () => {
  process.env.VERCEL_ENV = 'preview';
  await POST(request());
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).environment).toBe('preview');
});
it('reports missing configuration without leaking credentials', async () => {
  delete process.env.FRONTIER_PIXEL_CRM_WEBSITE_EVENTS_KEY;
  expect((await POST(request())).status).toBe(503);
  expect(global.fetch).not.toHaveBeenCalled();
});
it('rejects an arbitrary endpoint before sending the credential', async () => {
  process.env.FRONTIER_PIXEL_CRM_WEBSITE_EVENTS_URL = 'https://evil.example/api/intake/marketing-event';
  expect((await POST(request())).status).toBe(503);
  expect(global.fetch).not.toHaveBeenCalled();
});
it('does not acknowledge partial or failed delivery', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(Response.json({ recorded: 0, deduped: 0 })).mockRejectedValueOnce(new Error('private upstream detail'));
  expect((await POST(request())).status).toBe(503);
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Measurement unavailable' });
});
it('acknowledges duplicate retries without claiming another recorded event', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(Response.json({ ok: true, recorded: 0, deduped: 1 }));
  const response = await POST(request());
  expect(await response.json()).toEqual({ ok: true, recorded: 0, deduped: 1 });
});
it('rejects an explicit failed acknowledgement even with plausible counts', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(Response.json({ ok: false, recorded: 1, deduped: 0 }));
  expect((await POST(request())).status).toBe(503);
});
