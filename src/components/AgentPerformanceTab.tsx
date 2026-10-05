import React, { useState, useMemo } from 'react';
import { SimData, AgentHyperparams, HoldingTimelineEntry } from '../types/market';
import { nsToDisplay, generateHyperparams } from '../services/simulator';
import { ShieldCheck, Cpu, Brain, DollarSign, Briefcase, Info, TrendingUp, TrendingDown, Compass, Layers } from 'lucide-react';
import { MomentumAgentSection } from './MomentumAgentSection';

interface AgentPerformanceTabProps {
  simData: SimData;
}

interface HyperparamDef {
  key: keyof AgentHyperparams;
  name: string;
  symbol: string;
  min: number;
  max: number;
  format: (v: number) => string;
  description: string;
  badgeColor: string;
  barGradient: string;
}

const HYPERPARAM_DEFS: HyperparamDef[] = [
  {
    key: 'beta',
    name: 'Aggression Multiplier',
    symbol: 'β',
    min: 5,
    max: 20,
    format: (v) => v.toFixed(2),
    description: 'Volume multiplier on mispricing',
    badgeColor: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
    barGradient: 'from-amber-500 to-orange-500',
  },
  {
    key: 'er_window',
    name: 'Kaufman ER Memory',
    symbol: 'er_window',
    min: 5,
    max: 25,
    format: (v) => `${Math.round(v)} ticks`,
    description: 'Trend vs noise lookback window',
    badgeColor: 'text-sky-400 bg-sky-950/40 border-sky-800/40',
    barGradient: 'from-sky-500 to-blue-500',
  },
  {
    key: 'delta',
    name: 'Noise Sensitivity',
    symbol: 'δ',
    min: 0.002,
    max: 0.015,
    format: (v) => v.toFixed(4),
    description: 'Base variance fraction of price',
    badgeColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
    barGradient: 'from-emerald-500 to-teal-500',
  },
  {
    key: 'lambda_er',
    name: 'Trend Trust Factor',
    symbol: 'λ_er',
    min: 1.0,
    max: 6.0,
    format: (v) => v.toFixed(2),
    description: 'Exponential penalty on noise (1-ER)',
    badgeColor: 'text-indigo-400 bg-indigo-950/40 border-indigo-800/40',
    barGradient: 'from-indigo-500 to-violet-500',
  },
  {
    key: 'sigma_n',
    name: 'Oracle Noise Quality',
    symbol: 'σ_n',
    min: 300,
    max: 3000,
    format: (v) => v.toFixed(1),
    description: 'Private oracle error standard deviation',
    badgeColor: 'text-purple-400 bg-purple-950/40 border-purple-800/40',
    barGradient: 'from-purple-500 to-pink-500',
  },
  {
    key: 'gamma',
    name: 'Emotional Retention',
    symbol: 'γ',
    min: 0.4,
    max: 0.95,
    format: (v) => v.toFixed(3),
    description: 'EWMA weight on historical trade P&L',
    badgeColor: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
    barGradient: 'from-rose-500 to-red-500',
  },
  {
    key: 'k',
    name: 'Sigmoid Sensitivity',
    symbol: 'k',
    min: 0.3,
    max: 2.5,
    format: (v) => v.toFixed(3),
    description: 'Steepness of confidence logistic curve',
    badgeColor: 'text-teal-400 bg-teal-950/40 border-teal-800/40',
    barGradient: 'from-teal-500 to-emerald-500',
  },
  {
    key: 'mu',
    name: 'Limit Safety Margin',
    symbol: 'μ',
    min: 0.02,
    max: 0.2,
    format: (v) => v.toFixed(4),
    description: 'Epistemic safety ceiling and floor',
    badgeColor: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/40',
    barGradient: 'from-yellow-500 to-amber-500',
  },
  {
    key: 'news_sensitivity',
    name: 'News Reaction Factor',
    symbol: 'news_sens',
    min: 0.005,
    max: 0.04,
    format: (v) => `${(v * 100).toFixed(2)}%`,
    description: 'Max anchor shift per sentiment shock',
    badgeColor: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/40',
    barGradient: 'from-cyan-500 to-blue-500',
  },
];

export const AgentPerformanceTab: React.FC<AgentPerformanceTabProps> = ({ simData }) => {
  const { agents, baseline_ns, time_unit, ticker } = simData;
  const agentIds = Object.keys(agents);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agentIds[0] || '1098');
  const [timelineHoverIndex, setTimelineHoverIndex] = useState<number | null>(null);
  const [agentCategory, setAgentCategory] = useState<'all' | 'fundamental' | 'momentum'>('all');

  const momCount = simData.mom_agent_ids?.length || Object.keys(simData.mom_agents || {}).length || 0;

  const selectedAgent = agents[selectedAgentId] || agents[agentIds[0]];
  const ekfUpdates = selectedAgent?.ekf_updates || [];
  const cautionUpdates = selectedAgent?.caution_updates || [];
  const holdingsTimeline: HoldingTimelineEntry[] = selectedAgent?.holdings_timeline || [];

  // Effective hyperparameters
  const hyperparams: AgentHyperparams = useMemo(() => {
    return selectedAgent?.hyperparams || generateHyperparams(selectedAgentId);
  }, [selectedAgent, selectedAgentId]);

  const timeLabel = `Time (${time_unit} from open)`;

  // Downsample EKF data for charts
  const dsStep = Math.max(1, Math.floor(ekfUpdates.length / 250));
  const ekfChartData = useMemo(() => {
    const list = [];
    for (let i = 0; i < ekfUpdates.length; i += dsStep) {
      const u = ekfUpdates[i];
      list.push({
        timeDisplay: nsToDisplay(u.time_ns, baseline_ns, time_unit),
        mid: u.mid / 100,
        xHat: u.x_hat / 100,
        k: u.K,
        er: u.ER,
      });
    }
    return list;
  }, [ekfUpdates, baseline_ns, time_unit, dsStep]);

  const cautionChartData = useMemo(() => {
    const list = [];
    const cStep = Math.max(1, Math.floor(cautionUpdates.length / 250));
    for (let i = 0; i < cautionUpdates.length; i += cStep) {
      const c = cautionUpdates[i];
      list.push({
        timeDisplay: nsToDisplay(c.time_ns, baseline_ns, time_unit),
        Ct: c.C_t,
        Et: c.E_t,
      });
    }
    return list;
  }, [cautionUpdates, baseline_ns, time_unit]);

  const minPrice = useMemo(() => {
    if (ekfChartData.length === 0) return 0;
    return Math.min(...ekfChartData.map((d) => Math.min(d.mid, d.xHat)));
  }, [ekfChartData]);

  const maxPrice = useMemo(() => {
    if (ekfChartData.length === 0) return 1;
    return Math.max(...ekfChartData.map((d) => Math.max(d.mid, d.xHat)));
  }, [ekfChartData]);

  // Dimensions for subcharts
  const svgW = 480;
  const svgH = 220;
  const pad = { top: 15, right: 35, bottom: 20, left: 45 };

  const xToSvg = (idx: number, total: number) => {
    return pad.left + (idx / Math.max(1, total - 1)) * (svgW - pad.left - pad.right);
  };

  const yToPriceSvg = (p: number) => {
    const range = maxPrice - minPrice || 1;
    return pad.top + (1 - (p - minPrice) / range) * (svgH - pad.top - pad.bottom);
  };

  // Timeline chart coordinates
  const timelinePoints = useMemo(() => {
    return holdingsTimeline.map((entry) => ({
      timeDisplay: nsToDisplay(entry.time_ns, baseline_ns, time_unit),
      cashDollars: entry.cash_cents / 100,
      shares: entry.shares,
    }));
  }, [holdingsTimeline, baseline_ns, time_unit]);

  const minCash = useMemo(() => {
    if (timelinePoints.length === 0) return 0;
    return Math.min(...timelinePoints.map((p) => p.cashDollars));
  }, [timelinePoints]);

  const maxCash = useMemo(() => {
    if (timelinePoints.length === 0) return 1;
    return Math.max(...timelinePoints.map((p) => p.cashDollars));
  }, [timelinePoints]);

  const minShares = useMemo(() => {
    if (timelinePoints.length === 0) return 0;
    return Math.min(...timelinePoints.map((p) => p.shares));
  }, [timelinePoints]);

  const maxShares = useMemo(() => {
    if (timelinePoints.length === 0) return 1;
    return Math.max(...timelinePoints.map((p) => p.shares));
  }, [timelinePoints]);

  const timelineSvgW = 900;
  const cashPanelH = 150;
  const sharesPanelH = 110;
  const tPad = { top: 15, right: 60, bottom: 20, left: 75 };

  const tXToSvg = (idx: number, total: number) => {
    return tPad.left + (idx / Math.max(1, total - 1)) * (timelineSvgW - tPad.left - tPad.right);
  };

  const cashYToSvg = (val: number) => {
    const padVal = (maxCash - minCash) * 0.1 || 10;
    const low = minCash - padVal;
    const high = maxCash + padVal;
    const range = high - low || 1;
    return tPad.top + (1 - (val - low) / range) * (cashPanelH - tPad.top - tPad.bottom);
  };

  const sharesYToSvg = (val: number) => {
    const low = Math.max(0, Math.floor(minShares * 0.8));
    const high = Math.max(low + 5, Math.ceil(maxShares * 1.15));
    const range = high - low || 1;
    return tPad.top + (1 - (val - low) / range) * (sharesPanelH - tPad.top - tPad.bottom);
  };

  const activeTimelinePoint = timelineHoverIndex !== null ? timelinePoints[timelineHoverIndex] : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAgentCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              agentCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Agents ({agentIds.length + momCount})</span>
          </button>
          <button
            onClick={() => setAgentCategory('fundamental')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              agentCategory === 'fundamental'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>Fundamental EKF ({agentIds.length})</span>
          </button>
          <button
            onClick={() => setAgentCategory('momentum')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              agentCategory === 'momentum'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Momentum Trend Follower ({momCount})</span>
          </button>
        </div>
        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
          Discrete Event Market Multi-Agent Ecosystem
        </span>
      </div>

      {(agentCategory === 'all' || agentCategory === 'fundamental') && (
        <>
          {/* Agent Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-xl backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{selectedAgent?.name || `Agent ${selectedAgentId}`}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300">
                ID: {selectedAgentId}
              </span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Extended Kalman Filter with Emotional Caution & Dynamic Allocation
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Select Agent:</span>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500"
          >
            {agentIds.map((id) => (
              <option key={id} value={id}>
                {agents[id]?.name || `EKF Agent ${id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 🧠 SECTION 1: AGENT PERSONALITY PROFILE (3x3 Grid) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              🧠 Agent Personality Profile
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Unique hyperparameters driving this agent's behavioral diversity
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {HYPERPARAM_DEFS.map((def) => {
            const rawVal = hyperparams[def.key];
            const val = typeof rawVal === 'number' && !isNaN(rawVal) ? rawVal : def.min;
            const pct = Math.max(0, Math.min(100, ((val - def.min) / (def.max - def.min)) * 100));

            return (
              <div
                key={def.key}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-slate-200">{def.name}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${def.badgeColor}`}>
                      {def.symbol}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mb-2">{def.description}</p>
                </div>

                <div>
                  <div className="flex items-baseline justify-between font-mono mb-1.5">
                    <span className="text-base font-bold text-white">{def.format(val)}</span>
                    <span className="text-[10px] text-slate-500">
                      [{def.min} – {def.max}]
                    </span>
                  </div>

                  {/* Horizontal range bar showing where it sits in known range */}
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full bg-gradient-to-r ${def.barGradient} rounded-full transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row: EKF Estimate vs Mid Price & Kalman Gain/ER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EKF State: x̂ vs Market Price */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              EKF State: Posterior Estimate (x̂) vs Market Mid
            </h4>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-slate-400 inline-block" /> Market Mid
              </span>
              <span className="text-amber-400 flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> EKF Estimate (x̂)
              </span>
            </div>
          </div>

          {ekfChartData.length > 1 ? (
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
              {/* Mid price */}
              <polyline
                fill="none"
                stroke="#64748b"
                strokeWidth="1.2"
                points={ekfChartData.map((d, i) => `${xToSvg(i, ekfChartData.length)},${yToPriceSvg(d.mid)}`).join(' ')}
              />
              {/* EKF estimate */}
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                points={ekfChartData.map((d, i) => `${xToSvg(i, ekfChartData.length)},${yToPriceSvg(d.xHat)}`).join(' ')}
              />
              {/* Grid */}
              <line x1={pad.left} y1={svgH - pad.bottom} x2={svgW - pad.right} y2={svgH - pad.bottom} stroke="#1e293b" />
              <text x={pad.left} y={pad.top + 8} fill="#64748b" fontSize="10" fontFamily="monospace">
                ${maxPrice.toFixed(2)}
              </text>
              <text x={pad.left} y={svgH - pad.bottom - 4} fill="#64748b" fontSize="10" fontFamily="monospace">
                ${minPrice.toFixed(2)}
              </text>
            </svg>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-slate-500">
              No EKF updates logged for this agent.
            </div>
          )}
        </div>

        {/* Kalman Gain & Efficiency Ratio */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Kalman Gain (K) & Efficiency Ratio (ER)
            </h4>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-sky-400 flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-sky-400 inline-block" /> Kalman Gain (K)
              </span>
              <span className="text-amber-400 flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Kaufman ER
              </span>
            </div>
          </div>

          {ekfChartData.length > 1 ? (
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
              {/* Kalman Gain K */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                points={ekfChartData
                  .map((d, i) => {
                    const y = pad.top + (1 - Math.min(1, Math.max(0, d.k))) * (svgH - pad.top - pad.bottom);
                    return `${xToSvg(i, ekfChartData.length)},${y}`;
                  })
                  .join(' ')}
              />
              {/* Kaufman ER */}
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                points={ekfChartData
                  .map((d, i) => {
                    const y = pad.top + (1 - Math.min(1, Math.max(0, d.er))) * (svgH - pad.top - pad.bottom);
                    return `${xToSvg(i, ekfChartData.length)},${y}`;
                  })
                  .join(' ')}
              />
              <line x1={pad.left} y1={svgH - pad.bottom} x2={svgW - pad.right} y2={svgH - pad.bottom} stroke="#1e293b" />
              <text x={pad.left - 5} y={pad.top + 8} fill="#64748b" fontSize="9" textAnchor="end">
                1.0
              </text>
              <text x={pad.left - 5} y={svgH - pad.bottom} fill="#64748b" fontSize="9" textAnchor="end">
                0.0
              </text>
            </svg>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-slate-500">
              No Kalman Gain records found.
            </div>
          )}
        </div>
      </div>

      {/* Caution Modulator: Confidence C_t and Emotional Memory E_t */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Caution Modulator (Confidence C_t & Emotional Memory E_t)
            </h4>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> Confidence (C_t ∈ [0, 1])
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> Emotional Memory (E_t)
            </span>
          </div>
        </div>

        {cautionChartData.length > 1 ? (
          <div className="relative">
            <svg viewBox={`0 0 900 160`} className="w-full h-auto">
              <defs>
                <linearGradient id="cautionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polygon
                fill="url(#cautionGrad)"
                points={`
                  50,135
                  ${cautionChartData
                    .map((d, i) => {
                      const x = 50 + (i / (cautionChartData.length - 1)) * 800;
                      const y = 15 + (1 - Math.min(1, Math.max(0, d.Ct))) * 120;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  850,135
                `}
              />
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                points={cautionChartData
                  .map((d, i) => {
                    const x = 50 + (i / (cautionChartData.length - 1)) * 800;
                    const y = 15 + (1 - Math.min(1, Math.max(0, d.Ct))) * 120;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              <line x1={50} y1={135} x2={850} y2={135} stroke="#1e293b" />
              <text x={850} y={150} fill="#64748b" fontSize="10" textAnchor="end">
                {timeLabel}
              </text>
            </svg>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-xs text-slate-500">
            No caution updates recorded for this agent.
          </div>
        )}
      </div>

      {/* 💰 SECTION 2: LIVE CASH & INVENTORY TIMELINE (Replaces static Cash/Shares cards) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <span>💰 Live Cash & Inventory Timeline</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live evolution of liquid cash reserves and share inventory across executed orders.
            </p>
          </div>

          {timelinePoints.length > 0 && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2.5 h-0.5 bg-emerald-400" /> Cash Rising (Liquidated)
              </span>
              <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                <span className="w-2.5 h-0.5 bg-rose-400" /> Cash Falling (Invested)
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                <span className="w-2.5 h-2 bg-indigo-500/40 border border-indigo-400 inline-block rounded-sm" /> Shares Held
              </span>
            </div>
          )}
        </div>

        {/* Empty state check */}
        {holdingsTimeline.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-400 text-sm font-medium">
            No trades executed — agent sat out this session
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Hover inspection header */}
            <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800 text-xs font-mono">
              {activeTimelinePoint ? (
                <div className="flex items-center gap-4 text-slate-300">
                  <span>
                    Time: <b className="text-white">{activeTimelinePoint.timeDisplay.toFixed(2)} {time_unit}</b>
                  </span>
                  <span>
                    Cash: <b className="text-emerald-400">${activeTimelinePoint.cashDollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </span>
                  <span>
                    Shares ({ticker}): <b className="text-indigo-400">{activeTimelinePoint.shares.toLocaleString()} units</b>
                  </span>
                </div>
              ) : (
                <div className="text-slate-400">
                  Hover over the charts to inspect portfolio values at specific trade moments.
                </div>
              )}
              <div className="text-slate-500 text-[11px]">
                {timelinePoints.length} portfolio state points
              </div>
            </div>

            {/* Top Panel: Cash over time (Line chart, green when rising, red when falling) */}
            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1 px-2">
                <span className="font-semibold text-slate-300 uppercase">Cash Balance ($)</span>
                <span>
                  Range: ${minCash.toLocaleString(undefined, { maximumFractionDigits: 0 })} – ${maxCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>

              <svg
                viewBox={`0 0 ${timelineSvgW} ${cashPanelH}`}
                className="w-full h-auto select-none"
                onMouseLeave={() => setTimelineHoverIndex(null)}
              >
                {/* Horizontal reference lines */}
                {[minCash, (minCash + maxCash) / 2, maxCash].map((cVal, idx) => {
                  const y = cashYToSvg(cVal);
                  return (
                    <g key={idx}>
                      <line x1={tPad.left} y1={y} x2={timelineSvgW - tPad.right} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                      <text x={tPad.left - 8} y={y + 3} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                        ${cVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </text>
                    </g>
                  );
                })}

                {/* Segments: Green when rising, Red when falling */}
                {timelinePoints.map((pt, i) => {
                  if (i === 0) return null;
                  const prev = timelinePoints[i - 1];
                  const x1 = tXToSvg(i - 1, timelinePoints.length);
                  const y1 = cashYToSvg(prev.cashDollars);
                  const x2 = tXToSvg(i, timelinePoints.length);
                  const y2 = cashYToSvg(pt.cashDollars);
                  const isRising = pt.cashDollars >= prev.cashDollars;

                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isRising ? '#00cc66' : '#ff3366'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Points / Hover Targets */}
                {timelinePoints.map((pt, i) => {
                  const x = tXToSvg(i, timelinePoints.length);
                  const y = cashYToSvg(pt.cashDollars);
                  const isRising = i === 0 || pt.cashDollars >= timelinePoints[i - 1].cashDollars;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={timelineHoverIndex === i ? 5 : 2.5}
                      fill={isRising ? '#00cc66' : '#ff3366'}
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setTimelineHoverIndex(i)}
                    />
                  );
                })}

                {/* Crosshair indicator */}
                {timelineHoverIndex !== null && (
                  <line
                    x1={tXToSvg(timelineHoverIndex, timelinePoints.length)}
                    y1={tPad.top}
                    x2={tXToSvg(timelineHoverIndex, timelinePoints.length)}
                    y2={cashPanelH - tPad.bottom}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                <line x1={tPad.left} y1={cashPanelH - tPad.bottom} x2={timelineSvgW - tPad.right} y2={cashPanelH - tPad.bottom} stroke="#1e293b" />
              </svg>
            </div>

            {/* Bottom Panel: Shares over time (Step chart) */}
            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1 px-2">
                <span className="font-semibold text-slate-300 uppercase">Share Inventory ({ticker})</span>
                <span>
                  Current: <b className="text-white">{timelinePoints[timelinePoints.length - 1]?.shares.toLocaleString()}</b> units (Max: {maxShares})
                </span>
              </div>

              <svg
                viewBox={`0 0 ${timelineSvgW} ${sharesPanelH}`}
                className="w-full h-auto select-none"
                onMouseLeave={() => setTimelineHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="sharesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference lines */}
                {[minShares, maxShares].map((sVal, idx) => {
                  const y = sharesYToSvg(sVal);
                  return (
                    <g key={idx}>
                      <line x1={tPad.left} y1={y} x2={timelineSvgW - tPad.right} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                      <text x={tPad.left - 8} y={y + 3} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                        {sVal}
                      </text>
                    </g>
                  );
                })}

                {/* Step Chart Polygon Fill */}
                {timelinePoints.length > 1 && (
                  <polygon
                    fill="url(#sharesGrad)"
                    points={`
                      ${tPad.left},${sharesPanelH - tPad.bottom}
                      ${timelinePoints
                        .map((pt, i) => {
                          const x = tXToSvg(i, timelinePoints.length);
                          const y = sharesYToSvg(pt.shares);
                          if (i === 0) return `${x},${y}`;
                          const prevX = tXToSvg(i - 1, timelinePoints.length);
                          // Step interpolation: horizontal then vertical
                          return `${x},${sharesYToSvg(timelinePoints[i - 1].shares)} ${x},${y}`;
                        })
                        .join(' ')}
                      ${tXToSvg(timelinePoints.length - 1, timelinePoints.length)},${sharesPanelH - tPad.bottom}
                    `}
                  />
                )}

                {/* Step Chart Outline */}
                {timelinePoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="2"
                    points={timelinePoints
                      .map((pt, i) => {
                        const x = tXToSvg(i, timelinePoints.length);
                        const y = sharesYToSvg(pt.shares);
                        if (i === 0) return `${x},${y}`;
                        return `${x},${sharesYToSvg(timelinePoints[i - 1].shares)} ${x},${y}`;
                      })
                      .join(' ')}
                  />
                )}

                {/* Points / Hover Targets */}
                {timelinePoints.map((pt, i) => {
                  const x = tXToSvg(i, timelinePoints.length);
                  const y = sharesYToSvg(pt.shares);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={timelineHoverIndex === i ? 4.5 : 2}
                      fill="#818cf8"
                      className="cursor-pointer"
                      onMouseEnter={() => setTimelineHoverIndex(i)}
                    />
                  );
                })}

                {/* Crosshair indicator */}
                {timelineHoverIndex !== null && (
                  <line
                    x1={tXToSvg(timelineHoverIndex, timelinePoints.length)}
                    y1={tPad.top}
                    x2={tXToSvg(timelineHoverIndex, timelinePoints.length)}
                    y2={sharesPanelH - tPad.bottom}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                <line x1={tPad.left} y1={sharesPanelH - tPad.bottom} x2={timelineSvgW - tPad.right} y2={sharesPanelH - tPad.bottom} stroke="#1e293b" />
                <text x={timelineSvgW - tPad.right} y={sharesPanelH - 5} fill="#64748b" fontSize="10" textAnchor="end">
                  {timeLabel}
                </text>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Layer System Explanation */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300">
        <div className="flex items-center gap-2 mb-2 text-indigo-400 font-bold uppercase tracking-wider">
          <Info className="w-4 h-4" />
          <span>Three-Layer Decision Architecture (Fundamentalist Agent)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <span className="font-semibold text-slate-100 block mb-1">Layer 1: EKF Core</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Predicts fundamental state using persistence random walk, calculates observation variance R_t from
              Kaufman Efficiency Ratio, and fuses via scalar Kalman filter correction.
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <span className="font-semibold text-slate-100 block mb-1">Layer 2: Caution Modulator</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Maintains emotional memory E_t as an EWMA of virtual trade returns. Compresses E_t through a logistic
              sigmoid to yield confidence factor C_t ∈ [0, 1].
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <span className="font-semibold text-slate-100 block mb-1">Layer 3: Order Sizing & Pricing</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Scales order volume using Wealth-Bounded Allocation A_t = min(1, β · C_t · gap), and anchors limit price
              within epistemic safety margins m = μ · sqrt(P).
            </p>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Render Momentum EKF Agent Section */}
      {(agentCategory === 'all' || agentCategory === 'momentum') && (
        <MomentumAgentSection simData={simData} />
      )}
    </div>
  );
};
