import React from 'react';
import { X, Layers, Cpu, Shield, ArrowRight, BookOpen, Terminal } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 flex flex-col gap-6 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">ABIDES Architecture & Model Guide</h2>
              <p className="text-xs text-slate-400">Agent-Based Interactive Discrete Event Simulation System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Layer Simulator Stack */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">System Architecture Stack</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
                <Terminal className="w-4 h-4" />
                <span>Layer 1: abides-core</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Domain-agnostic discrete-event kernel. Maintains a chronological heapq priority queue, simulates
                nanosecond network latencies between agents, and routes all inter-agent messages.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs">
                <Layers className="w-4 h-4" />
                <span>Layer 2: abides-markets</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Financial market domain: NASDAQ-like Exchange Agent with FIFO matching Limit Order Book (LOB),
                Mean-Reverting Oracle (OU process), Noise Traders, Value Traders, and Adaptive Market Makers.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                <BookOpen className="w-4 h-4" />
                <span>Layer 3: abides-gym</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                OpenAI Gym environments wrapping the ABIDES kernel for reinforcement learning. Enables algorithmic
                order execution and daily investor agents to train inside high-fidelity market dynamics.
              </p>
            </div>
          </div>
        </div>

        {/* EKF Fundamentalist Agent Breakdown */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
            EKF Fundamentalist Agent Decision Loop
          </h3>
          <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 flex flex-col gap-4 text-xs font-mono">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                1
              </div>
              <div>
                <span className="text-slate-200 font-bold block">Layer 1: Extended Kalman Filter Core</span>
                <span className="text-slate-400 text-[11px]">
                  Observes market mid-price P_t. Computes Kaufman Efficiency Ratio ER = |ΔP| / Σ|ΔP_i|.
                  Scales observation variance R_t = (δ P_t)² · exp(λ(1 - ER)). Corrects prior estimate
                  x̂_t = x̂_t-1 + K_t (P_t - x̂_t-1).
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                2
              </div>
              <div>
                <span className="text-slate-200 font-bold block">Layer 2: Caution Modulator (Confidence C_t)</span>
                <span className="text-slate-400 text-[11px]">
                  Tracks virtual trade score W_t = D_prev · (P_t - P_prev). Updates emotional memory EWMA
                  E_t = γ E_t-1 + (1 - γ) W_t. Maps into confidence factor C_t = 1 / (1 + exp(-k E_t)) in [0, 1].
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                3
              </div>
              <div>
                <span className="text-slate-200 font-bold block">Layer 3: Wealth-Bounded Allocation & Epistemic Limit Pricing</span>
                <span className="text-slate-400 text-[11px]">
                  Bounds trade volume A_t = min(1, β · C_t · (|x̂ - P| / P)). Clamps urgency price
                  within epistemic safety margin m = μ · sqrt(P_variance) to place compliant limit orders in the book.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                4
              </div>
              <div>
                <span className="text-slate-200 font-bold block">News Sentiment Oracle Integration</span>
                <span className="text-slate-400 text-[11px]">
                  News events arrive asynchronously from NewsOracleAgent. Positive or negative sentiment shifts the agent's
                  perceived intrinsic value anchor x̂ ← x̂ · (1 + sens · S), prompting immediate
                  liquidity reaction.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Momentum EKF Trend Follower Agent Breakdown */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            Momentum EKF Trend Follower Agent Architecture
          </h3>
          <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 flex flex-col gap-4 text-xs font-mono">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                1
              </div>
              <div>
                <span className="text-slate-200 font-bold block">Trend Filter (Kalman Level & Velocity)</span>
                <span className="text-slate-400 text-[11px]">
                  Estimates log-price level l̂ and velocity v̂ with transition matrix F(dt, τ) and process noise Q. Tracks uncertainty covariance P and trend-strength score T = v̂ / sd(v̂). Self-calibrates noise scales during N_w warm-up ticks.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                2
              </div>
              <div>
                <span className="text-slate-200 font-bold block">Caution Modulator & Trend Confidence</span>
                <span className="text-slate-400 text-[11px]">
                  Directional view D = sign(v̂). Tracks virtual returns W_t = D_prev · ΔP to update emotional memory E_t and compute confidence C_t ∈ [0, 1].
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                3
              </div>
              <div>
                <span className="text-slate-200 font-bold block">4-State Machine (NEUTRAL → BULL / BEAR → WATCH)</span>
                <span className="text-slate-400 text-[11px]">
                  Transitions on price breakouts with |T| ≥ θ_in and non-choppy Kaufman ER. Exits via trailing STOP at k_stop · σ_τ or FADE when |T| &lt; θ_out.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                4
              </div>
              <div>
                <span className="text-slate-200 font-bold block">Pyramiding Ratchet & Dead-Band Sizing</span>
                <span className="text-slate-400 text-[11px]">
                  Calculates target exposure e_target between 0 and e_max. Ratchet allows exposure to increase only at new highs (p ≥ p_add + k_add · σ_τ). Places limit orders unless dead-band |Δn| &lt; max(n_min, b · n*) skips the order.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
