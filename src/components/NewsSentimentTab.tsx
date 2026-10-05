import React, { useState, useMemo } from 'react';
import { SimData } from '../types/market';
import { nsToDisplay } from '../services/simulator';
import { scoreHeadline, SentimentResult } from '../services/sentiment';
import { Newspaper, Sparkles, TrendingUp, CheckCircle, ArrowRight } from 'lucide-react';

interface NewsSentimentTabProps {
  simData: SimData;
}

export const NewsSentimentTab: React.FC<NewsSentimentTabProps> = ({ simData }) => {
  const [testHeadline, setTestHeadline] = useState('Company reports strong quarterly growth and raises full year guidance');
  const [testResult, setTestResult] = useState<SentimentResult | null>(() => scoreHeadline(testHeadline));
  const [isScoring, setIsScoring] = useState(false);

  const { agents, book, baseline_ns, time_unit } = simData;
  const timeLabel = `Time (${time_unit} from open)`;

  const handleScore = () => {
    setIsScoring(true);
    setTimeout(() => {
      setTestResult(scoreHeadline(testHeadline));
      setIsScoring(false);
    }, 250);
  };

  // Extract all news events from agents
  const simulationNews = useMemo(() => {
    const list: { timeDisplay: number; sentiment: number; headline: string; shift: number; xHatNew: number }[] = [];
    for (const adata of Object.values(agents)) {
      if (adata.news_events && adata.news_events.length > 0) {
        for (const ev of adata.news_events) {
          list.push({
            timeDisplay: nsToDisplay(ev.time_ns, baseline_ns, time_unit),
            sentiment: ev.sentiment,
            headline: ev.headline,
            shift: ev.shift,
            xHatNew: ev.x_hat_new,
          });
        }
        break;
      }
    }
    return list;
  }, [agents, baseline_ns, time_unit]);

  // Downsample price series for the impact chart
  const dsStep = Math.max(1, Math.floor((book.mids?.length || 1) / 500));
  const impactData = useMemo(() => {
    if (!book.mids || book.mids.length === 0) return [];
    const pts = [];
    for (let i = 0; i < book.mids.length; i += dsStep) {
      pts.push({
        timeDisplay: nsToDisplay(book.times_ns[i], baseline_ns, time_unit),
        mid: book.mids[i],
      });
    }
    return pts;
  }, [book, baseline_ns, time_unit, dsStep]);

  const minPrice = useMemo(() => {
    if (impactData.length === 0) return 0;
    return Math.min(...impactData.map((d) => d.mid));
  }, [impactData]);

  const maxPrice = useMemo(() => {
    if (impactData.length === 0) return 1;
    return Math.max(...impactData.map((d) => d.mid));
  }, [impactData]);

  const svgW = 850;
  const svgH = 240;
  const pad = { top: 20, right: 40, bottom: 25, left: 55 };

  const xToSvg = (t: number) => {
    const maxT = impactData[impactData.length - 1]?.timeDisplay || 1;
    const ratio = Math.max(0, Math.min(1, t / maxT));
    return pad.left + ratio * (svgW - pad.left - pad.right);
  };

  const yToSvg = (p: number) => {
    const range = maxPrice - minPrice || 1;
    return pad.top + (1 - (p - minPrice) / range) * (svgH - pad.top - pad.bottom);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Interactive FinBERT Sentiment Tester */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            FinBERT Financial Sentiment Analyzer
          </h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Test any financial headline using natural language scoring tuned for market reaction signals.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            value={testHeadline}
            onChange={(e) => setTestHeadline(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            placeholder="Type a headline to score..."
            onKeyDown={(e) => e.key === 'Enter' && handleScore()}
          />
          <button
            onClick={handleScore}
            disabled={isScoring}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Score with FinBERT</span>
          </button>
        </div>

        {testResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Positive Probability
              </span>
              <p className="text-lg font-mono font-bold text-emerald-400">
                {(testResult.positive * 100).toFixed(1)}%
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Negative Probability
              </span>
              <p className="text-lg font-mono font-bold text-rose-400">
                {(testResult.negative * 100).toFixed(1)}%
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Neutral Probability
              </span>
              <p className="text-lg font-mono font-bold text-slate-300">
                {(testResult.neutral * 100).toFixed(1)}%
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Compound Sentiment
              </span>
              <div className="flex items-center gap-1.5 text-lg font-mono font-bold">
                <span>{testResult.sentiment > 0.1 ? '🟢' : testResult.sentiment < -0.1 ? '🔴' : '⚪'}</span>
                <span
                  className={
                    testResult.sentiment > 0.1
                      ? 'text-emerald-400'
                      : testResult.sentiment < -0.1
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }
                >
                  {testResult.sentiment > 0 ? '+' : ''}
                  {testResult.sentiment.toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Price Impact Timeline */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Price Impact Timeline
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Vertical lines indicate news delivery into the market
          </span>
        </div>

        {impactData.length > 1 ? (
          <div className="relative">
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
              {/* Grid lines */}
              {[0, 0.5, 1].map((r) => {
                const p = minPrice + r * (maxPrice - minPrice);
                const y = yToSvg(p);
                return (
                  <g key={r}>
                    <line x1={pad.left} y1={y} x2={svgW - pad.right} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                    <text x={pad.left - 6} y={y + 3} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">
                      ${p.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* News vertical shock lines */}
              {simulationNews.map((ev, i) => {
                const xPos = xToSvg(ev.timeDisplay);
                const isPos = ev.sentiment > 0;
                return (
                  <g key={i}>
                    <line
                      x1={xPos}
                      y1={pad.top}
                      x2={xPos}
                      y2={svgH - pad.bottom}
                      stroke={isPos ? '#00cc66' : '#ff3366'}
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                    <circle cx={xPos} cy={pad.top + 6} r="4" fill={isPos ? '#00cc66' : '#ff3366'} />
                  </g>
                );
              })}

              {/* Price curve */}
              <polyline
                fill="none"
                stroke="#60a5fa"
                strokeWidth="1.8"
                points={impactData.map((d) => `${xToSvg(d.timeDisplay)},${yToSvg(d.mid)}`).join(' ')}
              />

              <line x1={pad.left} y1={svgH - pad.bottom} x2={svgW - pad.right} y2={svgH - pad.bottom} stroke="#1e293b" />
              <text x={svgW - pad.right} y={svgH - 6} fill="#64748b" fontSize="10" textAnchor="end">
                {timeLabel}
              </text>
            </svg>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-xs text-slate-500">
            No price history available.
          </div>
        )}
      </div>

      {/* News Events in this Simulation */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2 mb-3">
          <Newspaper className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            Injected News Shocks ({simulationNews.length})
          </h3>
        </div>

        {simulationNews.length > 0 ? (
          <div className="flex flex-col gap-3">
            {simulationNews.map((ev, idx) => {
              const isPos = ev.sentiment > 0.1;
              const isNeg = ev.sentiment < -0.1;
              const emoji = isPos ? '📈' : isNeg ? '📉' : '➖';
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border-l-4 text-xs flex flex-col gap-1 transition-all ${
                    isPos
                      ? 'bg-emerald-950/20 border-emerald-500 text-slate-200'
                      : isNeg
                      ? 'bg-rose-950/20 border-rose-500 text-slate-200'
                      : 'bg-slate-800/30 border-slate-500 text-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-300">
                      {emoji} t = {ev.timeDisplay.toFixed(2)} {time_unit}
                    </span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                        isPos
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : isNeg
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-slate-700/40 text-slate-300'
                      }`}
                    >
                      Sentiment: {ev.sentiment > 0 ? '+' : ''}
                      {ev.sentiment.toFixed(2)}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-100 text-sm mt-0.5">{ev.headline}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-1">
                    <span>
                      EKF Shift: <b className="text-slate-200">{((ev.shift - 1) * 100).toFixed(2)}%</b>
                    </span>
                    {ev.xHatNew > 0 && (
                      <span>
                        Target Fundamental: <b className="text-amber-400">${(ev.xHatNew / 100).toFixed(2)}</b>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
            No news events were injected for this run. You can queue predefined or custom news in the sidebar and run a
            simulation to observe market reaction!
          </div>
        )}
      </div>
    </div>
  );
};
