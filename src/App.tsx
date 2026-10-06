import React, { useState, useMemo } from 'react';
import initialSimJson from './data/sim_data.json';
import { SimData, QueuedNewsItem } from './types/market';
import { buildOHLCV, populateAgentCalculations, runNewSimulation } from './services/simulator';
import { DEFAULT_MOM_AGENT_IDS, populateMomAgents } from './services/momentumEngine';
import { Sidebar } from './components/Sidebar';
import { TopMetrics } from './components/TopMetrics';
import { MarketOverviewTab } from './components/MarketOverviewTab';
import { AgentPerformanceTab } from './components/AgentPerformanceTab';
import { NewsSentimentTab } from './components/NewsSentimentTab';
import { MarketHealthTab } from './components/MarketHealthTab';
import { ArchitectureModal } from './components/ArchitectureModal';
import { BarChart2, Cpu, Newspaper, Activity, Sparkles, CheckCircle2 } from 'lucide-react';

export function App() {
  // Initialize default dataset with real ABIDES full-day discrete-event simulation
  const defaultSimData = useMemo(() => {
    return initialSimJson as unknown as SimData;
  }, []);

  const [simData, setSimData] = useState<SimData>(defaultSimData);
  const [seed, setSeed] = useState<number>(defaultSimData.seed || 42);
  const [endTime, setEndTime] = useState<string>(defaultSimData.end_time || '16:00:00');
  const [numEkf, setNumEkf] = useState<number>(Object.keys(defaultSimData.agents).length || 5);
  const [numMomEkf, setNumMomEkf] = useState<number>(defaultSimData.mom_agent_ids?.length || 5);
  const [queuedNews, setQueuedNews] = useState<QueuedNewsItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'news' | 'health'>('overview');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleRunSimulation = async () => {
    setIsRunning(true);
    // Format news events input
    const newsEvents: [string, string, number, string][] = queuedNews.map((n) => [
      n.timeOffset,
      n.symbol,
      n.sentiment,
      n.headline,
    ]);

    try {
      let newSim: SimData | null = null;
      try {
        const res = await fetch('/api/run-simulation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed,
            endTime,
            ticker: simData.ticker || 'ABM',
            numEkf,
            numMomEkf,
            newsEvents,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            newSim = json.data;
          }
        }
      } catch (backendErr) {
        console.warn('Backend simulation runner unavailable, generating via in-browser simulator:', backendErr);
      }

      if (!newSim) {
        // Run full client-side discrete event simulation engine
        newSim = runNewSimulation({
          seed,
          endTime,
          ticker: simData.ticker || 'ABM',
          numEkf,
          numMomEkf,
          newsEvents,
        });
      }

      setSimData(newSim);
      showToast(
        `Simulation completed! ${newSim.book.mids.length.toLocaleString()} ticks, ${newSim.trades.length.toLocaleString()} trades across ${numEkf} Fundamental & ${numMomEkf} Momentum agents.`
      );
    } catch (err: any) {
      console.error('Simulation error:', err);
      showToast(`Simulation error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleResetOriginal = () => {
    setSimData(defaultSimData);
    setSeed(defaultSimData.seed);
    setEndTime(defaultSimData.end_time);
    setNumEkf(Object.keys(defaultSimData.agents).length);
    setNumMomEkf(defaultSimData.mom_agent_ids?.length || 5);
    setQueuedNews([]);
    showToast('Reset to original baseline dataset (Seed 42).');
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0b0c16] text-slate-100">
      {/* Sidebar Controls */}
      <Sidebar
        seed={seed}
        setSeed={setSeed}
        endTime={endTime}
        setEndTime={setEndTime}
        numEkf={numEkf}
        setNumEkf={setNumEkf}
        numMomEkf={numMomEkf}
        setNumMomEkf={setNumMomEkf}
        queuedNews={queuedNews}
        setQueuedNews={setQueuedNews}
        onRunSimulation={handleRunSimulation}
        onResetOriginal={handleResetOriginal}
        isRunning={isRunning}
        onOpenArchitecture={() => setIsArchitectureModalOpen(true)}
      />

      {/* Main Dashboard Area */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-medium flex items-center gap-2 shadow-lg backdrop-blur animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Dashboard Title & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>📊 ABIDES Market Simulation Dashboard</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Multi-agent discrete event simulation of NASDAQ limit order book with Extended Kalman Filter agents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
              Ticker: <b className="text-white">{simData.ticker}</b>
            </div>
            <div className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
              Seed: <b className="text-indigo-400">{simData.seed}</b>
            </div>
            <div className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
              Close: <b className="text-white">{simData.end_time}</b>
            </div>
            <div className="px-2.5 py-1 bg-indigo-950/40 border border-indigo-800/40 rounded-lg text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Interactive LOB</span>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <TopMetrics simData={simData} />

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-semibold text-xs md:text-sm transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'overview'
                ? 'text-white border-indigo-500 bg-slate-900/60 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            <span>📈 Market Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-semibold text-xs md:text-sm transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'agents'
                ? 'text-white border-indigo-500 bg-slate-900/60 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>🤖 Agent Performance</span>
          </button>

          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-semibold text-xs md:text-sm transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'news'
                ? 'text-white border-indigo-500 bg-slate-900/60 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Newspaper className="w-4 h-4 text-purple-400" />
            <span>📰 News & Sentiment</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-semibold text-xs md:text-sm transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'health'
                ? 'text-white border-indigo-500 bg-slate-900/60 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Activity className="w-4 h-4 text-amber-400" />
            <span>📊 Market Health</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {activeTab === 'overview' && <MarketOverviewTab simData={simData} />}
          {activeTab === 'agents' && <AgentPerformanceTab simData={simData} />}
          {activeTab === 'news' && <NewsSentimentTab simData={simData} />}
          {activeTab === 'health' && <MarketHealthTab simData={simData} />}
        </div>

        {/* Footer info matching dashboard.py caption */}
        <footer className="mt-8 pt-4 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex flex-wrap items-center justify-between gap-2">
          <span>
            Simulation: seed={simData.seed} | end_time={simData.end_time} | Fundamental EKF: {Object.keys(simData.agents).length} | Momentum EKF: {simData.mom_agent_ids?.length || Object.keys(simData.mom_agents || {}).length} | Time unit: {simData.time_unit}
          </span>
          <span className="text-slate-600">ABIDES Market Sim • Migrated to Node.js & React</span>
        </footer>
      </main>

      {/* Guide & Architecture Modal */}
      <ArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />
    </div>
  );
}

export default App;
