import React, { useMemo } from 'react';
import { SimData } from '../types/market';
import { calculateMarketHealth } from '../services/simulator';
import { Activity, Percent, Compass, Award } from 'lucide-react';

interface MarketHealthTabProps {
  simData: SimData;
}

export const MarketHealthTab: React.FC<MarketHealthTabProps> = ({ simData }) => {
  const stats = useMemo(() => calculateMarketHealth(simData), [simData]);

  // Log returns computation for histogram
  const logReturns = useMemo(() => {
    const mids = simData.book.mids || [];
    const rets: number[] = [];
    for (let i = 1; i < mids.length; i++) {
      if (mids[i] > 0 && mids[i - 1] > 0) {
        const r = Math.log(mids[i]) - Math.log(mids[i - 1]);
        if (Number.isFinite(r)) rets.push(r);
      }
    }
    return rets;
  }, [simData.book.mids]);

  // Histograms
  const returnBins = useMemo(() => {
    if (logReturns.length === 0) return [];
    const minR = Math.min(...logReturns);
    const maxR = Math.max(...logReturns);
    const numBins = 45;
    const step = (maxR - minR) / numBins || 0.0001;

    const counts = new Array(numBins).fill(0);
    for (const r of logReturns) {
      const idx = Math.min(numBins - 1, Math.max(0, Math.floor((r - minR) / step)));
      counts[idx]++;
    }

    return counts.map((count, i) => ({
      val: minR + i * step,
      count,
    }));
  }, [logReturns]);

  const spreadBins = useMemo(() => {
    const spreads = simData.book.spreads || [];
    if (spreads.length === 0) return [];
    const minS = Math.min(...spreads);
    const maxS = Math.max(...spreads);
    const numBins = 35;
    const step = (maxS - minS) / numBins || 0.001;

    const counts = new Array(numBins).fill(0);
    for (const s of spreads) {
      const idx = Math.min(numBins - 1, Math.max(0, Math.floor((s - minS) / step)));
      counts[idx]++;
    }

    return counts.map((count, i) => ({
      val: minS + i * step,
      count,
    }));
  }, [simData.book.spreads]);

  const maxRetCount = Math.max(...returnBins.map((b) => b.count), 1);
  const maxSpreadCount = Math.max(...spreadBins.map((b) => b.count), 1);

  const histSvgW = 420;
  const histSvgH = 180;
  const hPad = { top: 15, right: 20, bottom: 25, left: 35 };

  return (
    <div className="flex flex-col gap-6">
      {/* 4 Health Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Return Kurtosis</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-100">{stats.kurtosis.toFixed(2)}</p>
          <span className="text-[11px] text-slate-500">Fat tails benchmark: &gt; 3.0</span>
        </div>

        <div className="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Return Skewness</span>
            <Compass className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-100">
            {stats.skewness > 0 ? '+' : ''}
            {stats.skewness.toFixed(4)}
          </p>
          <span className="text-[11px] text-slate-500">Asymmetry of price innovations</span>
        </div>

        <div className="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Return Std (Vol)</span>
            <Percent className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-100">{stats.returnStd.toFixed(6)}</p>
          <span className="text-[11px] text-slate-500">Microstructure volatility</span>
        </div>

        <div className="metric-card bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RMS Tracking Error</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-100">
            {stats.rmsTrackingError !== null ? `$${stats.rmsTrackingError.toFixed(4)}` : 'N/A'}
          </p>
          <span className="text-[11px] text-slate-500">Root-mean-square vs Oracle</span>
        </div>
      </div>

      {/* Histograms: Returns & Spread */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Return Distribution */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
            Return Distribution (Log Returns)
          </h4>
          <p className="text-xs text-slate-400 mb-3">
            Histogram of tick-level price returns displaying typical financial fat-tailed distribution.
          </p>

          {returnBins.length > 0 ? (
            <svg viewBox={`0 0 ${histSvgW} ${histSvgH}`} className="w-full h-auto">
              {/* Zero line */}
              <line
                x1={histSvgW / 2}
                y1={hPad.top}
                x2={histSvgW / 2}
                y2={histSvgH - hPad.bottom}
                stroke="#ef4444"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              {/* Bars */}
              {returnBins.map((bin, i) => {
                const usableW = histSvgW - hPad.left - hPad.right;
                const barW = Math.max(1.5, usableW / returnBins.length - 1);
                const x = hPad.left + (i / returnBins.length) * usableW;
                const barH = (bin.count / maxRetCount) * (histSvgH - hPad.top - hPad.bottom);
                return (
                  <rect
                    key={i}
                    x={x}
                    y={histSvgH - hPad.bottom - barH}
                    width={barW}
                    height={Math.max(1, barH)}
                    fill="rgba(56, 189, 248, 0.6)"
                    stroke="rgba(56, 189, 248, 0.8)"
                    strokeWidth="0.5"
                    rx="0.5"
                  />
                );
              })}
              <line
                x1={hPad.left}
                y1={histSvgH - hPad.bottom}
                x2={histSvgW - hPad.right}
                y2={histSvgH - hPad.bottom}
                stroke="#1e293b"
              />
              <text x={histSvgW - hPad.right} y={histSvgH - 8} fill="#64748b" fontSize="10" textAnchor="end">
                Log Return
              </text>
            </svg>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-slate-500">
              Not enough data points.
            </div>
          )}
        </div>

        {/* Spread Distribution */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
            Spread Distribution
          </h4>
          <p className="text-xs text-slate-400 mb-3">
            Frequency distribution of bid-ask spreads quoted by market makers and limit orders.
          </p>

          {spreadBins.length > 0 ? (
            <svg viewBox={`0 0 ${histSvgW} ${histSvgH}`} className="w-full h-auto">
              {spreadBins.map((bin, i) => {
                const usableW = histSvgW - hPad.left - hPad.right;
                const barW = Math.max(1.5, usableW / spreadBins.length - 1);
                const x = hPad.left + (i / spreadBins.length) * usableW;
                const barH = (bin.count / maxSpreadCount) * (histSvgH - hPad.top - hPad.bottom);
                return (
                  <rect
                    key={i}
                    x={x}
                    y={histSvgH - hPad.bottom - barH}
                    width={barW}
                    height={Math.max(1, barH)}
                    fill="rgba(192, 132, 252, 0.6)"
                    stroke="rgba(192, 132, 252, 0.8)"
                    strokeWidth="0.5"
                    rx="0.5"
                  />
                );
              })}
              <line
                x1={hPad.left}
                y1={histSvgH - hPad.bottom}
                x2={histSvgW - hPad.right}
                y2={histSvgH - hPad.bottom}
                stroke="#1e293b"
              />
              <text x={histSvgW - hPad.right} y={histSvgH - 8} fill="#64748b" fontSize="10" textAnchor="end">
                Spread ($)
              </text>
            </svg>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-slate-500">
              Not enough spread observations.
            </div>
          )}
        </div>
      </div>

      {/* Summary Statistics Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
          Market Summary Statistics
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="py-2.5 px-3">Metric</th>
                <th className="py-2.5 px-3">Simulated Value</th>
                <th className="py-2.5 px-3 text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Price Range</td>
                <td className="py-2 px-3 text-indigo-400 font-bold">{stats.priceRange}</td>
                <td className="py-2 px-3 text-slate-500">Min and max mid-prices observed</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Opening Price</td>
                <td className="py-2 px-3 text-slate-100">${stats.openingPrice.toFixed(2)}</td>
                <td className="py-2 px-3 text-slate-500">First mid-price at market open</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Closing Price</td>
                <td className="py-2 px-3 text-slate-100">${stats.closingPrice.toFixed(2)}</td>
                <td className="py-2 px-3 text-slate-500">Final mid-price at simulation end</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Price Change</td>
                <td className={`py-2 px-3 font-bold ${stats.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stats.priceChange >= 0 ? '+' : ''}${stats.priceChange.toFixed(2)}
                </td>
                <td className="py-2 px-3 text-slate-500">Net price movement over session</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Mean Spread</td>
                <td className="py-2 px-3 text-slate-100">${stats.meanSpread.toFixed(4)}</td>
                <td className="py-2 px-3 text-slate-500">Average best ask minus best bid</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Median Spread</td>
                <td className="py-2 px-3 text-slate-100">${stats.medianSpread.toFixed(4)}</td>
                <td className="py-2 px-3 text-slate-500">50th percentile spread</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Max Spread</td>
                <td className="py-2 px-3 text-slate-100">${stats.maxSpread.toFixed(4)}</td>
                <td className="py-2 px-3 text-slate-500">Widest gap during high volatility</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Total Price Points</td>
                <td className="py-2 px-3 text-sky-400">{stats.totalPricePoints.toLocaleString()}</td>
                <td className="py-2 px-3 text-slate-500">Combined order book & agent log ticks</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">OHLCV Candles</td>
                <td className="py-2 px-3 text-slate-100">{stats.ohlcvCandles}</td>
                <td className="py-2 px-3 text-slate-500">Constructed discrete time bins</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Trades Executed</td>
                <td className="py-2 px-3 text-slate-100">{stats.tradesCount}</td>
                <td className="py-2 px-3 text-slate-500">Order crossings matched by exchange</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Return Mean</td>
                <td className="py-2 px-3 text-slate-100">{stats.returnMean.toFixed(8)}</td>
                <td className="py-2 px-3 text-slate-500">Average tick log return</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Return Std</td>
                <td className="py-2 px-3 text-slate-100">{stats.returnStd.toFixed(8)}</td>
                <td className="py-2 px-3 text-slate-500">Standard deviation of log returns</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Kurtosis</td>
                <td className="py-2 px-3 text-purple-400 font-bold">{stats.kurtosis.toFixed(2)}</td>
                <td className="py-2 px-3 text-slate-500">Excess kurtosis indicating leptokurtic distribution</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-300 font-semibold">Skewness</td>
                <td className="py-2 px-3 text-slate-100">{stats.skewness.toFixed(4)}</td>
                <td className="py-2 px-3 text-slate-500">Third standardized moment</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
