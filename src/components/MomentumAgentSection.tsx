import React, { useState, useMemo } from 'react';
import { SimData, MomAgentData, MomHyperparams, HoldingTimelineEntry } from '../types/market';
import { nsToDisplay } from '../services/simulator';
import {
  Compass,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Activity,
  DollarSign,
  Briefcase,
  GitCommit,
  Sliders,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface MomentumAgentSectionProps {
  simData: SimData;
}

export const MomentumAgentSection: React.FC<MomentumAgentSectionProps> = ({ simData }) => {
  const { mom_agents = {}, mom_agent_ids = [], baseline_ns, time_unit, ticker } = simData;

  const agentIds = useMemo(() => {
    if (mom_agent_ids && mom_agent_ids.length > 0) {
      return mom_agent_ids.map(String);
    }
    return Object.keys(mom_agents);
  }, [mom_agent_ids, mom_agents]);

  const [selectedMomId, setSelectedMomId] = useState<string>(agentIds[0] || '1112');
  const [timelineHoverIndex, setTimelineHoverIndex] = useState<number | null>(null);
  const [filterHoverIndex, setFilterHoverIndex] = useState<number | null>(null);
  const [isHyperparamsExpanded, setIsHyperparamsExpanded] = useState<boolean>(true);

  // Active agent data
  const currentAgent: MomAgentData | undefined = mom_agents[selectedMomId] || mom_agents[agentIds[0]];
  const kfUpdates = currentAgent?.kf_updates || [];
  const cautionUpdates = currentAgent?.caution_updates || [];
  const decisions = currentAgent?.decisions || [];
  const stateChanges = currentAgent?.state_changes || [];
  const holdingsTimeline: HoldingTimelineEntry[] = currentAgent?.holdings_timeline || [];
  const hyperparams: MomHyperparams | undefined = currentAgent?.hyperparams;

  const timeLabel = `Time (${time_unit} from open)`;

  // Downsample KF updates for SVG charts
  const dsStep = Math.max(1, Math.floor(kfUpdates.length / 250));
  const filterChartData = useMemo(() => {
    const list = [];
    for (let i = 0; i < kfUpdates.length; i += dsStep) {
      const u = kfUpdates[i];
      const midDollars = u.mid / 100;
      const trendPrice = Math.exp(u.l_hat) / 100;
      const sdL = Math.sqrt(Math.max(u.P00, 1e-12));
      const bandUpper = Math.exp(u.l_hat + 2 * sdL) / 100;
      const bandLower = Math.exp(u.l_hat - 2 * sdL) / 100;

      list.push({
        timeDisplay: nsToDisplay(u.time_ns, baseline_ns, time_unit),
        mid: midDollars,
        trendPrice,
        bandUpper,
        bandLower,
        T: u.T,
        ER: u.ER,
        vHatHour: u.v_hat * 3600 * 100, // % per hour
      });
    }
    return list;
  }, [kfUpdates, baseline_ns, time_unit, dsStep]);

  // Downsample Caution updates
  const cStep = Math.max(1, Math.floor(cautionUpdates.length / 250));
  const cautionChartData = useMemo(() => {
    const list = [];
    for (let i = 0; i < cautionUpdates.length; i += cStep) {
      const c = cautionUpdates[i];
      list.push({
        timeDisplay: nsToDisplay(c.time_ns, baseline_ns, time_unit),
        Ct: c.C_t,
        Et: c.E_t,
      });
    }
    return list;
  }, [cautionUpdates, baseline_ns, time_unit, cStep]);

  // Downsample Decisions / State
  const dStep = Math.max(1, Math.floor(decisions.length / 250));
  const decisionChartData = useMemo(() => {
    const list = [];
    for (let i = 0; i < decisions.length; i += dStep) {
      const d = decisions[i];
      list.push({
        timeDisplay: nsToDisplay(d.time_ns, baseline_ns, time_unit),
        state: d.state,
        eTarget: d.e_target,
        a: d.a,
      });
    }
    return list;
  }, [decisions, baseline_ns, time_unit, dStep]);

  // Timeline points for cash & shares
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

  // Min and max price for filter chart
  const minFilterPrice = useMemo(() => {
    if (filterChartData.length === 0) return 0;
    return Math.min(...filterChartData.map((d) => Math.min(d.mid, d.bandLower)));
  }, [filterChartData]);

  const maxFilterPrice = useMemo(() => {
    if (filterChartData.length === 0) return 1;
    return Math.max(...filterChartData.map((d) => Math.max(d.mid, d.bandUpper)));
  }, [filterChartData]);

  // Dimensions
  const filterSvgW = 880;
  const filterSvgH = 260;
  const fPad = { top: 20, right: 40, bottom: 25, left: 65 };

  const xToFilterSvg = (idx: number, total: number) => {
    return fPad.left + (idx / Math.max(1, total - 1)) * (filterSvgW - fPad.left - fPad.right);
  };

  const yToFilterPriceSvg = (p: number) => {
    const range = maxFilterPrice - minFilterPrice || 1;
    return fPad.top + (1 - (p - minFilterPrice) / range) * (filterSvgH - fPad.top - fPad.bottom);
  };

  // Dimensions for subcharts
  const subSvgW = 880;
  const subPanelH = 130;
  const sPad = { top: 15, right: 40, bottom: 20, left: 65 };

  const xToSubSvg = (idx: number, total: number) => {
    return sPad.left + (idx / Math.max(1, total - 1)) * (subSvgW - sPad.left - sPad.right);
  };

  // Y for T score (typical range -4 to +4)
  const thetaIn = hyperparams?.theta_in ?? 2.0;
  const thetaOut = hyperparams?.theta_out ?? 0.8;
  const maxAbsT = useMemo(() => {
    if (filterChartData.length === 0) return 4.0;
    const peak = Math.max(...filterChartData.map((d) => Math.abs(d.T)));
    return Math.max(thetaIn * 1.35, Math.min(10, peak * 1.15));
  }, [filterChartData, thetaIn]);

  const yToTSvg = (tVal: number) => {
    const norm = Math.max(-maxAbsT, Math.min(maxAbsT, tVal));
    return sPad.top + (1 - (norm - -maxAbsT) / (2 * maxAbsT)) * (subPanelH - sPad.top - sPad.bottom);
  };

  // Y for State: BEAR (0), WATCH (1), NEUTRAL (2), BULL (3)
  const stateToLevel = (st: string) => {
    switch (st) {
      case 'BEAR': return 0;
      case 'WATCH': return 1;
      case 'NEUTRAL': return 2;
      case 'BULL': return 3;
      default: return 2;
    }
  };

  const yToStateSvg = (st: string) => {
    const lvl = stateToLevel(st);
    return sPad.top + (1 - lvl / 3) * (subPanelH - sPad.top - sPad.bottom);
  };

  // Cash / Shares timeline dimensions
  const timelineSvgW = 880;
  const cashPanelH = 140;
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
  const activeFilterPoint = filterHoverIndex !== null ? filterChartData[filterHoverIndex] : null;

  const currentState = currentAgent?.final?.state || 'NEUTRAL';
  const stateColorBadge = {
    BULL: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40',
    BEAR: 'text-rose-400 bg-rose-950/60 border-rose-500/40',
    WATCH: 'text-amber-400 bg-amber-950/60 border-amber-500/40',
    NEUTRAL: 'text-sky-400 bg-sky-950/60 border-sky-500/40',
  }[currentState] || 'text-slate-300 bg-slate-800 border-slate-700';

  if (agentIds.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
        No Momentum EKF Agent data available in this simulation.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-4 border-t border-slate-800/80">
      {/* 🚀 MOMENTUM AGENTS SECTION HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-indigo-500/30 p-4 rounded-xl backdrop-blur shadow-lg shadow-indigo-950/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                🚀 Momentum EKF Agents
              </h2>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${stateColorBadge}`}>
                STATE: {currentState}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Long-only trend follower • Damped-Trend Kalman Filter (l̂, v̂) • Caution Modulator • Pyramiding Ratchet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Select Momentum Agent:</span>
          <select
            value={selectedMomId}
            onChange={(e) => setSelectedMomId(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
          >
            {agentIds.map((id) => (
              <option key={id} value={id}>
                {mom_agents[id]?.name || `EKF_Mom_${id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Cash Reserves</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white">
            ${((currentAgent?.holdings?.CASH ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500">Unallocated Capital</span>
        </div>

        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Shares ({ticker})</span>
            <Briefcase className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white">
            {(currentAgent?.holdings?.[ticker] ?? 0).toLocaleString()} units
          </p>
          <span className="text-[10px] text-slate-500">Active Equity Exposure</span>
        </div>

        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">State Transitions</span>
            <GitCommit className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white">
            {stateChanges.length}
          </p>
          <span className="text-[10px] text-slate-500">Regime Switches Logged</span>
        </div>

        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Filter Confidence</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white">
            {((currentAgent?.C_t_final ?? 0.5) * 100).toFixed(1)}%
          </p>
          <span className="text-[10px] text-slate-500">Confidence C_t ∈ [0, 1]</span>
        </div>
      </div>

      {/* CHART 1: FILTER LEVEL l̂ VS MARKET PRICE ($) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <span>📈 Filter Level l̂ vs Market Price</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparison of market mid price vs trend-implied level exp(l̂)/100 with ±2σ uncertainty band.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <span className="w-2.5 h-0.5 bg-sky-400" /> Market Mid ($)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <span className="w-2.5 h-0.5 bg-amber-400" /> Trend exp(l̂)/100
            </span>
            <span className="flex items-center gap-1.5 text-amber-500/50 font-semibold">
              <span className="w-2.5 h-2 bg-amber-500/20 border border-amber-500/40 inline-block rounded-sm" /> ±2σ Band
            </span>
          </div>
        </div>

        {filterChartData.length > 0 ? (
          <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
            {/* Hover details */}
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2 px-2">
              {activeFilterPoint ? (
                <div className="flex items-center gap-4">
                  <span>Time: <b className="text-white">{activeFilterPoint.timeDisplay.toFixed(2)} {time_unit}</b></span>
                  <span>Mid: <b className="text-sky-400">${activeFilterPoint.mid.toFixed(2)}</b></span>
                  <span>Trend Level: <b className="text-amber-400">${activeFilterPoint.trendPrice.toFixed(2)}</b></span>
                  <span>Trend Strength (T): <b className={activeFilterPoint.T >= 0 ? "text-emerald-400" : "text-rose-400"}>{activeFilterPoint.T.toFixed(2)}</b></span>
                  <span>Trend Velocity: <b className="text-purple-400">{activeFilterPoint.vHatHour >= 0 ? '+' : ''}{activeFilterPoint.vHatHour.toFixed(2)}%/hr</b></span>
                </div>
              ) : (
                <span className="text-slate-500">Hover over the chart to inspect trend estimate and velocity.</span>
              )}
              <span className="text-[11px] text-slate-500">{filterChartData.length} filter updates</span>
            </div>

            <svg
              viewBox={`0 0 ${filterSvgW} ${filterSvgH}`}
              className="w-full h-auto select-none"
              onMouseLeave={() => setFilterHoverIndex(null)}
            >
              {/* Horizontal grid lines */}
              {[minFilterPrice, (minFilterPrice + maxFilterPrice) / 2, maxFilterPrice].map((val, idx) => {
                const y = yToFilterPriceSvg(val);
                return (
                  <g key={idx}>
                    <line x1={fPad.left} y1={y} x2={filterSvgW - fPad.right} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                    <text x={fPad.left - 8} y={y + 3} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                      ${val.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* ±2σ Uncertainty Band Polygon */}
              {filterChartData.length > 1 && (
                <polygon
                  fill="rgba(245, 158, 11, 0.12)"
                  points={`
                    ${filterChartData.map((d, i) => `${xToFilterSvg(i, filterChartData.length)},${yToFilterPriceSvg(d.bandUpper)}`).join(' ')}
                    ${filterChartData.slice().reverse().map((d, i) => `${xToFilterSvg(filterChartData.length - 1 - i, filterChartData.length)},${yToFilterPriceSvg(d.bandLower)}`).join(' ')}
                  `}
                />
              )}

              {/* Market Mid Price Line (Sky Blue) */}
              {filterChartData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  opacity="0.8"
                  points={filterChartData.map((d, i) => `${xToFilterSvg(i, filterChartData.length)},${yToFilterPriceSvg(d.mid)}`).join(' ')}
                />
              )}

              {/* Trend Level exp(l̂)/100 Line (Amber) */}
              {filterChartData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  points={filterChartData.map((d, i) => `${xToFilterSvg(i, filterChartData.length)},${yToFilterPriceSvg(d.trendPrice)}`).join(' ')}
                />
              )}

              {/* Hover targets */}
              {filterChartData.map((d, i) => (
                <circle
                  key={i}
                  cx={xToFilterSvg(i, filterChartData.length)}
                  cy={yToFilterPriceSvg(d.trendPrice)}
                  r={filterHoverIndex === i ? 4.5 : 1.5}
                  fill="#f59e0b"
                  className="cursor-pointer"
                  onMouseEnter={() => setFilterHoverIndex(i)}
                />
              ))}

              {/* Crosshair */}
              {filterHoverIndex !== null && (
                <line
                  x1={xToFilterSvg(filterHoverIndex, filterChartData.length)}
                  y1={fPad.top}
                  x2={xToFilterSvg(filterHoverIndex, filterChartData.length)}
                  y2={filterSvgH - fPad.bottom}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              <line x1={fPad.left} y1={filterSvgH - fPad.bottom} x2={filterSvgW - fPad.right} y2={filterSvgH - fPad.bottom} stroke="#1e293b" />
              <text x={filterSvgW - fPad.right} y={filterSvgH - 6} fill="#64748b" fontSize="10" textAnchor="end">
                {timeLabel}
              </text>
            </svg>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs">
            No filter updates recorded for this agent (still warming up?).
          </div>
        )}
      </div>

      {/* 3-PANEL DIAGNOSTIC SUBPLOTS: Trend Strength T_k, Confidence C_k, State Machine */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            📊 Internal Decision Layers & State Dynamics
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Three stacked synchronized panels: Trend strength score T_k, Emotional confidence C_k, and Discrete state machine.
          </p>
        </div>

        {/* Panel 1: Trend Strength T_k with ±θ_in and ±θ_out */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1 px-2">
            <span className="font-semibold text-slate-300 uppercase">Panel 1: Trend Strength T_k = v̂ / sd(v̂)</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-emerald-400">Entry: ±θ_in = ±{thetaIn.toFixed(2)}</span>
              <span className="text-amber-400">Fade Exit: ±θ_out = ±{thetaOut.toFixed(2)}</span>
            </div>
          </div>

          <svg viewBox={`0 0 ${subSvgW} ${subPanelH}`} className="w-full h-auto select-none">
            {/* Zero Center Line */}
            <line x1={sPad.left} y1={yToTSvg(0)} x2={subSvgW - sPad.right} y2={yToTSvg(0)} stroke="#334155" strokeWidth="1" />
            <text x={sPad.left - 6} y={yToTSvg(0) + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">0.0</text>

            {/* Threshold lines +θ_in and -θ_in (dashed) */}
            <line x1={sPad.left} y1={yToTSvg(thetaIn)} x2={subSvgW - sPad.right} y2={yToTSvg(thetaIn)} stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
            <text x={sPad.left - 6} y={yToTSvg(thetaIn) + 3} fill="#10b981" fontSize="9" textAnchor="end" fontFamily="monospace">+{thetaIn}</text>

            <line x1={sPad.left} y1={yToTSvg(-thetaIn)} x2={subSvgW - sPad.right} y2={yToTSvg(-thetaIn)} stroke="#f43f5e" strokeWidth="1" strokeDasharray="3 3" />
            <text x={sPad.left - 6} y={yToTSvg(-thetaIn) + 3} fill="#f43f5e" fontSize="9" textAnchor="end" fontFamily="monospace">-{thetaIn}</text>

            {/* Threshold lines +θ_out and -θ_out (dotted) */}
            <line x1={sPad.left} y1={yToTSvg(thetaOut)} x2={subSvgW - sPad.right} y2={yToTSvg(thetaOut)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="1 2" />
            <line x1={sPad.left} y1={yToTSvg(-thetaOut)} x2={subSvgW - sPad.right} y2={yToTSvg(-thetaOut)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="1 2" />

            {/* Trend Strength T Polyline */}
            {filterChartData.length > 1 && (
              <polyline
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                points={filterChartData.map((d, i) => `${xToSubSvg(i, filterChartData.length)},${yToTSvg(d.T)}`).join(' ')}
              />
            )}

            <line x1={sPad.left} y1={subPanelH - sPad.bottom} x2={subSvgW - sPad.right} y2={subPanelH - sPad.bottom} stroke="#1e293b" />
          </svg>
        </div>

        {/* Panel 2: Confidence C_k [0, 1] */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1 px-2">
            <span className="font-semibold text-slate-300 uppercase">Panel 2: Caution Modulator Confidence C_k ∈ [0, 1]</span>
            <span className="text-[11px] text-emerald-400">Adaptive Emotional Weighting</span>
          </div>

          <svg viewBox={`0 0 ${subSvgW} ${subPanelH}`} className="w-full h-auto select-none">
            {/* Reference grid 0.0, 0.5, 1.0 */}
            {[0, 0.5, 1.0].map((cVal, idx) => {
              const y = sPad.top + (1 - cVal) * (subPanelH - sPad.top - sPad.bottom);
              return (
                <g key={idx}>
                  <line x1={sPad.left} y1={y} x2={subSvgW - sPad.right} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                  <text x={sPad.left - 6} y={y + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                    {cVal.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Polygon fill under C_k curve */}
            {cautionChartData.length > 1 && (
              <polygon
                fill="rgba(16, 185, 129, 0.12)"
                points={`
                  ${sPad.left},${subPanelH - sPad.bottom}
                  ${cautionChartData.map((d, i) => `${xToSubSvg(i, cautionChartData.length)},${sPad.top + (1 - Math.max(0, Math.min(1, d.Ct))) * (subPanelH - sPad.top - sPad.bottom)}`).join(' ')}
                  ${subSvgW - sPad.right},${subPanelH - sPad.bottom}
                `}
              />
            )}

            {/* Line for C_k */}
            {cautionChartData.length > 1 && (
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                points={cautionChartData.map((d, i) => `${xToSubSvg(i, cautionChartData.length)},${sPad.top + (1 - Math.max(0, Math.min(1, d.Ct))) * (subPanelH - sPad.top - sPad.bottom)}`).join(' ')}
              />
            )}

            <line x1={sPad.left} y1={subPanelH - sPad.bottom} x2={subSvgW - sPad.right} y2={subPanelH - sPad.bottom} stroke="#1e293b" />
          </svg>
        </div>

        {/* Panel 3: State Machine Timeline (BEAR, WATCH, NEUTRAL, BULL) */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1 px-2">
            <span className="font-semibold text-slate-300 uppercase">Panel 3: State Machine Execution (BULL / NEUTRAL / WATCH / BEAR)</span>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-emerald-400">BULL (Overweight)</span>
              <span className="text-sky-400">NEUTRAL (e_0 = 0.5)</span>
              <span className="text-amber-400">WATCH (Trailing Stop)</span>
              <span className="text-rose-400">BEAR (Underweight)</span>
            </div>
          </div>

          <svg viewBox={`0 0 ${subSvgW} ${subPanelH}`} className="w-full h-auto select-none">
            {/* Reference State Levels */}
            {['BEAR', 'WATCH', 'NEUTRAL', 'BULL'].map((st) => {
              const y = yToStateSvg(st);
              return (
                <g key={st}>
                  <line x1={sPad.left} y1={y} x2={subSvgW - sPad.right} y2={y} stroke="#1e293b" strokeDasharray="2 2" />
                  <text x={sPad.left - 6} y={y + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                    {st}
                  </text>
                </g>
              );
            })}

            {/* State Step Polyline */}
            {decisionChartData.length > 1 && (
              <polyline
                fill="none"
                stroke="#ec4899"
                strokeWidth="2.5"
                points={decisionChartData
                  .map((d, i) => {
                    const x = xToSubSvg(i, decisionChartData.length);
                    const y = yToStateSvg(d.state);
                    if (i === 0) return `${x},${y}`;
                    const prevY = yToStateSvg(decisionChartData[i - 1].state);
                    return `${x},${prevY} ${x},${y}`;
                  })
                  .join(' ')}
              />
            )}

            <line x1={sPad.left} y1={subPanelH - sPad.bottom} x2={subSvgW - sPad.right} y2={subPanelH - sPad.bottom} stroke="#1e293b" />
            <text x={subSvgW - sPad.right} y={subPanelH - 4} fill="#64748b" fontSize="10" textAnchor="end">
              {timeLabel}
            </text>
          </svg>
        </div>
      </div>

      {/* 💰 LIVE CASH & INVENTORY TIMELINE (Momentum Agent) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <span>💰 Live Cash & Inventory Timeline (Momentum EKF)</span>
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

        {holdingsTimeline.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-400 text-sm font-medium">
            No trades executed — agent sat out this session
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800 text-xs font-mono">
              {activeTimelinePoint ? (
                <div className="flex items-center gap-4 text-slate-300">
                  <span>Time: <b className="text-white">{activeTimelinePoint.timeDisplay.toFixed(2)} {time_unit}</b></span>
                  <span>Cash: <b className="text-emerald-400">${activeTimelinePoint.cashDollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                  <span>Shares ({ticker}): <b className="text-indigo-400">{activeTimelinePoint.shares.toLocaleString()} units</b></span>
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

                {/* Points / Hover targets */}
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
                  <linearGradient id="momSharesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
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
                    fill="url(#momSharesGrad)"
                    points={`
                      ${tPad.left},${sharesPanelH - tPad.bottom}
                      ${timelinePoints
                        .map((pt, i) => {
                          const x = tXToSvg(i, timelinePoints.length);
                          const y = sharesYToSvg(pt.shares);
                          if (i === 0) return `${x},${y}`;
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
                    stroke="#22d3ee"
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

                {/* Hover targets */}
                {timelinePoints.map((pt, i) => {
                  const x = tXToSvg(i, timelinePoints.length);
                  const y = sharesYToSvg(pt.shares);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={timelineHoverIndex === i ? 4.5 : 2}
                      fill="#22d3ee"
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

      {/* MOMENTUM HYPERPARAMETERS (30 Parameters with Categorized Grid & Expander) */}
      {hyperparams && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur">
          <div
            onClick={() => setIsHyperparamsExpanded(!isHyperparamsExpanded)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                🧠 Momentum Agent Hyperparameters ({Object.keys(hyperparams).length} parameters)
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span>{isHyperparamsExpanded ? 'Collapse' : 'Expand'}</span>
              {isHyperparamsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {isHyperparamsExpanded && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 font-mono">
                {Object.entries(hyperparams).map(([k, v]) => {
                  const valStr = typeof v === 'number' ? (Number.isInteger(v) ? v.toString() : v.toFixed(3)) : String(v);
                  return (
                    <div
                      key={k}
                      className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between hover:border-slate-700 transition-colors"
                    >
                      <span className="text-[11px] text-slate-400 truncate mb-1" title={k}>
                        {k}
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-bold text-cyan-300">{valStr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <b>MomentumEKFAgent Specification:</b> Uses a damped-trend transition matrix F(dt, τ) on z = ln(mid), Kaufman ER observation noise adaptation, trailing stops at k_stop · σ_τ, and a pyramiding ratchet for progressive sizing up to e_max.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
