import { getFunctionName, type FunctionReference } from 'convex/server';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import {
  claimDiscussionMutation,
  completeDiscussionMutation,
  isDiscussionAcknowledgement,
  postDiscussion,
  recoverDiscussionsMutation,
  requestDiscussionMutation,
} from '../quoteDiscussions';
import {
  CRM_QUOTE_SYNC_PROCESSING_STALE_MS,
  CRM_QUOTE_SYNC_REQUEST_TIMEOUT_MS,
  CRM_QUOTE_SYNC_RETRY_DELAYS_MS,
} from '../crmQuoteSync';
import { CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION } from '../validators';

const NOW = 1_800_000_000_000;
const tenantId = 'tenant-shed210';
const quoteId = 'quote-source-1';
const requestId = 'discussion-1' as Id<'quoteDiscussionRequests'>;
const tokenHash = 'a'.repeat(64);
const externalRequestId = 'shed210:quote-discussion:public-1';
const payload = {
  version: 1 as const,
  tenantSlug: 'shed210' as const,
  externalRequestId,
  quoteExternalSubmissionId: 'shed210:quote:public-1',
  publicId: 'public-1',
  sourceDocumentId: quoteId,
  requestedAt: NOW - 100,
};
const acknowledgement = { ...payload, ok: true, status: 'created' };

type Row = { _id: string; _creationTime: number } & Record<string, unknown>;
type Table = 'tenants' | 'quoteRequests' | 'crmQuoteSyncOutbox' | 'quoteDiscussionRequests';
type Condition = { field: string; value: unknown; operation: 'eq' | 'lte' };
type IndexBuilder = {
  eq: (field: string, value: unknown) => IndexBuilder;
  lte: (field: string, value: unknown) => IndexBuilder;
};
type Job = { delayMs: number; name: string; args: Record<string, unknown> };

class FakeQuery {
  private conditions: Condition[] = [];
  constructor(private readonly rows: Row[]) {}
  withIndex(_name: string, build: (q: IndexBuilder) => unknown) {
    const builder: IndexBuilder = {
      eq: (field, value) => {
        this.conditions.push({ field, value, operation: 'eq' });
        return builder;
      },
      lte: (field, value) => {
        this.conditions.push({ field, value, operation: 'lte' });
        return builder;
      },
    };
    build(builder);
    return this;
  }
  private matches() {
    return this.rows.filter(row => this.conditions.every(condition => {
      const value = row[condition.field];
      return condition.operation === 'eq'
        ? value === condition.value
        : typeof value === 'number' && typeof condition.value === 'number' && value <= condition.value;
    }));
  }
  async take(count: number) { return this.matches().slice(0, count); }
  async unique() {
    const matches = this.matches();
    if (matches.length > 1) throw new Error('Expected unique result');
    return matches[0] ?? null;
  }
}

class FakeDb {
  rows: Record<Table, Row[]> = {
    tenants: [], quoteRequests: [], crmQuoteSyncOutbox: [], quoteDiscussionRequests: [],
  };
  query(table: Table) { return new FakeQuery(this.rows[table]); }
  async get(id: string) { return Object.values(this.rows).flat().find(row => row._id === id) ?? null; }
  async insert(table: Table, value: Record<string, unknown>) {
    const id = `${table}-${this.rows[table].length + 1}`;
    this.rows[table].push({ _id: id, _creationTime: Date.now(), ...value });
    return id;
  }
  async patch(id: string, value: Record<string, unknown>) {
    const row = await this.get(id);
    if (!row) throw new Error('Missing document');
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) delete row[key];
      else row[key] = entry;
    }
  }
}

function setup(withRequest = true) {
  const db = new FakeDb();
  const jobs: Job[] = [];
  const ctx = {
    db,
    scheduler: {
      runAfter: async (delayMs: number, reference: FunctionReference<'action'>, args: Job['args']) => {
        jobs.push({ delayMs, name: getFunctionName(reference), args });
      },
    },
  } as unknown as MutationCtx;
  db.rows.tenants.push({ _id: tenantId, _creationTime: 1, slug: 'shed210', active: true });
  db.rows.quoteRequests.push({
    _id: quoteId, _creationTime: 1, tenantId, publicId: 'public-1',
    discussionTokenHash: tokenHash, discussionTokenExpiresAt: NOW + 60_000,
    crmSyncOutboxId: 'outbox-1',
    inputs: { structureType: 'storage_shed', length: 10, width: 8 },
    pricing: { total: 3500 },
    smsConsent: { status: 'not_opted_in' },
  });
  db.rows.crmQuoteSyncOutbox.push({
    _id: 'outbox-1', _creationTime: 1, tenantId, quoteRequestId: quoteId,
    externalSubmissionId: payload.quoteExternalSubmissionId, status: 'succeeded',
    acknowledgementBindingVersion: CRM_QUOTE_ACKNOWLEDGEMENT_BINDING_VERSION,
  });
  if (withRequest) {
    db.rows.quoteDiscussionRequests.push({
      _id: requestId, _creationTime: 1, tenantId, quoteRequestId: quoteId,
      externalRequestId, requestedAt: payload.requestedAt, status: 'pending',
      attemptCount: 0, nextAttemptAt: NOW,
    });
  }
  return { db, ctx, jobs };
}

function requestArgs() {
  return { writeKey: 'test-write-key', tenantSlug: 'shed210', publicId: 'public-1', tokenHash };
}

describe('quote discussion persistence and delivery', () => {
  const previousWriteKey = process.env.CONVEX_QUOTE_WRITE_KEY;
  const previousSyncEnabled = process.env.SHED_CRM_SYNC_ENABLED;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    process.env.CONVEX_QUOTE_WRITE_KEY = 'test-write-key';
    process.env.SHED_CRM_SYNC_ENABLED = 'true';
  });
  afterEach(() => {
    if (previousWriteKey === undefined) delete process.env.CONVEX_QUOTE_WRITE_KEY;
    else process.env.CONVEX_QUOTE_WRITE_KEY = previousWriteKey;
    if (previousSyncEnabled === undefined) delete process.env.SHED_CRM_SYNC_ENABLED;
    else process.env.SHED_CRM_SYNC_ENABLED = previousSyncEnabled;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('records one request for an existing build without creating another quote or modifying consent', async () => {
    const { ctx, db, jobs } = setup(false);
    const savedQuote = JSON.parse(JSON.stringify(db.rows.quoteRequests[0]));
    const result = await requestDiscussionMutation(ctx, requestArgs());
    expect(result).toEqual({ ok: true, requestId: externalRequestId, status: 'created' });
    expect(db.rows.quoteDiscussionRequests).toHaveLength(1);
    expect(db.rows.quoteDiscussionRequests[0]).toMatchObject({
      quoteRequestId: quoteId, tenantId, externalRequestId, requestedAt: NOW,
      status: 'pending', attemptCount: 0,
    });
    expect(db.rows.quoteRequests).toEqual([savedQuote]);
    const savedRequestId = db.rows.quoteDiscussionRequests[0]._id;
    expect(jobs).toEqual([
      { delayMs: 0, name: 'quoteDiscussions:deliver', args: { requestId: savedRequestId } },
      {
        delayMs: 0, name: 'notifications:sendScheduleRequestSms',
        args: { quoteRequestId: quoteId, scheduleRequestId: savedRequestId },
      },
      {
        delayMs: 0, name: 'notifications:sendScheduleRequestEmailAlerts',
        args: { quoteRequestId: quoteId, scheduleRequestId: savedRequestId },
      },
    ]);
    expect(db.rows.quoteDiscussionRequests[0]).toMatchObject({
      smsAlertStatus: 'queued', emailAlertStatus: 'queued',
    });
  });

  it('dedupes a lost-response retry after token expiry without changing request time or enqueuing another job', async () => {
    const { ctx, db, jobs } = setup(false);
    const first = await requestDiscussionMutation(ctx, requestArgs());
    jest.setSystemTime(NOW + 120_000);
    const second = await requestDiscussionMutation(ctx, requestArgs());
    expect(second).toEqual({ ...first, status: 'deduped' });
    expect(db.rows.quoteDiscussionRequests).toHaveLength(1);
    expect(db.rows.quoteDiscussionRequests[0].requestedAt).toBe(NOW);
    // One delivery and one text and email alert from the first tap; the retry adds none.
    expect(jobs).toHaveLength(3);
  });

  it.each([
    { writeKey: 'invalid-write-key' },
    { tenantSlug: 'different-tenant' },
    { publicId: 'different-quote' },
    { tokenHash: 'b'.repeat(64) },
    { tokenHash: 'invalid' },
  ])('rejects unauthorized request arguments %j without side effects', async overrides => {
    const { ctx, db, jobs } = setup(false);
    await expect(requestDiscussionMutation(ctx, { ...requestArgs(), ...overrides })).rejects.toThrow();
    expect(db.rows.quoteDiscussionRequests).toHaveLength(0);
    expect(jobs).toHaveLength(0);
  });

  it.each(['inactive', 'wrong-quote-tenant', 'missing-capability', 'expired'] as const)('rejects a %s source quote', async scenario => {
    const { ctx, db, jobs } = setup(false);
    if (scenario === 'inactive') db.rows.tenants[0].active = false;
    if (scenario === 'wrong-quote-tenant') db.rows.quoteRequests[0].tenantId = 'another-tenant';
    if (scenario === 'missing-capability') delete db.rows.quoteRequests[0].discussionTokenHash;
    if (scenario === 'expired') db.rows.quoteRequests[0].discussionTokenExpiresAt = NOW;
    await expect(requestDiscussionMutation(ctx, requestArgs())).rejects.toThrow();
    expect(db.rows.quoteDiscussionRequests).toHaveLength(0);
    expect(jobs).toHaveLength(0);
  });

  it('requires the correct token even when the discussion already exists', async () => {
    const { ctx } = setup();
    await expect(requestDiscussionMutation(ctx, { ...requestArgs(), tokenHash: 'b'.repeat(64) })).rejects.toThrow();
  });

  it('claims once and sends identifiers for the saved snapshot without contact details', async () => {
    const { ctx, db } = setup();
    expect(await claimDiscussionMutation(ctx, { requestId })).toEqual({ attemptNumber: 1, payload });
    expect(db.rows.quoteDiscussionRequests[0]).toMatchObject({ status: 'processing', attemptCount: 1, lastAttemptAt: NOW });
    expect(db.rows.quoteDiscussionRequests[0]).not.toHaveProperty('nextAttemptAt');
    expect(await claimDiscussionMutation(ctx, { requestId })).toBeNull();
  });

  it.each(['pending', 'dead_letter', 'missing', 'unbound', 'wrong-tenant', 'wrong-quote', 'wrong-external-id'] as const)(
    'waits for a %s parent without consuming discussion delivery attempts', async scenario => {
      const { ctx, db, jobs } = setup();
      const parent = db.rows.crmQuoteSyncOutbox[0];
      if (scenario === 'pending' || scenario === 'dead_letter') parent.status = scenario;
      if (scenario === 'missing') db.rows.crmQuoteSyncOutbox = [];
      if (scenario === 'unbound') delete parent.acknowledgementBindingVersion;
      if (scenario === 'wrong-tenant') parent.tenantId = 'other-tenant';
      if (scenario === 'wrong-quote') parent.quoteRequestId = 'other-quote';
      if (scenario === 'wrong-external-id') parent.externalSubmissionId = 'shed210:quote:other';
      expect(await claimDiscussionMutation(ctx, { requestId })).toBeNull();
      expect(db.rows.quoteDiscussionRequests[0]).toMatchObject({ status: 'pending', attemptCount: 0, nextAttemptAt: NOW + 60_000 });
      expect(jobs).toHaveLength(0);
      expect(await claimDiscussionMutation(ctx, { requestId })).toBeNull();
    }
  );

  it.each(['tenant', 'quote', 'event', 'missing-quote'] as const)('dead letters a broken %s identity without attempting delivery', async scenario => {
    const { ctx, db } = setup();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    if (scenario === 'tenant') db.rows.quoteDiscussionRequests[0].tenantId = 'other-tenant';
    if (scenario === 'quote') db.rows.quoteRequests[0].tenantId = 'other-tenant';
    if (scenario === 'event') db.rows.quoteDiscussionRequests[0].externalRequestId = 'other-event';
    if (scenario === 'missing-quote') db.rows.quoteRequests = [];
    expect(await claimDiscussionMutation(ctx, { requestId })).toBeNull();
    expect(db.rows.quoteDiscussionRequests[0]).toMatchObject({ status: 'dead_letter', attemptCount: 0 });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('CRM quote discussion dead-lettered', {
      requestId, quoteRequestId: quoteId, attemptNumber: 0, error: 'Quote identity unavailable',
    });
  });

  it('ignores completion from an older worker and accepts the matching attempt only once', async () => {
    const { ctx, db, jobs } = setup();
    await claimDiscussionMutation(ctx, { requestId });
    db.rows.quoteDiscussionRequests[0].attemptCount = 2;
    await completeDiscussionMutation(ctx, { requestId, attemptNumber: 1, outcome: 'succeeded' });
    expect(db.rows.quoteDiscussionRequests[0].status).toBe('processing');
    await completeDiscussionMutation(ctx, { requestId, attemptNumber: 2, outcome: 'succeeded' });
    expect(db.rows.quoteDiscussionRequests[0]).toMatchObject({ status: 'succeeded', completedAt: NOW });
    await completeDiscussionMutation(ctx, { requestId, attemptNumber: 2, outcome: 'retryable' });
    expect(db.rows.quoteDiscussionRequests[0].status).toBe('succeeded');
    expect(jobs).toHaveLength(0);
  });

  it('retries transient delivery with the same event and timestamp, then stops after its retry budget', async () => {
    const { ctx, db, jobs } = setup();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    for (let attempt = 1; attempt <= CRM_QUOTE_SYNC_RETRY_DELAYS_MS.length + 1; attempt++) {
      const claimed = await claimDiscussionMutation(ctx, { requestId });
      expect(claimed).toEqual({ attemptNumber: attempt, payload });
      const now = Date.now();
      await completeDiscussionMutation(ctx, { requestId, attemptNumber: attempt, outcome: 'retryable', error: 'timeout' });
      const delay = CRM_QUOTE_SYNC_RETRY_DELAYS_MS[attempt - 1];
      if (delay !== undefined) {
        expect(db.rows.quoteDiscussionRequests[0]).toMatchObject({ status: 'retry_scheduled', nextAttemptAt: now + delay });
        expect(await claimDiscussionMutation(ctx, { requestId })).toBeNull();
        jest.setSystemTime(now + delay);
      }
    }
    expect(db.rows.quoteDiscussionRequests[0].status).toBe('dead_letter');
    expect(jobs.map(job => job.delayMs)).toEqual(CRM_QUOTE_SYNC_RETRY_DELAYS_MS);
    expect(await claimDiscussionMutation(ctx, { requestId })).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('CRM quote discussion dead-lettered', {
      requestId, quoteRequestId: quoteId, attemptNumber: CRM_QUOTE_SYNC_RETRY_DELAYS_MS.length + 1, error: 'timeout',
    });
  });

  it('dead letters permanent failures immediately and bounds stored errors', async () => {
    const { ctx, db, jobs } = setup();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await claimDiscussionMutation(ctx, { requestId });
    await completeDiscussionMutation(ctx, { requestId, attemptNumber: 1, outcome: 'permanent', error: 'x'.repeat(500) });
    expect(db.rows.quoteDiscussionRequests[0]).toMatchObject({ status: 'dead_letter', lastError: 'x'.repeat(200) });
    expect(jobs).toHaveLength(0);
    // Exactly one line carrying ids and the stored error; no quote or contact fields.
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('CRM quote discussion dead-lettered', {
      requestId, quoteRequestId: quoteId, attemptNumber: 1, error: 'x'.repeat(200),
    });
  });

  it('recovers due and stale work while leaving future, recent, and completed rows alone', async () => {
    const { ctx, db, jobs } = setup();
    const row = db.rows.quoteDiscussionRequests[0];
    db.rows.quoteDiscussionRequests.push(
      { ...row, _id: 'retry-due', status: 'retry_scheduled' },
      { ...row, _id: 'future', nextAttemptAt: NOW + 1000 },
      { ...row, _id: 'stale', status: 'processing', attemptCount: 1, lastAttemptAt: NOW - CRM_QUOTE_SYNC_PROCESSING_STALE_MS },
      { ...row, _id: 'recent', status: 'processing', attemptCount: 1, lastAttemptAt: NOW },
      { ...row, _id: 'done', status: 'succeeded' },
    );
    await recoverDiscussionsMutation(ctx);
    expect(jobs).toEqual([
      { delayMs: 0, name: 'quoteDiscussions:deliver', args: { requestId } },
      { delayMs: 0, name: 'quoteDiscussions:deliver', args: { requestId: 'retry-due' } },
      { delayMs: CRM_QUOTE_SYNC_RETRY_DELAYS_MS[0], name: 'quoteDiscussions:deliver', args: { requestId: 'stale' } },
    ]);
    expect(await db.get('stale')).toMatchObject({ status: 'retry_scheduled', lastError: 'Interrupted delivery' });
    expect(await db.get('recent')).toMatchObject({ status: 'processing' });
  });

  it('does not schedule recovery while CRM syncing is disabled', async () => {
    const { ctx, jobs } = setup();
    process.env.SHED_CRM_SYNC_ENABLED = 'false';
    await recoverDiscussionsMutation(ctx);
    expect(jobs).toHaveLength(0);
  });

  it.each(['created', 'deduped'])('accepts a bound %s CRM acknowledgement with stable delivery identifiers', async status => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...acknowledgement, status }) });
    expect(await postDiscussion('https://crm.example/api/intake/shed-quote-discussion', 'test-intake-key', payload)).toEqual({ outcome: 'succeeded' });
    expect(global.fetch).toHaveBeenCalledWith('https://crm.example/api/intake/shed-quote-discussion', expect.objectContaining({
      method: 'POST', redirect: 'error', body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-intake-key', 'Idempotency-Key': externalRequestId },
    }));
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['tenantSlug', 'externalRequestId', 'quoteExternalSubmissionId', 'publicId', 'sourceDocumentId', 'status'])(
    'retries an unbound %s success response', async field => {
      const mismatched = { ...acknowledgement, [field]: 'different' };
      expect(isDiscussionAcknowledgement(mismatched, payload)).toBe(false);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => mismatched });
      expect(await postDiscussion('https://crm.example', 'test-key', payload)).toEqual({ outcome: 'retryable', error: 'CRM acknowledgement mismatch' });
    }
  );

  it('retries malformed JSON from a success response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } });
    expect(await postDiscussion('https://crm.example', 'test-key', payload)).toEqual({ outcome: 'retryable', error: 'CRM acknowledgement mismatch' });
  });

  // 401/403/404/405 are intake-key or receiver-route problems, so a fix inside the retry window self-heals.
  it.each([401, 403, 404, 405, 408, 429, 500, 502, 503])('retries HTTP %s', async status => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
    expect(await postDiscussion('https://crm.example', 'test-key', payload)).toEqual({ outcome: 'retryable', error: `CRM HTTP ${status}` });
  });

  it.each([400, 409, 413, 422])('does not retry permanent HTTP %s', async status => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
    expect(await postDiscussion('https://crm.example', 'test-key', payload)).toEqual({ outcome: 'permanent', error: `CRM HTTP ${status}` });
  });

  it('retries a network error without retaining provider exception details', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('private provider diagnostic'));
    expect(await postDiscussion('https://crm.example', 'test-key', payload)).toEqual({ outcome: 'retryable', error: 'CRM request failed or timed out' });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts a stalled request and makes it retryable', async () => {
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = postDiscussion('https://crm.example', 'test-key', payload);
    await jest.advanceTimersByTimeAsync(CRM_QUOTE_SYNC_REQUEST_TIMEOUT_MS);
    expect(await pending).toEqual({ outcome: 'retryable', error: 'CRM request failed or timed out' });
    expect((global.fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
