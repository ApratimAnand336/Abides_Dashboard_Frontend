import React from 'react';
import { DollarSign, Activity, BarChart2, Layers, Users } from 'lucide-react';
import { SimData } from '../types/market';

interface TopMetricsProps {
  simData: SimData;
}

export const TopMetrics: React.FC<TopMetricsProps> = ({ simData }) => {
  const mids = simData.book.mids || [];
  const openPrice = mids.length > 0 ? mids[0] : 0;
  const closePrice = mids.length > 0 ? mids[mids.length - 1] : 0;
  const delta = closePrice - openPrice;
  const isPositive = delta >= 0;
  const agentCount = Object.keys(simData.agents).length;
  const candlesCount = simData.ohlcv?.length || 0;
  const pricePointsCount = mids.length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <div className="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Opening Price</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <p className="text-2xl font-bold text-slate-100 font-mono">${openPrice.toFixed(2)}</p>
        <span className="text-[11px] text-slate-500">Market Open (09:30)</span>
      </div>

      <div className="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Closing Price</span>
          <Activity className="w-4 h-4 text-indigo-400" />
        </div>
        <p className="text-2xl font-bold text-slate-100 font-mono">${closePrice.toFixed(2)}</p>
        <div className="flex items-center gap-1 text-xs font-medium mt-0.5">
          <span className={isPositive ? "text-emerald-400" : "text-rose-400"}>
            {isPositive ? "▲" : "▼"} ${Math.abs(delta).toFixed(2)} ({((delta / (openPrice || 1)) * 100).toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Price Points</span>
          <Layers className="w-4 h-4 text-sky-400" />
        </div>
        <p className="text-2xl font-bold text-slate-100 font-mono">{pricePointsCount.toLocaleString()}</p>
        <span className="text-[11px] text-slate-500">Tick Observations</span>
      </div>

      <div className="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">OHLCV Candles</span>
          <BarChart2 className="w-4 h-4 text-purple-400" />
        </div>
        <p className="text-2xl font-bold text-slate-100 font-mono">{candlesCount}</p>
        <span className="text-[11px] text-slate-500">Aggregated Bars</span>
      </div>

      <div className="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur col-span-2 md:col-span-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">EKF Agents</span>
          <Users className="w-4 h-4 text-amber-400" />
        </div>
        <p className="text-2xl font-bold text-slate-100 font-mono">{agentCount}</p>
        <span className="text-[11px] text-slate-500">Active Kalman Traders</span>
      </div>
    </div>
  );
};
