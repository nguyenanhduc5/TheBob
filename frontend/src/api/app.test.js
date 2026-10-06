import { apiClient } from './app';

const response = (status, data) => ({
  status, ok: status === 200,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(data),
  json: async () => data,
});

test('concurrent requests reject on refresh network failure and can refresh again', async () => {
  const originalFetch = global.fetch;
  localStorage.setItem('thebob-token', 'old');
  localStorage.setItem('thebob-refresh-token', 'refresh');
  let rejectRefresh;
  const pendingRefresh = new Promise((resolve, reject) => { rejectRefresh = reject; });
  let refreshStarted;
  const started = new Promise(resolve => { refreshStarted = resolve; });
  global.fetch = jest.fn((url) => {
    if (url.endsWith('/auth/refresh-token')) {
      refreshStarted();
      return pendingRefresh;
    }
    return Promise.resolve(response(401, {}));
  });
  try {
    const requests = Promise.allSettled([
      apiClient('/chat/conversations', { auth: true }),
      apiClient('/chat/messages', { auth: true }),
    ]);
    await started;
    rejectRefresh(new Error('offline'));
    expect((await requests).map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(global.fetch.mock.calls.filter(([url]) => url.endsWith('/auth/refresh-token'))).toHaveLength(1);

    global.fetch.mockImplementation((url, options) => Promise.resolve(
      url.endsWith('/auth/refresh-token')
        ? response(200, { data: { token: 'new' } })
        : response(options.headers.Authorization === 'Bearer new' ? 200 : 401, { items: [] })
    ));
    await expect(apiClient('/chat/messages', { auth: true })).resolves.toEqual({ items: [] });
  } finally {
    global.fetch = originalFetch;
    localStorage.clear();
  }
});
