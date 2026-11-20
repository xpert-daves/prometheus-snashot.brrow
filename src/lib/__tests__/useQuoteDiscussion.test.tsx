import { act, renderHook } from '@testing-library/react';
import { useQuoteDiscussion } from '../useQuoteDiscussion';

function receipt(status: 'created' | 'deduped' = 'created') {
  return { ok: true, json: async () => ({ ok: true, requestId: 'discussion-1', status }) } as Response;
}

describe('useQuoteDiscussion', () => {
  it.each(['created', 'deduped'] as const)('saves a %s receipt without submitting another quote or repeating the action', async (status) => {
    let finish!: (response: Response) => void;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useQuoteDiscussion('quote-123', 'private-action-token'));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.requestDiscussion();
      void result.current.requestDiscussion();
    });
    expect(result.current.state.status).toBe('sending');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/quote/discussion', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ quoteId: 'quote-123', actionToken: 'private-action-token' }),
    }));

    await act(async () => { finish(receipt(status)); await pending; });
    expect(result.current.state).toMatchObject({ status: 'saved', requestId: 'discussion-1' });
    await act(async () => { await result.current.requestDiscussion(); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores the old response after another saved configuration becomes current', async () => {
    let finishOld!: (response: Response) => void;
    const fetchMock = jest.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce(receipt());
    global.fetch = fetchMock;
    const { result, rerender } = renderHook(({ id, token }) => useQuoteDiscussion(id, token), {
      initialProps: { id: 'quote-1', token: 'token-1' },
    });
    let pending!: Promise<void>;
    act(() => { pending = result.current.requestDiscussion(); });
    const oldSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;

    rerender({ id: 'quote-2', token: 'token-2' });
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.state.status).toBe('idle');
    await act(async () => { finishOld(receipt()); await pending; });
    expect(result.current.state.status).toBe('idle');

    await act(async () => { await result.current.requestDiscussion(); });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ quoteId: 'quote-2', actionToken: 'token-2' });
    expect(result.current.state.status).toBe('saved');
  });

  it('allows retrying the same configuration after a network failure', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce(receipt('deduped'));
    const { result } = renderHook(() => useQuoteDiscussion('quote-123', 'private-action-token'));
    await act(async () => { await result.current.requestDiscussion(); });
    expect(result.current.state.status).toBe('error');
    await act(async () => { await result.current.requestDiscussion(); });
    expect(result.current.state.status).toBe('saved');
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][1].body).toEqual(calls[1][1].body);
  });

  it.each([
    { ok: true, json: async () => ({ ok: true, status: 'created' }) },
    { ok: true, json: async () => ({ ok: true, status: 'unknown', requestId: 'id' }) },
    { ok: false, status: 500, json: async () => ({ error: 'internal detail' }) },
  ])('does not claim a save without a valid successful receipt', async (response) => {
    global.fetch = jest.fn().mockResolvedValue(response);
    const { result } = renderHook(() => useQuoteDiscussion('quote-123', 'token'));
    await act(async () => { await result.current.requestDiscussion(); });
    expect(result.current.state.status).toBe('error');
  });

  it('aborts on unmount without applying a late response', async () => {
    let finish!: (response: Response) => void;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const { result, unmount } = renderHook(() => useQuoteDiscussion('quote-123', 'token'));
    let pending!: Promise<void>;
    act(() => { pending = result.current.requestDiscussion(); });
    const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { finish(receipt()); await pending; });
  });

  it.each([
    [410, 'This estimate’s scheduling link has expired. Use Compare another option to get a fresh estimate, then tap Ready to schedule.'],
    [429, 'Please wait a moment before trying again.'],
  ])('shows controlled guidance for HTTP %s without rendering server errors', async (status, message) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ error: 'private server diagnostic' }),
    });
    const { result } = renderHook(() => useQuoteDiscussion('quote-123', 'token'));
    await act(async () => { await result.current.requestDiscussion(); });
    expect(result.current.state).toMatchObject({ status: 'error', message });
  });
});
