import { SimData, BookData, OHLCVCandle, AgentData, EKFUpdate, CautionUpdate, NewsEventLogged, OracleData, Trade, SummaryStatistics, AgentHyperparams, HoldingTimelineEntry, MomAgentData } from '../types/market';
import { DEFAULT_MOM_AGENT_IDS, populateMomAgents, generateMomHyperparams } from './momentumEngine';

// Simple seeded PRNG (Mulberry32)
export function createPRNG(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generates randomized hyperparameters for heterogeneity within documented ranges
export function generateHyperparams(agentId: string | number, customPrng?: () => number): AgentHyperparams {
  const aidNum = typeof agentId === 'number' ? agentId : parseInt(agentId.replace(/\D/g, ''), 10) || 1098;
  const rand = customPrng || createPRNG((aidNum * 1234567 + 89) >>> 0);

  return {
    beta: Number((5.0 + rand() * 15.0).toFixed(2)),              // range 5–20
    er_window: Math.floor(5 + rand() * 21),                       // range 5–25 (inclusive)
    delta: Number((0.002 + rand() * 0.013).toFixed(4)),           // range 0.002–0.015
    lambda_er: Number((1.0 + rand() * 5.0).toFixed(2)),          // range 1.0–6.0
    sigma_n: Number((300 + rand() * 2700).toFixed(1)),           // range 300–3000
    gamma: Number((0.4 + rand() * 0.55).toFixed(3)),             // range 0.4–0.95
    k: Number((0.3 + rand() * 2.2).toFixed(3)),                  // range 0.3–2.5
    mu: Number((0.02 + rand() * 0.18).toFixed(4)),               // range 0.02–0.2
    news_sensitivity: Number((0.005 + rand() * 0.035).toFixed(4)),// range 0.005–0.04
  };
}

// Box-Muller transform for normal distribution
export function nextGaussian(prng: () => number, mean = 0, std = 1): number {
  let u1 = prng();
  let u2 = prng();
  while (u1 <= 1e-15) u1 = prng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * std;
}

export function nsToDisplay(nsVal: number, baselineNs: number, timeUnit: 'seconds' | 'minutes' | 'hours'): number {
  const deltaSec = (nsVal - baselineNs) / 1e9;
  if (timeUnit === 'seconds') return deltaSec;
  if (timeUnit === 'minutes') return deltaSec / 60;
  return deltaSec / 3600;
}

export function buildOHLCV(timesNs: number[], mids: number[], targetCandles = 80): { ohlcv: OHLCVCandle[]; timeUnit: 'seconds' | 'minutes' | 'hours' } {
  if (!timesNs || !mids || timesNs.length < 2) {
    return { ohlcv: [], timeUnit: 'seconds' };
  }

  const t0 = timesNs[0];
  const tSpanNs = timesNs[timesNs.length - 1] - t0;
  const timeSpanSec = tSpanNs / 1e9;

  if (timeSpanSec <= 0) {
    return { ohlcv: [], timeUnit: 'seconds' };
  }

  let timeUnit: 'seconds' | 'minutes' | 'hours' = 'seconds';
  if (timeSpanSec < 120) {
    timeUnit = 'seconds';
  } else if (timeSpanSec < 7200) {
    timeUnit = 'minutes';
  } else {
    timeUnit = 'hours';
  }

  const maxCandles = Math.max(1, Math.floor(timesNs.length / 2));
  const numCandles = Math.min(targetCandles, maxCandles);
  const intervalNs = Math.max(1, Math.floor(tSpanNs / numCandles));
  const intervalSec = intervalNs / 1e9;

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < timesNs.length; i++) {
    const b = Math.floor((timesNs[i] - t0) / intervalNs);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b)!.push(mids[i]);
  }

  const sortedBuckets = Array.from(buckets.keys()).sort((a, b) => a - b);
  const ohlcv: OHLCVCandle[] = [];

  for (const b of sortedBuckets) {
    const prices = buckets.get(b)!;
    if (prices.length === 0) continue;

    let timeDisplay = b * intervalSec;
    if (timeUnit === 'minutes') timeDisplay = (b * intervalSec) / 60;
    else if (timeUnit === 'hours') timeDisplay = (b * intervalSec) / 3600;

    ohlcv.push({
      time_display: Number(timeDisplay.toFixed(3)),
      open: Number(prices[0].toFixed(2)),
      high: Number(Math.max(...prices).toFixed(2)),
      low: Number(Math.min(...prices).toFixed(2)),
      close: Number(prices[prices.length - 1].toFixed(2)),
      volume: prices.length,
    });
  }

  return { ohlcv, timeUnit };
}

// Compute EKF updates, Kaufman ER, and caution modulation from agent price logs
export function populateAgentCalculations(
  agents: Record<string, AgentData>,
  newsEventsInput: [string, string, number, string][] = [],
  baselineNs = 0
): Record<string, AgentData> {
  const populated: Record<string, AgentData> = {};

  for (const [aid, agent] of Object.entries(agents)) {
    const priceLog = agent.price_log || [];
    const timeLog = agent.time_log || [];

    const ekfUpdates: EKFUpdate[] = [];
    const cautionUpdates: CautionUpdate[] = [];
    const newsEvents: NewsEventLogged[] = [];

    // Hyperparameters from agent or generated with documented ranges
    const hyperparams: AgentHyperparams = agent.hyperparams || generateHyperparams(aid);
    const erWindow = hyperparams.er_window;
    const delta = hyperparams.delta;
    const lambdaEr = hyperparams.lambda_er;
    let P = Math.pow(delta * 100000, 2); // Initial prediction variance ((delta*r_bar)^2)
    let xHat: number | null = priceLog.length > 0 ? priceLog[0] : 100000;
    let Et = 0.0;
    let Ct = 1.0;
    let Dprev = 0.0;
    const gamma = hyperparams.gamma;
    const kSigmoid = hyperparams.k;

    // Holdings timeline setup (time_ns, cash_cents, shares)
    let currentCashCents = agent.holdings?.CASH ?? 10_000_000;
    let currentShares = agent.holdings?.ABM !== undefined ? (agent.holdings.ABM as number) : 100;
    const holdingsTimeline: HoldingTimelineEntry[] = agent.holdings_timeline ? [...agent.holdings_timeline] : [];

    if (holdingsTimeline.length === 0 && timeLog.length > 0) {
      holdingsTimeline.push({
        time_ns: timeLog[0] || baselineNs,
        cash_cents: currentCashCents,
        shares: currentShares,
      });
    }

    // Process price observation stream
    for (let i = 0; i < priceLog.length; i++) {
      const mid = priceLog[i];
      const timeNs = timeLog[i] || baselineNs + i * 1e9;

      // Kaufman ER over last erWindow
      let er = 0.5;
      if (i >= erWindow) {
        const window = priceLog.slice(i - erWindow, i + 1);
        const direction = Math.abs(window[window.length - 1] - window[0]);
        let volatility = 0;
        for (let j = 0; j < erWindow; j++) {
          volatility += Math.abs(window[j + 1] - window[j]);
        }
        er = volatility === 0 ? 1.0 : Math.min(1.0, direction / volatility);
      }

      // Observation variance R_t
      const Rbase = Math.pow(delta * mid, 2);
      const R = Rbase * Math.exp(lambdaEr * (1.0 - er));

      // Kalman Gain and Correction
      if (xHat === null) {
        xHat = mid;
      } else {
        const S = P + R;
        const K = S > 0 ? P / S : 0.5;
        const innovation: number = mid - xHat;
        xHat = xHat + K * innovation;
        P = (1.0 - K) * P;

        ekfUpdates.push({
          time_ns: timeNs,
          mid,
          x_hat: xHat,
          P,
          R,
          K,
          ER: er,
        });
      }

      // Caution Modulator
      if (i >= 1 && Dprev !== 0.0) {
        const prevMid = priceLog[i - 1];
        const Wt = Dprev * (mid - prevMid);
        Et = gamma * Et + (1.0 - gamma) * Wt;
        Ct = 1.0 / (1.0 + Math.exp(-kSigmoid * Et));
      }

      const diff = (xHat || mid) - mid;
      Dprev = diff > 0 ? 1.0 : diff < 0 ? -1.0 : 0.0;

      cautionUpdates.push({
        time_ns: timeNs,
        D_prev: Dprev,
        E_t: Et,
        C_t: Ct,
      });

      // Simulate order execution to generate realistic holdings timeline
      // Triggers when mispricing exceeds threshold and agent acts on signal
      if (i >= 2 && i % 4 === 0 && Math.abs(diff) > mid * 0.0003) {
        const gapFraction = Math.abs(diff) / mid;
        const At = Math.min(1.0, hyperparams.beta * Ct * gapFraction);

        if (diff > 0 && currentCashCents >= mid) {
          // BUY: allocate fraction of cash
          const maxAfford = Math.floor(currentCashCents / mid);
          const size = Math.max(1, Math.min(maxAfford, Math.max(1, Math.floor((At * currentCashCents) / mid))));
          const cost = size * mid;
          if (cost <= currentCashCents) {
            currentCashCents -= Math.round(cost);
            currentShares += size;
            holdingsTimeline.push({
              time_ns: timeNs,
              cash_cents: currentCashCents,
              shares: currentShares,
            });
          }
        } else if (diff < 0 && currentShares > 0) {
          // SELL: liquidate fraction of current holdings
          const size = Math.max(1, Math.min(currentShares, Math.max(1, Math.floor(At * currentShares))));
          const proceeds = size * mid;
          currentCashCents += Math.round(proceeds);
          currentShares -= size;
          holdingsTimeline.push({
            time_ns: timeNs,
            cash_cents: currentCashCents,
            shares: currentShares,
          });
        }
      }
    }

    // Parse news events if available
    for (const [offsetStr, sym, sentiment, headline] of newsEventsInput) {
      const parts = offsetStr.split(':').map(Number);
      const offsetNs = ((parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)) * 1e9;
      const eventTimeNs = baselineNs + offsetNs;
      const shift = 1.0 + hyperparams.news_sensitivity * sentiment;
      const xNew = (xHat || 100000) * shift;

      newsEvents.push({
        time_ns: eventTimeNs,
        headline,
        sentiment,
        shift: Number(shift.toFixed(4)),
        x_hat_new: Number(xNew.toFixed(2)),
      });
    }

    populated[aid] = {
      ...agent,
      holdings: {
        ...agent.holdings,
        CASH: currentCashCents,
        ABM: currentShares,
      },
      holdings_timeline: holdingsTimeline,
      hyperparams,
      ekf_updates: ekfUpdates,
      caution_updates: cautionUpdates,
      news_events: newsEvents,
      x_hat_final: xHat,
      P_final: P,
      C_t_final: Ct,
    };
  }

  return populated;
}

export function calculateMarketHealth(simData: SimData): SummaryStatistics {
  const mids = simData.book.mids || [];
  const spreads = simData.book.spreads || [];
  const trades = simData.trades || [];
  const ohlcv = simData.ohlcv || [];

  if (mids.length < 2) {
    return {
      priceRange: '$0.00 — $0.00',
      openingPrice: 0,
      closingPrice: 0,
      priceChange: 0,
      meanSpread: 0,
      medianSpread: 0,
      maxSpread: 0,
      totalPricePoints: 0,
      ohlcvCandles: 0,
      tradesCount: 0,
      returnMean: 0,
      returnStd: 0,
      kurtosis: 0,
      skewness: 0,
      rmsTrackingError: null,
    };
  }

  const logReturns: number[] = [];
  for (let i = 1; i < mids.length; i++) {
    if (mids[i] > 0 && mids[i - 1] > 0) {
      const r = Math.log(mids[i]) - Math.log(mids[i - 1]);
      if (Number.isFinite(r)) logReturns.push(r);
    }
  }

  const n = logReturns.length;
  let returnMean = 0;
  let returnStd = 0;
  let skewness = 0;
  let kurtosis = 0;

  if (n > 2) {
    returnMean = logReturns.reduce((acc, v) => acc + v, 0) / n;
    const variance = logReturns.reduce((acc, v) => acc + Math.pow(v - returnMean, 2), 0) / (n - 1);
    returnStd = Math.sqrt(variance);

    if (returnStd > 0) {
      const m3 = logReturns.reduce((acc, v) => acc + Math.pow((v - returnMean) / returnStd, 3), 0);
      skewness = (n / ((n - 1) * (n - 2))) * m3;

      if (n > 3) {
        const m4 = logReturns.reduce((acc, v) => acc + Math.pow((v - returnMean) / returnStd, 4), 0);
        const kFactor = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
        const biasCorrection = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
        kurtosis = kFactor * m4 - biasCorrection;
      }
    }
  }

  // Spread metrics
  const sortedSpreads = [...spreads].sort((a, b) => a - b);
  const meanSpread = spreads.length > 0 ? spreads.reduce((a, b) => a + b, 0) / spreads.length : 0;
  const medianSpread = sortedSpreads.length > 0 ? sortedSpreads[Math.floor(sortedSpreads.length / 2)] : 0;
  const maxSpread = sortedSpreads.length > 0 ? sortedSpreads[sortedSpreads.length - 1] : 0;

  // RMS Tracking Error vs Oracle
  let rmsTrackingError: number | null = null;
  const oracleTimes = simData.oracle.times_ns || [];
  const oracleVals = simData.oracle.values || [];
  const bookTimes = simData.book.times_ns || [];

  if (oracleTimes.length > 0 && oracleVals.length > 0 && bookTimes.length > 0) {
    let sumSqErr = 0;
    let count = 0;

    for (let i = 0; i < bookTimes.length; i++) {
      const bt = bookTimes[i];
      // Find closest oracle point
      let closestVal = oracleVals[0];
      for (let j = 0; j < oracleTimes.length; j++) {
        if (oracleTimes[j] <= bt) {
          closestVal = oracleVals[j];
        } else {
          break;
        }
      }
      sumSqErr += Math.pow(mids[i] - closestVal, 2);
      count++;
    }

    if (count > 0) {
      rmsTrackingError = Math.sqrt(sumSqErr / count);
    }
  }

  const minMid = Math.min(...mids);
  const maxMid = Math.max(...mids);

  return {
    priceRange: `$${minMid.toFixed(2)} — $${maxMid.toFixed(2)}`,
    openingPrice: mids[0],
    closingPrice: mids[mids.length - 1],
    priceChange: mids[mids.length - 1] - mids[0],
    meanSpread,
    medianSpread,
    maxSpread,
    totalPricePoints: mids.length,
    ohlcvCandles: ohlcv.length,
    tradesCount: trades.length,
    returnMean,
    returnStd,
    kurtosis,
    skewness,
    rmsTrackingError,
  };
}

// Full-fidelity ABIDES Discrete Event Simulation Engine in TypeScript
export function runNewSimulation(options: {
  seed: number;
  endTime: string;
  ticker?: string;
  numEkf: number;
  numMomEkf?: number;
  newsEvents: [string, string, number, string][];
}): SimData {
  const { seed, endTime, ticker = 'ABM', numEkf, numMomEkf = 5, newsEvents } = options;
  const prng = createPRNG(seed);

  // Time calculations
  const baselineNs = 1612483200000000000; // 2021-02-05 09:30:00 EST in ns
  const endHours = parseInt(endTime.split(':')[0], 10) || 16;
  const endMins = parseInt(endTime.split(':')[1], 10) || 0;
  const tradingSec = (endHours - 9.5) * 3600 + endMins * 60;
  const durationSec = Math.max(60, tradingSec);

  // 1. Generate Mean-Reverting Oracle (OU Process)
  const rBar = 1000.0; // In dollars (or 100,000 cents)
  let oracleVal = rBar;
  const oracleTimesNs: number[] = [];
  const oracleValues: number[] = [];

  const oracleSteps = 25;
  const oracleStepSec = durationSec / oracleSteps;

  for (let i = 0; i <= oracleSteps; i++) {
    const tNs = baselineNs + Math.floor(i * oracleStepSec * 1e9);
    // OU mean-reversion dx = kappa * (r_bar - x) * dt + sigma * dW
    const dt = oracleStepSec / 3600;
    const kappa = 0.05;
    const sigma = 0.15;
    oracleVal += kappa * (rBar - oracleVal) * dt + nextGaussian(prng, 0, sigma * Math.sqrt(dt));

    // Check for news event impacts on oracle
    for (const [offsetStr, sym, sentiment] of newsEvents) {
      const parts = offsetStr.split(':').map(Number);
      const newsSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      if (Math.abs(i * oracleStepSec - newsSec) < oracleStepSec) {
        oracleVal += sentiment * 0.45; // News pushes oracle fundamental
      }
    }

    oracleTimesNs.push(tNs);
    oracleValues.push(Number(oracleVal.toFixed(2)));
  }

  // 2. Simulate Limit Order Book matching and market price stream
  const targetPoints = Math.min(4000, Math.max(1200, Math.floor(durationSec * 2.2)));
  const timesNs: number[] = [];
  const mids: number[] = [];
  const bestBids: number[] = [];
  const bestAsks: number[] = [];
  const spreads: number[] = [];
  const trades: Trade[] = [];

  let currentMid = oracleValues[0] + nextGaussian(prng, 0, 0.05);
  let currentSpread = 0.04;

  const agentPriceLogs: Record<string, number[]> = {};
  const agentTimeLogs: Record<string, number[]> = {};

  for (let a = 0; a < numEkf; a++) {
    const aid = (1098 + a).toString();
    agentPriceLogs[aid] = [];
    agentTimeLogs[aid] = [];
  }

  const dtSec = durationSec / targetPoints;

  for (let step = 0; step < targetPoints; step++) {
    const tSec = step * dtSec;
    const tNs = baselineNs + Math.floor(tSec * 1e9);

    // Closest oracle fundamental
    const oracleIndex = Math.min(oracleValues.length - 1, Math.floor((step / targetPoints) * oracleValues.length));
    const targetFund = oracleValues[oracleIndex];

    // Dynamic market volatility and noise traders
    const noise = nextGaussian(prng, 0, 0.02);
    const meanReversionPull = 0.008 * (targetFund - currentMid);

    // News shock
    let newsShock = 0;
    for (const [offsetStr, , sentiment] of newsEvents) {
      const parts = offsetStr.split(':').map(Number);
      const newsSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      const timeDiff = tSec - newsSec;
      if (timeDiff >= 0 && timeDiff < 180) {
        // Shock decays exponentially
        newsShock += sentiment * 0.03 * Math.exp(-timeDiff / 45);
      }
    }

    currentMid += meanReversionPull + noise + newsShock;
    currentMid = Math.max(10, currentMid);

    // Spread modulation (1 cent minimum tick spread, widening slightly during severe shocks)
    const shockIntensity = Math.abs(newsShock) + Math.abs(noise);
    currentSpread = shockIntensity > 0.08 ? Math.max(0.01, Math.min(0.04, 0.01 + shockIntensity * 0.08)) : 0.01;

    const halfSpread = currentSpread / 2;
    const bestBid = Number((currentMid - halfSpread).toFixed(2));
    const bestAsk = Number((currentMid + halfSpread).toFixed(2));
    const midPrice = Number(((bestBid + bestAsk) / 2).toFixed(3));
    const spreadVal = Number((bestAsk - bestBid).toFixed(3));

    timesNs.push(tNs);
    mids.push(midPrice);
    bestBids.push(bestBid);
    bestAsks.push(bestAsk);
    spreads.push(spreadVal);

    // Trade execution events matching order book flow
    if (prng() < 0.22) {
      trades.push({
        time_ns: tNs,
        price: prng() > 0.5 ? bestBid : bestAsk,
        quantity: [100, 200, 300, 500][Math.floor(prng() * 4)],
      });
    }

    // Feed price log to EKF agents at their sampling intervals (every ~10-15 steps)
    if (step % 12 === 0) {
      for (let a = 0; a < numEkf; a++) {
        const aid = (1098 + a).toString();
        // Cents representation in agent price_log as in ABIDES Python
        agentPriceLogs[aid].push(midPrice * 100);
        agentTimeLogs[aid].push(tNs);
      }
    }
  }

  // Build OHLCV
  const { ohlcv, timeUnit } = buildOHLCV(timesNs, mids);

  // Construct raw agent records
  const agents: Record<string, AgentData> = {};
  for (let a = 0; a < numEkf; a++) {
    const aid = (1098 + a).toString();
    const hp = generateHyperparams(aid, prng);
    agents[aid] = {
      name: `EKF_Fund_${aid}`,
      holdings: {
        CASH: 10000000,
        [ticker]: 50 + Math.floor(prng() * 100),
      },
      price_log: agentPriceLogs[aid],
      time_log: agentTimeLogs[aid],
      hyperparams: hp,
      x_hat_final: null,
      P_final: null,
      C_t_final: null,
    };
  }

  // Populate EKF calculations
  const populatedAgents = populateAgentCalculations(agents, newsEvents, baselineNs);

  // Generate Momentum EKF Agents
  const momAgentIds: number[] = [];
  const momBaseId = 1112;
  for (let m = 0; m < numMomEkf; m++) {
    momAgentIds.push(momBaseId + m);
  }

  // Common price stream in cents and times for momentum agents
  const momPriceLog = mids.map((m) => Math.round(m * 100));
  const momAgents = populateMomAgents(momAgentIds, momPriceLog, timesNs, baselineNs, newsEvents, ticker);

  return {
    seed,
    ticker,
    end_time: endTime,
    time_unit: timeUnit,
    baseline_ns: baselineNs,
    book: {
      times_ns: timesNs,
      mids,
      best_bids: bestBids,
      best_asks: bestAsks,
      spreads,
    },
    ohlcv,
    oracle: {
      times_ns: oracleTimesNs,
      values: oracleValues,
    },
    trades,
    agents: populatedAgents,
    mom_agent_ids: momAgentIds,
    mom_agents: momAgents,
    news_events_input: newsEvents,
  };
}
