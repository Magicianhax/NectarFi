'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, setAuthTokenGetter } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';
import { formatUnits } from 'viem';

export interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
  formatted: number;
}

export interface OnchainPosition {
  protocol: string;
  asset: string;
  balance: string;
  formatted: number;
  decimals: number;
  apy: number;
  valueUsd: number;
}

export function useAgent() {
  const { user, authenticated, getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [agentWallet, setAgentWallet] = useState<string | null>(null);
  const [wsMessages, setWsMessages] = useState<Array<{ event: string; data: Record<string, unknown>; timestamp: string }>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const historyLoaded = useRef(false);

  // Set Privy auth token getter for all API calls
  useEffect(() => {
    if (authenticated) {
      setAuthTokenGetter(getAccessToken);
    }
    return () => setAuthTokenGetter(() => Promise.resolve(null));
  }, [authenticated, getAccessToken]);

  // Auth on connect
  useEffect(() => {
    if (!authenticated || !user?.wallet?.address) return;
    api.auth(user.wallet.address).then((data) => {
      setUserId(data.userId);
      setAgentWallet(data.agentWallet);
    });
  }, [authenticated, user]);

  // Fetch persisted activity history on mount
  useEffect(() => {
    if (historyLoaded.current) return;
    historyLoaded.current = true;
    api.getActivity().then((data) => {
      if (data.activities?.length) {
        setWsMessages(data.activities);
      }
    }).catch(() => {});
  }, []);

  // WebSocket connection for live updates (with auto-reconnect)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/^http/, 'ws');
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setWsMessages((prev) => [msg, ...prev].slice(0, 200));
        } catch {
          // Ignore malformed messages
        }
      };
      ws.onclose = () => {
        if (!unmounted) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => ws?.close();
      wsRef.current = ws;
    }

    connect();
    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  const yields = useQuery({
    queryKey: ['yields'],
    queryFn: api.getYields,
    refetchInterval: 60_000,
  });

  const trends = useQuery({
    queryKey: ['trends'],
    queryFn: api.getTrends,
    refetchInterval: 60_000,
  });

  const portfolio = useQuery({
    queryKey: ['portfolio', userId],
    queryFn: () => api.getPortfolio(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  const history = useQuery({
    queryKey: ['history', userId],
    queryFn: () => api.getHistory(userId!),
    enabled: !!userId,
  });

  // Agent wallet balances (idle tokens)
  const agentBalances = useQuery({
    queryKey: ['agentBalances', agentWallet],
    queryFn: async (): Promise<TokenBalance[]> => {
      const data = await api.getBalances(agentWallet!);
      return data.balances.map((b: { symbol: string; balance: string; decimals: number }) => ({
        symbol: b.symbol,
        balance: b.balance,
        decimals: b.decimals,
        formatted: parseFloat(formatUnits(BigInt(b.balance), b.decimals)),
      }));
    },
    enabled: !!agentWallet,
    refetchInterval: 30_000,
  });

  // On-chain protocol positions (aTokens, vTokens)
  const onchainPositions = useQuery({
    queryKey: ['onchainPositions', agentWallet],
    queryFn: async (): Promise<OnchainPosition[]> => {
      const data = await api.getPositions(agentWallet!);
      return data.positions;
    },
    enabled: !!agentWallet,
    refetchInterval: 30_000,
  });

  // Live token prices
  const prices = useQuery({
    queryKey: ['prices'],
    queryFn: async () => {
      const data = await api.getPrices();
      return data.prices as Record<string, number>;
    },
    refetchInterval: 60_000,
  });

  // Agent running status
  const agentStatus = useQuery({
    queryKey: ['agentStatus'],
    queryFn: async () => {
      const data = await api.getAgentStatus();
      return data.running as boolean;
    },
    refetchInterval: 10_000,
  });

  const rebalance = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Not authenticated');
      return api.triggerRebalance(userId);
    },
    onSuccess: () => {
      // Refresh positions and balances after rebalance
      queryClient.invalidateQueries({ queryKey: ['onchainPositions'] });
      queryClient.invalidateQueries({ queryKey: ['agentBalances'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  const startAgent = useMutation({
    mutationFn: () => api.startAgent(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentStatus'] });
      // The agent runs a rebalance in the background — refetch positions/balances after a delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['onchainPositions'] });
        queryClient.invalidateQueries({ queryKey: ['agentBalances'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      }, 15000);
    },
  });

  const stopAgent = useMutation({
    mutationFn: () => api.stopAgent(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agentStatus'] }),
  });

  const transferToEoa = useMutation({
    mutationFn: ({ symbol, toAddress, amount }: { symbol: string; toAddress: string; amount?: string }) =>
      api.transferToEoa(symbol, toAddress, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentBalances'] });
    },
  });

  const withdraw = useMutation({
    mutationFn: ({ protocol, asset }: { protocol: string; asset: string }) =>
      api.withdraw(protocol, asset),
    onSuccess: (_data, variables) => {
      // Optimistically remove the withdrawn position from cache immediately
      queryClient.setQueryData(
        ['onchainPositions', agentWallet],
        (old: OnchainPosition[] | undefined) =>
          old ? old.filter(p => !(p.protocol === variables.protocol && p.asset === variables.asset)) : [],
      );
      // Delayed refetch to sync with on-chain state
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['onchainPositions'] });
        queryClient.invalidateQueries({ queryKey: ['agentBalances'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      }, 5000);
    },
  });

  const windDown = useMutation({
    mutationFn: () => api.windDown(),
    onSuccess: () => {
      // Optimistically clear all positions from cache immediately
      queryClient.setQueryData(['onchainPositions', agentWallet], []);
      // Delayed refetch to sync with on-chain state
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['onchainPositions'] });
        queryClient.invalidateQueries({ queryKey: ['agentBalances'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      }, 5000);
    },
  });

  const swap = useMutation({
    mutationFn: ({ tokenIn, tokenOut, amount }: { tokenIn: string; tokenOut: string; amount: string }) =>
      api.swap(tokenIn, tokenOut, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentBalances'] });
    },
  });

  const rebalancePreview = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Not authenticated');
      return api.rebalancePreview(userId);
    },
  });

  const refreshBalances = () => {
    queryClient.invalidateQueries({ queryKey: ['agentBalances'] });
    queryClient.invalidateQueries({ queryKey: ['onchainPositions'] });
    queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  };

  return {
    userId,
    agentWallet,
    yields,
    trends,
    portfolio,
    history,
    rebalance,
    wsMessages,
    agentBalances,
    onchainPositions,
    agentStatus,
    startAgent,
    stopAgent,
    withdraw,
    windDown,
    transferToEoa,
    prices,
    swap,
    rebalancePreview,
    refreshBalances,
  };
}
