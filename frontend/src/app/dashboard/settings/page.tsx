'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { api } from '@/lib/api';
import { useAgent } from '@/hooks/use-agent';
import { toast } from 'sonner';
import { TOKEN_LOGOS, PROTOCOL_LOGOS } from '@/lib/logos';

const PROTOCOLS = [
  { id: 'venus', label: 'Venus', color: '#F0B90B' },
  { id: 'aave', label: 'Aave', color: '#B6509E' },
  { id: 'lista', label: 'Lista', color: '#00C087' },
];
const ASSETS = ['USDT', 'USDC', 'BTCB', 'WETH', 'WBNB', 'FDUSD', 'USD1'];

export default function SettingsPage() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const { userId } = useAgent();

  const [riskLevel, setRiskLevel] = useState('medium');
  const [minTvl, setMinTvl] = useState(10);
  const [apyThreshold, setApyThreshold] = useState(2.0);
  const [maxPerProtocol, setMaxPerProtocol] = useState(50);
  const [cooldownHours, setCooldownHours] = useState(6);
  const [protocols, setProtocols] = useState<string[]>(['venus', 'aave', 'lista']);
  const [assets, setAssets] = useState<string[]>(['USDT', 'USDC', 'BTCB', 'WETH', 'WBNB']);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  // Load saved settings from backend (handles both snake_case DB rows and camelCase defaults)
  useEffect(() => {
    if (!userId) return;
    api.getSettings(userId).then((s) => {
      const rl = s.risk_level || s.riskLevel;
      if (rl) setRiskLevel(rl);
      const tvl = s.min_tvl ?? s.minTvl;
      if (tvl != null) setMinTvl(Math.round(Number(tvl) / 1_000_000));
      const apy = s.apy_threshold ?? s.apyThreshold;
      if (apy != null) setApyThreshold(Number(apy));
      const mpp = s.max_per_protocol ?? s.maxPerProtocol;
      if (mpp != null) setMaxPerProtocol(Number(mpp));
      const cd = s.rebalance_cooldown_hours ?? s.rebalanceCooldownHours;
      if (cd != null) setCooldownHours(Number(cd));
      const wp = s.whitelisted_protocols || s.whitelistedProtocols;
      if (wp) setProtocols(wp);
      const wa = s.whitelisted_assets || s.whitelistedAssets;
      if (wa) setAssets(wa);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const toggleProtocol = (p: string) => {
    setProtocols((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const toggleAsset = (a: string) => {
    setAssets((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await api.updateSettings(userId, {
        risk_level: riskLevel,
        min_tvl: minTvl * 1_000_000,
        apy_threshold: apyThreshold,
        max_per_protocol: maxPerProtocol,
        rebalance_cooldown_hours: cooldownHours,
        whitelisted_protocols: protocols,
        whitelisted_assets: assets,
      });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const riskGaugeWidth = riskLevel === 'low' ? 33 : riskLevel === 'medium' ? 66 : 100;
  const riskColor = riskLevel === 'low' ? '#00C087' : riskLevel === 'medium' ? '#F0B90B' : '#FF4466';

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <header className="skeuo-panel px-5 py-3 flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #FFD54F 0%, #F0B90B 50%, #C49A09 100%)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0c0c0f" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-emboss">Agent Settings</h1>
              <p className="text-[10px] text-muted-foreground">Configure risk parameters</p>
            </div>
          </div>
          <Link href="/dashboard">
            <button className="skeuo-button-dark px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </button>
          </Link>
        </header>

        {/* Risk & Strategy */}
        <div className="skeuo-panel p-5 space-y-5 animate-fade-up-1">
          <div className="flex items-center gap-2">
            <div className="led-gold" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">Risk & Strategy</h3>
          </div>

          <div className="skeuo-divider" />

          {/* Risk Level */}
          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Risk Level</label>
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger className="skeuo-input border-0 h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low &mdash; Stables Only</SelectItem>
                <SelectItem value="medium">Medium &mdash; Stables + Majors</SelectItem>
                <SelectItem value="high">High &mdash; All Assets</SelectItem>
              </SelectContent>
            </Select>
            <div className="gauge-track">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${riskGaugeWidth}%`,
                  background: `linear-gradient(90deg, ${riskColor}88, ${riskColor})`,
                  boxShadow: `0 0 10px ${riskColor}66`,
                }}
              />
            </div>
          </div>

          {/* Min TVL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Minimum TVL</label>
              <span className="font-mono text-xs text-gold-glow font-bold">${minTvl}M</span>
            </div>
            <Slider
              value={[minTvl]}
              onValueChange={([v]) => setMinTvl(v)}
              min={1}
              max={100}
              step={1}
            />
          </div>

          {/* APY Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">APY Improvement Threshold</label>
              <span className="font-mono text-xs text-gold-glow font-bold">{apyThreshold}%</span>
            </div>
            <Slider
              value={[apyThreshold]}
              onValueChange={([v]) => setApyThreshold(v)}
              min={0.5}
              max={10}
              step={0.5}
            />
            <p className="text-[10px] text-muted-foreground">
              Agent only moves funds when APY improvement exceeds this threshold
            </p>
          </div>

          {/* Max Per Protocol */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Max Allocation per Protocol</label>
              <span className="font-mono text-xs text-gold-glow font-bold">{maxPerProtocol}%</span>
            </div>
            <Slider
              value={[maxPerProtocol]}
              onValueChange={([v]) => setMaxPerProtocol(v)}
              min={20}
              max={100}
              step={5}
            />
          </div>

          {/* Cooldown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Rebalance Cooldown</label>
              <span className="font-mono text-xs text-gold-glow font-bold">{cooldownHours}h</span>
            </div>
            <Slider
              value={[cooldownHours]}
              onValueChange={([v]) => setCooldownHours(v)}
              min={1}
              max={48}
              step={1}
            />
          </div>
        </div>

        {/* Protocols */}
        <div className="skeuo-panel p-5 space-y-4 animate-fade-up-2">
          <div className="flex items-center gap-2">
            <div className="led-green" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">Whitelisted Protocols</h3>
          </div>

          <div className="skeuo-divider" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PROTOCOLS.map((p) => {
              const active = protocols.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProtocol(p.id)}
                  className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    active ? 'skeuo-button-gold' : 'skeuo-button-dark opacity-50'
                  }`}
                >
                  {PROTOCOL_LOGOS[p.id] ? (
                    <img src={PROTOCOL_LOGOS[p.id]} alt={p.label} width={16} height={16} className="rounded-full" />
                  ) : active ? (
                    <div className="led-green" style={{ width: 6, height: 6, boxShadow: 'none' }} />
                  ) : null}
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Assets */}
        <div className="skeuo-panel p-5 space-y-4 animate-fade-up-3">
          <div className="flex items-center gap-2">
            <div className="led-green" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-emboss">Whitelisted Assets</h3>
          </div>

          <div className="skeuo-divider" />

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {ASSETS.map((a) => {
              const active = assets.includes(a);
              return (
                <button
                  key={a}
                  onClick={() => toggleAsset(a)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    active ? 'skeuo-button-gold' : 'skeuo-button-dark opacity-50'
                  }`}
                >
                  {TOKEN_LOGOS[a] && (
                    <img src={TOKEN_LOGOS[a]} alt={a} width={14} height={14} className="rounded-full" />
                  )}
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <div className="animate-fade-up-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="skeuo-button-gold w-full py-3.5 rounded-xl text-sm font-bold tracking-wide disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
