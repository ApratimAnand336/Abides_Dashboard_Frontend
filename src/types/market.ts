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
