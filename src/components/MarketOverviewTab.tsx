import React, { useState, useMemo } from 'react';
import { SimData } from '../types/market';
import { nsToDisplay } from '../services/simulator';
import { Eye, TrendingUp, BarChart3, AlertCircle } from 'lucide-react';

interface MarketOverviewTabProps {
  simData: SimData;
}

const AGENT_COLORS = ['#38bdf8', '#a855f7', '#f43f5e', '#10b981', '#fbbf24', '#ec4899', '#6366f1'];

export const MarketOverviewTab: React.FC<MarketOverviewTabProps> = ({ simData }) => {
  const [viewMode, setViewMode] = useState<'candlestick' | 'ticks'>('candlestick');
  const [showOracle, setShowOracle] = useState(true);
  const [showEkf, setShowEkf] = useState(true);
  const [showMomEkf, setShowMomEkf] = useState(false);
  const [showNewsLines, setShowNewsLines] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { book, ohlcv = [], oracle, baseline_ns, time_unit, agents } = simData;
  const timeLabel = `Time (${time_unit} from open)`;

  // Downsampled ticks for high performance
  const downsampleStep = Math.max(1, Math.floor((book.mids?.length || 1) / 1000));
  const tickData = useMemo(() => {
    if (!book.mids || book.mids.length === 0) return [];
    const pts = [];
    for (let i = 0; i < book.mids.length; i += downsampleStep) {
      pts.push({
        timeDisplay: nsToDisplay(book.times_ns[i], baseline_ns, time_unit),
        mid: book.mids[i],
        bestBid: book.best_bids[i],
        bestAsk: book.best_asks[i],
        spread: book.spreads[i],
      });
    }
    return pts;
  }, [book, baseline_ns, time_unit, downsampleStep]);

  // Oracle points in display coordinates
  const oraclePoints = useMemo(() => {
    if (!oracle.times_ns || !oracle.values) return [];
    return oracle.times_ns.map((t, i) => ({
      timeDisplay: nsToDisplay(t, baseline_ns, time_unit),
      value: oracle.values[i],
    }));
  }, [oracle, baseline_ns, time_unit]);

  // News markers
  const newsMarkers = useMemo(() => {
    const list: { timeDisplay: number; sentiment: number; headline: string }[] = [];
    for (const adata of Object.values(agents)) {
      if (adata.news_events && adata.news_events.length > 0) {
        for (const ev of adata.news_events) {
          list.push({
            timeDisplay: nsToDisplay(ev.time_ns, baseline_ns, time_unit),
            sentiment: ev.sentiment,
            headline: ev.headline,
          });
        }
        break;
      }
    }
    return list;
  }, [agents, baseline_ns, time_unit]);

  // EKF series
  const ekfSeries = useMemo(() => {
    return Object.entries(agents).map(([aid, adata], idx) => {
      const updates = adata.ekf_updates || [];
      const ds = Math.max(1, Math.floor(updates.length / 300));
      const pts = [];
      for (let i = 0; i < updates.length; i += ds) {
        pts.push({
          timeDisplay: nsToDisplay(updates[i].time_ns, baseline_ns, time_unit),
          xHat: updates[i].x_hat / 100, // cents to dollars
        });
      }
      return {
        name: adata.name,
        color: AGENT_COLORS[idx % AGENT_COLORS.length],
        points: pts,
      };
    });
  }, [agents, baseline_ns, time_unit]);

  // Momentum EKF series
  const momAgents = simData.mom_agents || {};
  const momSeries = useMemo(() => {
    const colors = ['#06b6d4', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6'];
    return Object.entries(momAgents).map(([aid, mdata], idx) => {
      const updates = mdata.kf_updates || [];
      const ds = Math.max(1, Math.floor(updates.length / 300));
      const pts = [];
      for (let i = 0; i < updates.length; i += ds) {
        pts.push({
          timeDisplay: nsToDisplay(updates[i].time_ns, baseline_ns, time_unit),
          trendPrice: Math.exp(updates[i].l_hat) / 100,
        });
      }
      return {
        name: mdata.name,
        color: colors[idx % colors.length],
        points: pts,
      };
    });
  }, [momAgents, baseline_ns, time_unit]);

  // Bounds for Candlesticks
  const candleMinPrice = useMemo(() => {
    if (ohlcv.length === 0) return 0;
    return Math.min(...ohlcv.map((c) => c.low));
  }, [ohlcv]);

  const candleMaxPrice = useMemo(() => {
    if (ohlcv.length === 0) return 1;
    return Math.max(...ohlcv.map((c) => c.high));
  }, [ohlcv]);

  const maxVolume = useMemo(() => {
    if (ohlcv.length === 0) return 1;
    return Math.max(...ohlcv.map((c) => c.volume), 1);
  }, [ohlcv]);

  const maxSpread = useMemo(() => {
    if (book.spreads.length === 0) return 1;
    return Math.max(...book.spreads, 0.1);
  }, [book.spreads]);

  // Chart dimensions
  const svgWidth = 900;
  const mainHeight = 320;
  const volHeight = 80;
  const spreadHeight = 80;
  const padding = { top: 20, right: 60, bottom: 25, left: 60 };

  const pricePadding = (candleMaxPrice - candleMinPrice) * 0.08 || 0.1;
  const yMin = candleMinPrice - pricePadding;
  const yMax = candleMaxPrice + pricePadding;
  const yRange = yMax - yMin || 1;

  const xToSvg = (idx: number, total: number) => {
    const usableWidth = svgWidth - padding.left - padding.right;
    return padding.left + (idx / Math.max(1, total - 1)) * usableWidth;
  };

  const yToSvg = (price: number) => {
    const usableHeight = mainHeight - padding.top - padding.bottom;
    return padding.top + (1 - (price - yMin) / yRange) * usableHeight;
  };

  const volToSvg = (vol: number) => {
    const usableHeight = volHeight - 15;
    return 15 + (1 - vol / maxVolume) * usableHeight;
  };

  const spreadToSvg = (sp: number) => {
    const usableHeight = spreadHeight - 15;
    return 15 + (1 - sp / maxSpread) * usableHeight;
  };

  const activeCandle = hoverIndex !== null && ohlcv[hoverIndex] ? ohlcv[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Chart Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chart View:</span>
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('candlestick')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'candlestick' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Candlesticks ({ohlcv.length})</span>
            </button>
            <button
              onClick={() => setViewMode('ticks')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'ticks' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Tick Mid-Price ({book.mids.length})</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-amber-400 font-medium">
            <input
              type="checkbox"
              checked={showOracle}
              onChange={(e) => setShowOracle(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>Oracle Fundamental (dashed)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-sky-400 font-medium">
            <input
              type="checkbox"
              checked={showEkf}
              onChange={(e) => setShowEkf(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>EKF Estimates (x̂)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-cyan-400 font-medium">
            <input
              type="checkbox"
              checked={showMomEkf}
              onChange={(e) => setShowMomEkf(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <span>Mom. Trends (l̂)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-emerald-400 font-medium">
            <input
              type="checkbox"
              checked={showNewsLines}
              onChange={(e) => setShowNewsLines(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>News Shocks (vertical)</span>
          </label>
        </div>
      </div>

      {/* Main Candlestick & Multi-Panel SVG */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl overflow-hidden backdrop-blur">
        {/* Hover Information Banner */}
        <div className="flex flex-wrap items-center justify-between text-xs font-mono pb-3 border-b border-slate-800/80 mb-2 gap-2 min-h-[32px]">
          {activeCandle ? (
            <div className="flex flex-wrap items-center gap-4 text-slate-300">
              <span className="text-slate-400">
                t: <b className="text-white">{activeCandle.time_display} {time_unit}</b>
              </span>
              <span>
                O: <b className="text-slate-200">${activeCandle.open.toFixed(2)}</b>
              </span>
              <span>
                H: <b className="text-emerald-400">${activeCandle.high.toFixed(2)}</b>
              </span>
              <span>
                L: <b className="text-rose-400">${activeCandle.low.toFixed(2)}</b>
              </span>
              <span>
                C: <b className={activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}>
                  ${activeCandle.close.toFixed(2)}
                </b>
              </span>
              <span className="text-slate-400">
                Vol: <b className="text-indigo-400">{activeCandle.volume} ticks</b>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Hover over candles or price curve to inspect timestamp and price action.</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Bullish
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Bearish
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 border-t border-dashed border-amber-500 inline-block" />
              Oracle
            </span>
          </div>
        </div>

        {/* SVG Visualization */}
        <div className="relative w-full overflow-x-auto">
          {ohlcv.length > 0 && viewMode === 'candlestick' ? (
            <div className="flex flex-col gap-2">
              {/* Panel 1: Candlesticks & Estimates */}
              <div className="relative">
                <svg
                  viewBox={`0 0 ${svgWidth} ${mainHeight}`}
                  className="w-full h-auto select-none"
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <defs>
                    <linearGradient id="bullishGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00cc66" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#00cc66" stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id="bearishGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff3366" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#ff3366" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const priceVal = yMin + ratio * yRange;
                    const yPos = yToSvg(priceVal);
                    return (
                      <g key={ratio}>
                        <line
                          x1={padding.left}
                          y1={yPos}
                          x2={svgWidth - padding.right}
                          y2={yPos}
                          stroke="#1e293b"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={svgWidth - padding.right + 6}
                          y={yPos + 4}
                          fill="#64748b"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          ${priceVal.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}

                  {/* News Event Vertical Lines */}
                  {showNewsLines &&
                    newsMarkers.map((news, i) => {
                      const maxT = ohlcv[ohlcv.length - 1]?.time_display || 1;
                      const ratio = Math.max(0, Math.min(1, news.timeDisplay / maxT));
                      const xPos = padding.left + ratio * (svgWidth - padding.left - padding.right);
                      const isPos = news.sentiment > 0;
                      return (
                        <g key={i}>
                          <line
                            x1={xPos}
                            y1={padding.top}
                            x2={xPos}
                            y2={mainHeight - padding.bottom}
                            stroke={isPos ? '#00cc66' : '#ff3366'}
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                          />
                          <circle cx={xPos} cy={padding.top + 6} r="3.5" fill={isPos ? '#00cc66' : '#ff3366'} />
                        </g>
                      );
                    })}

                  {/* Oracle Fundamental dashed line */}
                  {showOracle && oraclePoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#ff9900"
                      strokeWidth="2"
                      strokeDasharray="5 4"
                      points={oraclePoints
                        .map((pt) => {
                          const maxT = ohlcv[ohlcv.length - 1]?.time_display || 1;
                          const ratio = Math.max(0, Math.min(1, pt.timeDisplay / maxT));
                          const x = padding.left + ratio * (svgWidth - padding.left - padding.right);
                          const y = yToSvg(pt.value);
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                  )}

                  {/* EKF Agent Estimates x̂ */}
                  {showEkf &&
                    ekfSeries.map((s, sIdx) => {
                      if (s.points.length < 2) return null;
                      const maxT = ohlcv[ohlcv.length - 1]?.time_display || 1;
                      return (
                        <polyline
                          key={sIdx}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="1.5"
                          opacity="0.65"
                          points={s.points
                            .map((pt) => {
                              const ratio = Math.max(0, Math.min(1, pt.timeDisplay / maxT));
                              const x = padding.left + ratio * (svgWidth - padding.left - padding.right);
                              const y = yToSvg(pt.xHat);
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />
                      );
                    })}

                  {/* Momentum EKF Trend Overlays l̂ */}
                  {showMomEkf &&
                    momSeries.map((s, sIdx) => {
                      if (s.points.length < 2) return null;
                      const maxT = ohlcv[ohlcv.length - 1]?.time_display || 1;
                      return (
                        <polyline
                          key={`mom-${sIdx}`}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          opacity="0.75"
                          points={s.points
                            .map((pt) => {
                              const ratio = Math.max(0, Math.min(1, pt.timeDisplay / maxT));
                              const x = padding.left + ratio * (svgWidth - padding.left - padding.right);
                              const y = yToSvg(pt.trendPrice);
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />
                      );
                    })}

                  {/* Candlestick Bars */}
                  {ohlcv.map((candle, idx) => {
                    const x = xToSvg(idx, ohlcv.length);
                    const isBullish = candle.close >= candle.open;
                    const yHigh = yToSvg(candle.high);
                    const yLow = yToSvg(candle.low);
                    const yOpen = yToSvg(candle.open);
                    const yClose = yToSvg(candle.close);

                    const bodyTop = Math.min(yOpen, yClose);
                    const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
                    const candleWidth = Math.max(2, Math.min(8, (svgWidth - padding.left - padding.right) / ohlcv.length - 2));

                    return (
                      <g
                        key={idx}
                        className="cursor-pointer transition-opacity"
                        onMouseEnter={() => setHoverIndex(idx)}
                      >
                        {/* Wick */}
                        <line
                          x1={x}
                          y1={yHigh}
                          x2={x}
                          y2={yLow}
                          stroke={isBullish ? '#00cc66' : '#ff3366'}
                          strokeWidth="1.2"
                        />
                        {/* Body */}
                        <rect
                          x={x - candleWidth / 2}
                          y={bodyTop}
                          width={candleWidth}
                          height={bodyHeight}
                          fill={isBullish ? 'url(#bullishGrad)' : 'url(#bearishGrad)'}
                          stroke={isBullish ? '#00cc66' : '#ff3366'}
                          strokeWidth="1"
                          rx="0.5"
                        />
                      </g>
                    );
                  })}

                  {/* Active Hover Crosshair */}
                  {hoverIndex !== null && (
                    <g>
                      <line
                        x1={xToSvg(hoverIndex, ohlcv.length)}
                        y1={padding.top}
                        x2={xToSvg(hoverIndex, ohlcv.length)}
                        y2={mainHeight - padding.bottom}
                        stroke="#94a3b8"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    </g>
                  )}
                </svg>
              </div>

              {/* Panel 2: Volume Subplot */}
              <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono px-2 mb-1">
                  <span className="font-semibold uppercase text-slate-500">Tick Volume</span>
                  <span>Max: {maxVolume} ticks</span>
                </div>
                <svg viewBox={`0 0 ${svgWidth} ${volHeight}`} className="w-full h-auto">
                  {ohlcv.map((candle, idx) => {
                    const x = xToSvg(idx, ohlcv.length);
                    const barH = (candle.volume / maxVolume) * (volHeight - 20);
                    const candleWidth = Math.max(2, Math.min(8, (svgWidth - padding.left - padding.right) / ohlcv.length - 2));
                    const isBullish = candle.close >= candle.open;
                    return (
                      <rect
                        key={idx}
                        x={x - candleWidth / 2}
                        y={volHeight - 15 - barH}
                        width={candleWidth}
                        height={Math.max(1, barH)}
                        fill={isBullish ? 'rgba(0, 204, 102, 0.5)' : 'rgba(255, 51, 102, 0.5)'}
                        rx="0.5"
                      />
                    );
                  })}
                  <line
                    x1={padding.left}
                    y1={volHeight - 15}
                    x2={svgWidth - padding.right}
                    y2={volHeight - 15}
                    stroke="#1e293b"
                  />
                </svg>
              </div>

              {/* Panel 3: Bid-Ask Spread Subplot */}
              <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono px-2 mb-1">
                  <span className="font-semibold uppercase text-purple-400">Bid-Ask Spread</span>
                  <span>Max: ${maxSpread.toFixed(3)}</span>
                </div>
                <svg viewBox={`0 0 ${svgWidth} ${spreadHeight}`} className="w-full h-auto">
                  <defs>
                    <linearGradient id="spreadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  {tickData.length > 1 && (
                    <polygon
                      fill="url(#spreadGrad)"
                      points={`
                        ${padding.left},${spreadHeight - 15}
                        ${tickData
                          .map((pt, i) => {
                            const x = xToSvg(i, tickData.length);
                            const y = spreadToSvg(pt.spread);
                            return `${x},${y}`;
                          })
                          .join(' ')}
                        ${svgWidth - padding.right},${spreadHeight - 15}
                      `}
                    />
                  )}
                  {tickData.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="1.2"
                      points={tickData
                        .map((pt, i) => `${xToSvg(i, tickData.length)},${spreadToSvg(pt.spread)}`)
                        .join(' ')}
                    />
                  )}
                  <line
                    x1={padding.left}
                    y1={spreadHeight - 15}
                    x2={svgWidth - padding.right}
                    y2={spreadHeight - 15}
                    stroke="#1e293b"
                  />
                  <text
                    x={svgWidth - padding.right / 2}
                    y={spreadHeight - 5}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {timeLabel}
                  </text>
                </svg>
              </div>
            </div>
          ) : (
            /* High-Density Tick View */
            <div className="flex flex-col gap-4">
              <svg viewBox={`0 0 ${svgWidth} ${mainHeight + 50}`} className="w-full h-auto">
                {/* Mid price line */}
                {tickData.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#00ccff"
                    strokeWidth="1.5"
                    points={tickData.map((pt, i) => `${xToSvg(i, tickData.length)},${yToSvg(pt.mid)}`).join(' ')}
                  />
                )}
                {/* Oracle */}
                {showOracle && oraclePoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#ff9900"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                    points={oraclePoints
                      .map((pt) => {
                        const maxT = tickData[tickData.length - 1]?.timeDisplay || 1;
                        const ratio = Math.max(0, Math.min(1, pt.timeDisplay / maxT));
                        const x = padding.left + ratio * (svgWidth - padding.left - padding.right);
                        return `${x},${yToSvg(pt.value)}`;
                      })
                      .join(' ')}
                  />
                )}
                {/* Grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((r) => {
                  const p = yMin + r * yRange;
                  const y = yToSvg(p);
                  return (
                    <g key={r}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="#1e293b"
                        strokeDasharray="3 3"
                      />
                      <text x={svgWidth - padding.right + 6} y={y + 3} fill="#64748b" fontSize="10" fontFamily="monospace">
                        ${p.toFixed(2)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Bid-Ask Spread Band */}
      {book.best_bids && book.best_bids.length > 1 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-200">Bid-Ask Spread Band</h3>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2.5 h-0.5 bg-rose-400" /> Best Ask
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-0.5 bg-emerald-400" /> Best Bid
              </span>
            </div>
          </div>

          <div className="relative w-full overflow-hidden">
            <svg viewBox={`0 0 ${svgWidth} 160`} className="w-full h-auto">
              {tickData.length > 1 && (
                <polygon
                  fill="rgba(56, 189, 248, 0.15)"
                  points={`
                    ${tickData.map((pt, i) => `${xToSvg(i, tickData.length)},${yToSvg(pt.bestAsk)}`).join(' ')}
                    ${tickData
                      .slice()
                      .reverse()
                      .map((pt, i) => `${xToSvg(tickData.length - 1 - i, tickData.length)},${yToSvg(pt.bestBid)}`)
                      .join(' ')}
                  `}
                />
              )}
              {tickData.length > 1 && (
                <>
                  <polyline
                    fill="none"
                    stroke="#ff5555"
                    strokeWidth="1.2"
                    points={tickData.map((pt, i) => `${xToSvg(i, tickData.length)},${yToSvg(pt.bestAsk)}`).join(' ')}
                  />
                  <polyline
                    fill="none"
                    stroke="#55ff55"
                    strokeWidth="1.2"
                    points={tickData.map((pt, i) => `${xToSvg(i, tickData.length)},${yToSvg(pt.bestBid)}`).join(' ')}
                  />
                </>
              )}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
