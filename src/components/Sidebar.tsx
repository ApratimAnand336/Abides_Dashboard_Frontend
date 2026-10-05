import React, { useState } from 'react';
import { Play, Plus, Trash2, Sliders, Newspaper, Sparkles, RefreshCw, BookOpen } from 'lucide-react';
import { PREDEFINED_NEWS, scoreHeadline } from '../services/sentiment';
import { QueuedNewsItem } from '../types/market';

interface SidebarProps {
  seed: number;
  setSeed: (s: number) => void;
  endTime: string;
  setEndTime: (t: string) => void;
  numEkf: number;
  setNumEkf: (n: number) => void;
  numMomEkf: number;
  setNumMomEkf: (n: number) => void;
  queuedNews: QueuedNewsItem[];
  setQueuedNews: React.Dispatch<React.SetStateAction<QueuedNewsItem[]>>;
  onRunSimulation: () => void;
  onResetOriginal: () => void;
  isRunning: boolean;
  onOpenArchitecture: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  seed,
  setSeed,
  endTime,
  setEndTime,
  numEkf,
  setNumEkf,
  numMomEkf,
  setNumMomEkf,
  queuedNews,
  setQueuedNews,
  onRunSimulation,
  onResetOriginal,
  isRunning,
  onOpenArchitecture,
}) => {
  const [newsTime, setNewsTime] = useState('00:05:00');
  const [newsMode, setNewsMode] = useState<'predefined' | 'custom'>('predefined');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [customHeadline, setCustomHeadline] = useState('Company announces breakthrough AI market product');
  const [useFinbert, setUseFinbert] = useState(true);
  const [manualSentiment, setManualSentiment] = useState(0.0);
  const [finbertFeedback, setFinbertFeedback] = useState<string | null>(null);

  const handleAddNews = () => {
    let sentimentVal = 0;
    let headline = '';

    if (newsMode === 'predefined') {
      const preset = PREDEFINED_NEWS[selectedPresetIndex];
      headline = preset[0];
      sentimentVal = preset[1];
    } else {
      headline = customHeadline.trim();
      if (!headline) return;

      if (useFinbert) {
        const res = scoreHeadline(headline);
        sentimentVal = res.sentiment;
        setFinbertFeedback(`FinBERT scored: ${sentimentVal > 0 ? '+' : ''}${sentimentVal.toFixed(2)} (${res.label})`);
        setTimeout(() => setFinbertFeedback(null), 3500);
      } else {
        sentimentVal = manualSentiment;
      }
    }

    const newItem: QueuedNewsItem = {
      id: Date.now().toString(),
      timeOffset: newsTime,
      symbol: 'ABM',
      sentiment: Number(sentimentVal.toFixed(2)),
      headline,
    };

    setQueuedNews((prev) => [...prev, newItem]);
  };

  const handleRemoveNews = (id: string) => {
    setQueuedNews((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllNews = () => {
    setQueuedNews([]);
  };

  return (
    <aside className="w-full lg:w-80 shrink-0 bg-slate-900/90 border-r border-slate-800 p-5 flex flex-col gap-6 overflow-y-auto">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              AB
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">ABIDES</h2>
              <span className="text-[10px] text-slate-400 font-mono">Market Simulation</span>
            </div>
          </div>
          <button
            onClick={onOpenArchitecture}
            className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/40 px-2 py-1 rounded border border-indigo-800/40 transition-colors"
            title="Read system architecture & model guide"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Guide</span>
          </button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Agent-Based Interactive Discrete Event Simulator with Limit Order Book and EKF agents.
        </p>
      </div>

      {/* Simulation Controls */}
      <div className="flex flex-col gap-4 border-t border-slate-800/80 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span>Simulation Controls</span>
        </div>

        {/* Random Seed */}
        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 block">Random Seed</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={() => setSeed(Math.floor(Math.random() * 100000))}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              title="Randomize Seed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Market Close Time */}
        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 block">Market Close Time</label>
          <select
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="10:00:00">10:00:00 (30m session)</option>
            <option value="10:30:00">10:30:00 (1h session)</option>
            <option value="11:00:00">11:00:00 (1.5h session)</option>
            <option value="12:00:00">12:00:00 (2.5h session)</option>
            <option value="14:00:00">14:00:00 (4.5h session)</option>
            <option value="16:00:00">16:00:00 (Full Day 6.5h)</option>
          </select>
        </div>

        {/* Number of Fundamental EKF Agents */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400 font-medium">Fundamental EKF</label>
            <span className="text-xs font-mono text-indigo-400 font-bold">{numEkf}</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={numEkf}
            onChange={(e) => setNumEkf(parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>1</span>
            <span>10</span>
            <span>20</span>
          </div>
        </div>

        {/* Number of Momentum EKF Agents */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400 font-medium">Momentum EKF</label>
            <span className="text-xs font-mono text-cyan-400 font-bold">{numMomEkf}</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={numMomEkf}
            onChange={(e) => setNumMomEkf(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>1</span>
            <span>10</span>
            <span>20</span>
          </div>
        </div>
      </div>

      {/* News Events Injection */}
      <div className="flex flex-col gap-4 border-t border-slate-800/80 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
          <Newspaper className="w-4 h-4 text-emerald-400" />
          <span>News Events Injection</span>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 block">Time Offset (from 09:30 open)</label>
          <input
            type="text"
            value={newsTime}
            onChange={(e) => setNewsTime(e.target.value)}
            placeholder="00:05:00"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* News Mode toggle */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
          <button
            onClick={() => setNewsMode('predefined')}
            className={`py-1 text-xs font-medium rounded-md transition-colors ${
              newsMode === 'predefined' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Predefined
          </button>
          <button
            onClick={() => setNewsMode('custom')}
            className={`py-1 text-xs font-medium rounded-md transition-colors ${
              newsMode === 'custom' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Custom
          </button>
        </div>

        {newsMode === 'predefined' ? (
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">Select Headline</label>
            <select
              value={selectedPresetIndex}
              onChange={(e) => setSelectedPresetIndex(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {PREDEFINED_NEWS.map(([headline, score], i) => (
                <option key={i} value={i}>
                  {headline.substring(0, 36)}... ({score > 0 ? '+' : ''}{score.toFixed(2)})
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center justify-between text-xs px-2.5 py-1.5 bg-slate-950/60 rounded-md border border-slate-800">
              <span className="text-slate-400">Sentiment Impact:</span>
              <span
                className={`font-mono font-bold ${
                  PREDEFINED_NEWS[selectedPresetIndex][1] > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {PREDEFINED_NEWS[selectedPresetIndex][1] > 0 ? '+' : ''}
                {PREDEFINED_NEWS[selectedPresetIndex][1].toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Headline</label>
              <textarea
                value={customHeadline}
                onChange={(e) => setCustomHeadline(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none transition-colors"
                placeholder="Enter financial headline..."
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useFinbert}
                onChange={(e) => setUseFinbert(e.target.checked)}
                className="accent-indigo-500 rounded"
              />
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Score with FinBERT
              </span>
            </label>

            {!useFinbert && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Manual Sentiment</span>
                  <span className="font-mono text-slate-200 font-bold">{manualSentiment.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-1.0}
                  max={1.0}
                  step={0.05}
                  value={manualSentiment}
                  onChange={(e) => setManualSentiment(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            )}

            {finbertFeedback && (
              <div className="text-[11px] px-2 py-1 bg-indigo-950/60 text-indigo-300 rounded border border-indigo-800 font-mono">
                {finbertFeedback}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleAddNews}
          className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Add News Event</span>
        </button>

        {/* Queued News Events */}
        {queuedNews.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Queued Events ({queuedNews.length})</span>
              <button
                onClick={handleClearAllNews}
                className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {queuedNews.map((item) => {
                const isPos = item.sentiment > 0.1;
                const isNeg = item.sentiment < -0.1;
                return (
                  <div
                    key={item.id}
                    className={`p-2 rounded-r-lg text-xs flex justify-between items-start gap-2 border-l-2 ${
                      isPos
                        ? 'bg-emerald-950/30 border-emerald-500 text-emerald-200'
                        : isNeg
                        ? 'bg-rose-950/30 border-rose-500 text-rose-200'
                        : 'bg-slate-800/40 border-slate-500 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-mono text-[11px] font-semibold">
                        <span>{item.timeOffset}</span>
                        <span className={isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-slate-400'}>
                          {item.sentiment > 0 ? '+' : ''}
                          {item.sentiment.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[11px] truncate text-slate-400 mt-0.5" title={item.headline}>
                        {item.headline}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveNews(item.id)}
                      className="text-slate-500 hover:text-rose-400 shrink-0 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-auto pt-4 border-t border-slate-800/80 flex flex-col gap-2">
        <button
          onClick={onRunSimulation}
          disabled={isRunning}
          className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${
            isRunning
              ? 'bg-indigo-700/60 cursor-not-allowed text-indigo-200'
              : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/25 active:scale-[0.99]'
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Simulating Market...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>🚀 Run Simulation</span>
            </>
          )}
        </button>

        <button
          onClick={onResetOriginal}
          disabled={isRunning}
          className="text-xs text-slate-400 hover:text-slate-200 py-1.5 text-center transition-colors"
        >
          Reset to Baseline Data (Seed 42)
        </button>
      </div>
    </aside>
  );
};
