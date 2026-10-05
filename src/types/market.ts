export interface BookData {
  times_ns: number[];
  mids: number[];
  best_bids: number[];
  best_asks: number[];
  spreads: number[];
}

export interface OHLCVCandle {
  time_display: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EKFUpdate {
  time_ns: number;
  mid: number;
  x_hat: number;
  P: number;
  R: number;
  K: number;
  ER: number;
}

export interface CautionUpdate {
  time_ns: number;
  D_prev: number;
  E_t: number;
  C_t: number;
}

export interface NewsEventLogged {
  time_ns: number;
  headline: string;
  sentiment: number;
  shift: number;
  x_hat_new: number;
}

export interface HoldingTimelineEntry {
  time_ns: number;
  cash_cents: number;
  shares: number;
}

export interface AgentHyperparams {
  beta: number;             // aggression/volume multiplier (range 5–20)
  er_window: number;        // Kaufman ER memory length (range 5–25)
  delta: number;            // noise sensitivity (range 0.002–0.015)
  lambda_er: number;        // trust in market trends (range 1.0–6.0)
  sigma_n: number;          // oracle noise / private info quality (range 300–3000)
  gamma: number;            // emotional memory retention (range 0.4–0.95)
  k: number;                // sigmoid sensitivity for confidence (range 0.3–2.5)
  mu: number;               // limit price safety margin (range 0.02–0.2)
  news_sensitivity: number; // reaction strength to FinBERT sentiment (range 0.005–0.04)
}

export interface AgentData {
  name: string;
  holdings: {
    CASH?: number;
    [symbol: string]: number | undefined;
  };
  price_log: number[];
  time_log: number[];
  x_hat_final: number | null;
  P_final: number | null;
  C_t_final: number | null;
  ekf_updates?: EKFUpdate[];
  caution_updates?: CautionUpdate[];
  news_events?: NewsEventLogged[];
  holdings_timeline?: HoldingTimelineEntry[];
  hyperparams?: AgentHyperparams;
}

export interface OracleData {
  times_ns: number[];
  values: number[];
}

export interface Trade {
  time_ns?: number;
  price: number;
  quantity: number;
}

export interface QueuedNewsItem {
  id: string;
  timeOffset: string; // "00:05:00"
  symbol: string;     // "ABM"
  sentiment: number;  // -1.0 to 1.0
  headline: string;
}

// ── Momentum EKF Agent Types ──────────────────────────────────────
export interface MomHyperparams {
  initial_exposure: number; // 0.5
  N_w: number;              // 15–30
  n_er: number;             // 10–25
  lambda_er: number;        // 1–6
  kappa_R: number;          // 0.5–2
  c_P: number;              // 1–5
  tau: number;              // 120–1800 s
  kappa_l: number;          // 0.05–0.5
  kappa_v: number;          // 0.5–2
  a_eps: number;            // 0.1–0.3
  eps_thr: number;          // 2–4
  g_max: number;            // 10
  gamma: number;            // 0.4–0.95
  k_c: number;              // 0.3–2.5
  theta_in: number;         // 1.5–2.5
  theta_out: number;        // 0.5–1.0
  ER_min: number;           // 0.2–0.4
  k_stop: number;           // 2–4
  k_re: number;             // 0.25–0.5
  T_0: number;              // 1–3
  lambda_v: number;         // 0.5–2
  e_max: number;            // 0.7–0.95
  e_min: number;            // 0
  b: number;                // 0.1
  n_min: number;            // 1
  k_add: number;            // 0.25–0.75
  mu_m: number;             // 0.5–2
  eta_news: number;         // 0–0.5
  rho_news: number;         // 1–5
  wake_mean: number;        // 10–60 s
}

export interface MomWarmup {
  time_ns: number;
  l0: number;
  v0: number;
  P0: number[][];
  s2_res: number;
  sigma_ref2: number;
  R_base: number;
  sigma_l2: number;
  sigma_vinf: number;
}

export interface MomFinal {
  state: 'NEUTRAL' | 'BULL' | 'BEAR' | 'WATCH';
  l_hat: number;
  v_hat: number;
  P: number[][];
  holdings: {
    CASH?: number;
    [symbol: string]: number | undefined;
  };
}

export interface MomKFUpdate {
  time_ns: number;
  mid: number;
  l_hat: number;
  v_hat: number;
  P00: number;
  P01: number;
  P11: number;
  R: number;
  S: number;
  K0: number;
  K1: number;
  ER: number;
  eps: number;
  epsbar: number;
  g_Q: number;
  T: number;
}

export interface MomCautionUpdate {
  time_ns: number;
  D_prev: number;
  E_t: number;
  C_t: number;
}

export interface MomStateChange {
  time_ns: number;
  time_s?: number;
  from: 'NEUTRAL' | 'BULL' | 'BEAR' | 'WATCH';
  to: 'NEUTRAL' | 'BULL' | 'BEAR' | 'WATCH';
  reason: 'BREAKOUT' | 'REENTRY' | 'STOP' | 'FADE' | 'TIMEOUT';
  L: number | null;
  peak_or_trough: number | null;
}

export interface MomDecision {
  time_ns: number;
  state: 'NEUTRAL' | 'BULL' | 'BEAR' | 'WATCH';
  a: number;
  s: number;
  m: number;
  g: number;
  e_star: number;
  e_target: number;
  n_star: number;
  n: number;
  dn: number;
  order_class: 'TREND' | 'STOP' | 'OTHER' | null;
  u: number;
  P_L: number | null;
  skipped_reason: 'dead_band' | 'anti_chase' | 'no_cash' | 'no_shares' | null;
  qty: number | null;
}

export interface MomNewsEvent {
  time_ns: number;
  headline: string;
  sentiment: number;
  v_hat_new: number;
  P11_new: number;
}

export interface MomAgentData {
  name: string;
  hyperparams: MomHyperparams;
  warmup: MomWarmup | null;
  final: MomFinal | null;
  holdings: {
    CASH?: number;
    [symbol: string]: number | undefined;
  };
  starting_cash: number;
  C_t_final: number;
  price_log: number[];
  time_log: number[];
  state_history: MomStateChange[];
  kf_updates: MomKFUpdate[];
  caution_updates: MomCautionUpdate[];
  state_changes: MomStateChange[];
  decisions: MomDecision[];
  news_events: MomNewsEvent[];
  holdings_timeline: HoldingTimelineEntry[];
}

export interface SimData {
  seed: number;
  ticker: string;
  end_time: string;
  time_unit: 'seconds' | 'minutes' | 'hours';
  baseline_ns: number;
  book: BookData;
  ohlcv?: OHLCVCandle[];
  oracle: OracleData;
  trades: Trade[];
  agents: Record<string, AgentData>;
  mom_agent_ids?: number[];
  mom_agents?: Record<string, MomAgentData>;
  news_events_input: [string, string, number, string][];
}

export interface SummaryStatistics {
  priceRange: string;
  openingPrice: number;
  closingPrice: number;
  priceChange: number;
  meanSpread: number;
  medianSpread: number;
  maxSpread: number;
  totalPricePoints: number;
  ohlcvCandles: number;
  tradesCount: number;
  returnMean: number;
  returnStd: number;
  kurtosis: number;
  skewness: number;
  rmsTrackingError: number | null;
}
