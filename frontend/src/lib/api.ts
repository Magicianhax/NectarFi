const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Auth token getter — set by useAgent hook after Privy login
let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  authTokenGetter = fn;
}

async function fetchApi(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Attach Privy auth token if available
  if (authTokenGetter) {
    try {
      const token = await authTokenGetter();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Token fetch failed — proceed without auth (will 401 on protected routes)
    }
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    throw new Error((body as Record<string, string>).error || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getYields: () => fetchApi('/yields'),
  getTrends: () => fetchApi('/trends'),
  auth: (eoaAddress: string) => fetchApi('/auth', {
    method: 'POST',
    body: JSON.stringify({ eoaAddress }),
  }),
  getPortfolio: (userId: string) => fetchApi(`/portfolio/${userId}`),
  getHistory: (userId: string, opts?: { type?: string; asset?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (opts?.type) params.set('type', opts.type);
    if (opts?.asset) params.set('asset', opts.asset);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const query = params.toString();
    return fetchApi(`/history/${userId}${query ? `?${query}` : ''}`);
  },
  getSettings: (userId: string) => fetchApi(`/settings/${userId}`),
  updateSettings: (userId: string, settings: Record<string, unknown>) => fetchApi(`/settings/${userId}`, {
    method: 'POST',
    body: JSON.stringify(settings),
  }),
  triggerRebalance: (userId: string) => fetchApi(`/rebalance/${userId}`, {
    method: 'POST',
  }),
  getWalletInfo: (userId: string) => fetchApi(`/wallet-info/${userId}`),
  exportWallet: (userId: string) => fetchApi(`/export-wallet/${userId}`, { method: 'POST' }),
  getBalances: (address: string) => fetchApi(`/balances/${address}`),
  getPositions: (address: string) => fetchApi(`/positions/${address}`),
  startAgent: () => fetchApi('/agent/start', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  stopAgent: () => fetchApi('/agent/stop', { method: 'POST' }),
  getAgentStatus: () => fetchApi('/agent/status'),
  transferToEoa: (symbol: string, toAddress: string, amount?: string) => fetchApi('/transfer-to-eoa', {
    method: 'POST',
    body: JSON.stringify({ symbol, toAddress, ...(amount ? { amount } : {}) }),
  }),
  withdraw: (protocol: string, asset: string) => fetchApi('/withdraw', {
    method: 'POST',
    body: JSON.stringify({ protocol, asset }),
  }),
  logDeposit: (asset: string, amount: string, txHash: string) => fetchApi('/log-deposit', {
    method: 'POST',
    body: JSON.stringify({ asset, amount, txHash }),
  }),
  getActivity: () => fetchApi('/activity'),
  getPrices: () => fetchApi('/prices'),
  swap: (tokenIn: string, tokenOut: string, amount: string) => fetchApi('/swap', {
    method: 'POST',
    body: JSON.stringify({ tokenIn, tokenOut, amount }),
  }),
  rebalancePreview: (userId: string) => fetchApi(`/rebalance-preview/${userId}`, { method: 'POST' }),
  windDown: () => fetchApi('/wind-down', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  getYieldHistory: (protocol?: string, asset?: string, days?: number) => {
    const params = new URLSearchParams();
    if (protocol) params.set('protocol', protocol);
    if (asset) params.set('asset', asset);
    if (days) params.set('days', String(days));
    const query = params.toString();
    return fetchApi(`/yield-history${query ? `?${query}` : ''}`);
  },
  getPortfolioHistory: (userId: string, days?: number) =>
    fetchApi(`/portfolio-history/${userId}${days ? `?days=${days}` : ''}`),
};
