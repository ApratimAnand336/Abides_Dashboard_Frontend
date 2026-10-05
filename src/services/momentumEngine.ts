import {
  MomHyperparams,
  MomWarmup,
  MomFinal,
  MomKFUpdate,
  MomCautionUpdate,
  MomStateChange,
  MomDecision,
  MomNewsEvent,
  MomAgentData,
  HoldingTimelineEntry,
} from '../types/market';
import { createPRNG, nextGaussian } from './simulator';

export const DEFAULT_MOM_AGENT_IDS = [1112, 1113, 1114, 1115, 1116];

export function generateMomHyperparams(agentId: string | number, customPrng?: () => number): MomHyperparams {
  const aidNum = typeof agentId === 'number' ? agentId : parseInt(agentId.replace(/\D/g, ''), 10) || 1112;
  const rand = customPrng || createPRNG((aidNum * 9876543 + 321) >>> 0);

  return {
    initial_exposure: 0.5,
    N_w: Math.floor(15 + rand() * 16),                     // 15–30
    n_er: Math.floor(10 + rand() * 16),                    // 10–25
    lambda_er: Number((1.0 + rand() * 5.0).toFixed(2)),    // 1–6
    kappa_R: Number((0.5 + rand() * 1.5).toFixed(2)),      // 0.5–2
    c_P: Number((1.0 + rand() * 4.0).toFixed(2)),          // 1–5
    tau: Number((120 + rand() * 1680).toFixed(0)),         // 120–1800 s
    kappa_l: Number((0.05 + rand() * 0.45).toFixed(3)),    // 0.05–0.5
    kappa_v: Number((0.5 + rand() * 1.5).toFixed(2)),      // 0.5–2
    a_eps: Number((0.1 + rand() * 0.2).toFixed(3)),        // 0.1–0.3
    eps_thr: Number((2.0 + rand() * 2.0).toFixed(2)),      // 2–4
    g_max: 10.0,
    gamma: Number((0.4 + rand() * 0.55).toFixed(3)),       // 0.4–0.95
    k_c: Number((0.3 + rand() * 2.2).toFixed(3)),          // 0.3–2.5
    theta_in: Number((1.5 + rand() * 1.0).toFixed(2)),     // 1.5–2.5
    theta_out: Number((0.5 + rand() * 0.5).toFixed(2)),    // 0.5–1.0
    ER_min: Number((0.2 + rand() * 0.2).toFixed(2)),       // 0.2–0.4
    k_stop: Number((2.0 + rand() * 2.0).toFixed(2)),       // 2–4
    k_re: Number((0.25 + rand() * 0.25).toFixed(2)),       // 0.25–0.5
    T_0: Number((1.0 + rand() * 2.0).toFixed(2)),          // 1–3
    lambda_v: Number((0.5 + rand() * 1.5).toFixed(2)),     // 0.5–2
    e_max: Number((0.7 + rand() * 0.25).toFixed(2)),       // 0.7–0.95
    e_min: 0.0,
    b: 0.1,
    n_min: 1,
    k_add: Number((0.25 + rand() * 0.5).toFixed(2)),       // 0.25–0.75
    mu_m: Number((0.5 + rand() * 1.5).toFixed(2)),         // 0.5–2
    eta_news: Number((0.0 + rand() * 0.5).toFixed(3)),     // 0–0.5
    rho_news: Number((1.0 + rand() * 4.0).toFixed(2)),     // 1–5
    wake_mean: Number((10.0 + rand() * 50.0).toFixed(1)),  // 10–60 s
  };
}

// Generate complete Momentum EKF Agent data series for a given agent
export function simulateMomAgent(
  agentId: string | number,
  priceLog: number[], // In cents
  timeLog: number[],  // Nanoseconds
  baselineNs: number,
  newsEventsInput: [string, string, number, string][] = [],
  ticker = 'ABM',
  customHyperparams?: MomHyperparams
): MomAgentData {
  const hp = customHyperparams || generateMomHyperparams(agentId);
  const startingCash = 10_000_000; // $100,000 in cents

  // Initial portfolio allocation: e0 = 0.5
  const initialPriceCents = priceLog.length > 0 ? priceLog[0] : 100000;
  const initialShares = Math.floor((hp.initial_exposure * startingCash) / initialPriceCents);
  let currentCashCents = startingCash - initialShares * initialPriceCents;
  let currentShares = initialShares;

  const kfUpdates: MomKFUpdate[] = [];
  const cautionUpdates: MomCautionUpdate[] = [];
  const stateChanges: MomStateChange[] = [];
  const decisions: MomDecision[] = [];
  const newsEvents: MomNewsEvent[] = [];
  const holdingsTimeline: HoldingTimelineEntry[] = [];

  holdingsTimeline.push({
    time_ns: timeLog[0] || baselineNs,
    cash_cents: currentCashCents,
    shares: currentShares,
  });

  let state: 'NEUTRAL' | 'BULL' | 'BEAR' | 'WATCH' = 'NEUTRAL';
  let peakOrTrough: number = initialPriceCents;
  let pAdd: number = initialPriceCents;
  let eCap: number = hp.initial_exposure;
  let eFloor: number = hp.initial_exposure;

  let Et = 0.0;
  let Ct = 0.5;
  let Dprev = 0.0;
  let epsbar = 1.0;
  let gQ = 1.0;

  // Wait for warmup N_w observations
  let warmupDone = false;
  let warmupData: MomWarmup | null = null;
  let lHat = Math.log(initialPriceCents);
  let vHat = 0.0;
  let P00 = Math.pow(0.005, 2);
  let P01 = 0.0;
  let P11 = Math.pow(0.0001, 2);
  let sigmaRef2 = 1e-6;
  let RBase = 1e-4;
  let sigmaL2 = 1e-6;
  let sigmaVinf = 1e-4;

  const nPoints = Math.min(priceLog.length, timeLog.length);

  for (let i = 0; i < nPoints; i++) {
    const midCents = priceLog[i];
    const timeNs = timeLog[i];
    const timeSec = (timeNs - baselineNs) / 1e9;
    const z = Math.log(midCents);

    // Warm-up phase
    if (!warmupDone) {
      if (i >= hp.N_w) {
        warmupDone = true;
        // Simple OLS over warmup window
        const zWin = priceLog.slice(0, hp.N_w + 1).map((p) => Math.log(p));
        const tWin = timeLog.slice(0, hp.N_w + 1).map((t) => (t - baselineNs) / 1e9);
        const tLast = tWin[tWin.length - 1];

        let sumT = 0, sumZ = 0, sumTZ = 0, sumTT = 0;
        const nwLen = zWin.length;
        for (let j = 0; j < nwLen; j++) {
          const dt = tWin[j] - tLast;
          sumT += dt;
          sumZ += zWin[j];
          sumTZ += dt * zWin[j];
          sumTT += dt * dt;
        }
        const denom = nwLen * sumTT - sumT * sumT || 1e-6;
        const v0 = (nwLen * sumTZ - sumT * sumZ) / denom;
        const l0 = (sumZ - v0 * sumT) / nwLen;

        lHat = l0;
        vHat = v0;
        sigmaRef2 = Math.max(1e-7, (midCents * 0.0001) / 100);
        RBase = hp.kappa_R * 1e-5;
        sigmaL2 = hp.kappa_l * sigmaRef2;
        sigmaVinf = (hp.kappa_v * Math.sqrt(sigmaRef2)) / Math.sqrt(Math.max(1, hp.tau));

        P00 = hp.c_P * 1e-5;
        P11 = hp.c_P * 1e-7;

        warmupData = {
          time_ns: timeNs,
          l0,
          v0,
          P0: [
            [P00, 0],
            [0, P11],
          ],
          s2_res: 1e-5,
          sigma_ref2: sigmaRef2,
          R_base: RBase,
          sigma_l2: sigmaL2,
          sigma_vinf: sigmaVinf,
        };
      } else {
        continue;
      }
    }

    // Gap dt
    const prevTimeNs = i > 0 ? timeLog[i - 1] : timeNs - 1e9;
    const dt = Math.max(0.1, (timeNs - prevTimeNs) / 1e9);

    // Kalman Prediction: Damped-trend
    const phi = Math.exp(-dt / hp.tau);
    const lMinus = lHat + hp.tau * (1.0 - phi) * vHat;
    const vMinus = phi * vHat;

    const F01 = hp.tau * (1.0 - phi);
    const q00 = sigmaL2 * dt;
    const q11 = gQ * Math.pow(sigmaVinf, 2) * (1.0 - phi * phi);

    const pMinus00 = P00 + 2 * F01 * P01 + F01 * F01 * P11 + q00;
    const pMinus01 = phi * (P01 + F01 * P11);
    const pMinus11 = phi * phi * P11 + q11;

    // Kaufman Efficiency Ratio
    let er = 0.5;
    if (i >= hp.n_er) {
      const window = priceLog.slice(i - hp.n_er, i + 1);
      const direction = Math.abs(window[window.length - 1] - window[0]);
      let volatility = 0;
      for (let j = 0; j < hp.n_er; j++) {
        volatility += Math.abs(window[j + 1] - window[j]);
      }
      er = volatility === 0 ? 1.0 : Math.min(1.0, direction / volatility);
    }

    // Observation variance R
    const R = RBase * Math.exp(hp.lambda_er * (1.0 - er));

    // Kalman Correction
    const y = z - lMinus;
    const S = pMinus00 + R;
    const K0 = pMinus00 / S;
    const K1 = pMinus01 / S;

    lHat = lMinus + K0 * y;
    vHat = vMinus + K1 * y;

    P00 = (1.0 - K0) * pMinus00;
    P01 = (1.0 - K0) * pMinus01;
    P11 = pMinus11 - K1 * pMinus01;

    // Innovation score & EWMA
    const eps = (y * y) / S;
    epsbar = (1.0 - hp.a_eps) * epsbar + hp.a_eps * eps;
    gQ = Math.min(hp.g_max, Math.max(1.0, epsbar / hp.eps_thr));

    // Trend strength T = v_hat / sd(v)
    const sdV = Math.sqrt(Math.max(P11, 1e-12));
    const T = vHat / sdV;

    kfUpdates.push({
      time_ns: timeNs,
      mid: midCents,
      l_hat: lHat,
      v_hat: vHat,
      P00,
      P01,
      P11,
      R,
      S,
      K0,
      K1,
      ER: er,
      eps,
      epsbar,
      g_Q: gQ,
      T,
    });

    // Layer 2: Caution Modulator
    if (i >= 1 && Dprev !== 0.0) {
      const prevMid = priceLog[i - 1];
      const Wt = Dprev * (midCents - prevMid);
      Et = hp.gamma * Et + (1.0 - hp.gamma) * Wt;
      Ct = 1.0 / (1.0 + Math.exp(-hp.k_c * (Et / 100)));
    }
    Dprev = vHat > 0 ? 1.0 : vHat < 0 ? -1.0 : 0.0;

    cautionUpdates.push({
      time_ns: timeNs,
      D_prev: Dprev,
      E_t: Et,
      C_t: Ct,
    });

    // Check news event impact on velocity
    for (const [offsetStr, , sentiment, headline] of newsEventsInput) {
      const parts = offsetStr.split(':').map(Number);
      const newsSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      if (Math.abs(timeSec - newsSec) < 1.0) {
        vHat += hp.eta_news * sentiment * sigmaVinf;
        P11 *= 1.0 + hp.rho_news * Math.abs(sentiment);
        newsEvents.push({
          time_ns: timeNs,
          headline,
          sentiment,
          v_hat_new: vHat,
          P11_new: P11,
        });
      }
    }

    // Layer 3: State Machine
    const prevState = state;
    const sigmaTau = Math.sqrt(sigmaRef2 * hp.tau) * midCents;

    if (state === 'NEUTRAL') {
      if (T >= hp.theta_in && er >= hp.ER_min && midCents >= peakOrTrough + hp.k_stop * sigmaTau * 0.5) {
        state = 'BULL';
        peakOrTrough = midCents;
        pAdd = midCents;
        eCap = hp.initial_exposure;
        stateChanges.push({
          time_ns: timeNs,
          time_s: timeSec,
          from: prevState,
          to: 'BULL',
          reason: 'BREAKOUT',
          L: midCents,
          peak_or_trough: peakOrTrough,
        });
      } else if (T <= -hp.theta_in && er >= hp.ER_min && midCents <= peakOrTrough - hp.k_stop * sigmaTau * 0.5) {
        state = 'BEAR';
        peakOrTrough = midCents;
        pAdd = midCents;
        eFloor = hp.initial_exposure;
        stateChanges.push({
          time_ns: timeNs,
          time_s: timeSec,
          from: prevState,
          to: 'BEAR',
          reason: 'BREAKOUT',
          L: midCents,
          peak_or_trough: peakOrTrough,
        });
      }
    } else if (state === 'BULL') {
      if (midCents > peakOrTrough) {
        peakOrTrough = midCents;
      }
      // Trailing stop
      if (midCents <= peakOrTrough - hp.k_stop * sigmaTau) {
        state = 'WATCH';
        stateChanges.push({
          time_ns: timeNs,
          time_s: timeSec,
          from: 'BULL',
          to: 'WATCH',
          reason: 'STOP',
          L: midCents,
          peak_or_trough: peakOrTrough,
        });
      } else if (T < hp.theta_out) {
        state = 'NEUTRAL';
        stateChanges.push({
          time_ns: timeNs,
          time_s: timeSec,
          from: 'BULL',
          to: 'NEUTRAL',
          reason: 'FADE',
          L: midCents,
          peak_or_trough: peakOrTrough,
        });
      }
    } else if (state === 'BEAR') {
      if (midCents < peakOrTrough) {
        peakOrTrough = midCents;
      }
      // Trailing stop
      if (midCents >= peakOrTrough + hp.k_stop * sigmaTau) {
        state = 'WATCH';
        stateChanges.push({
          time_ns: timeNs,
          time_s: timeSec,
          from: 'BEAR',
          to: 'WATCH',
          reason: 'STOP',
          L: midCents,
          peak_or_trough: peakOrTrough,
        });
      } else if (T > -hp.theta_out) {
        state = 'NEUTRAL';
        stateChanges.push({
          time_ns: timeNs,
          time_s: timeSec,
          from: 'BEAR',
          to: 'NEUTRAL',
          reason: 'FADE',
          L: midCents,
          peak_or_trough: peakOrTrough,
        });
      }
    } else if (state === 'WATCH') {
      // Re-entry or Timeout
      if (T >= hp.theta_in && er >= hp.ER_min) {
        state = 'BULL';
        peakOrTrough = midCents;
        pAdd = midCents;
        stateChanges.push({
          time_ns: timeNs,
          time_s: timeSec,
          from: 'WATCH',
          to: 'BULL',
          reason: 'REENTRY',
          L: midCents,
          peak_or_trough: peakOrTrough,
        });
      } else if (T <= -hp.theta_in && er >= hp.ER_min) {
        state = 'BEAR';
        peakOrTrough = midCents;
        pAdd = midCents;
        stateChanges.push({
          time_ns: timeNs,
          time_s: timeSec,
          from: 'WATCH',
          to: 'BEAR',
          reason: 'REENTRY',
          L: midCents,
          peak_or_trough: peakOrTrough,
        });
      } else if (Math.abs(T) < hp.theta_out) {
        state = 'NEUTRAL';
        stateChanges.push({
          time_ns: timeNs,
          time_s: timeSec,
          from: 'WATCH',
          to: 'NEUTRAL',
          reason: 'TIMEOUT',
          L: midCents,
          peak_or_trough: peakOrTrough,
        });
      }
    }

    // Layer 4: Conviction, Sizing, and Limit Price
    const s = Math.tanh(Math.abs(T) / hp.T_0);
    const m = Math.exp(-hp.lambda_v * (1.0 - er));
    const g = 1.0;
    const a = Ct * s * m * g;

    let eStar = hp.initial_exposure;
    if (state === 'BULL' && vHat > 0) {
      eStar = hp.initial_exposure + a * (hp.e_max - hp.initial_exposure);
    } else if (state === 'BEAR' && vHat < 0) {
      eStar = hp.initial_exposure - a * (hp.initial_exposure - hp.e_min);
    }

    // Ratchet rule
    let eTarget = eStar;
    if (state === 'BULL') {
      if (midCents >= pAdd + hp.k_add * sigmaTau) {
        eCap = Math.max(eCap, eStar);
        pAdd = midCents;
      }
      eTarget = Math.min(eStar, eCap);
    } else if (state === 'BEAR') {
      if (midCents <= pAdd - hp.k_add * sigmaTau) {
        eFloor = Math.min(eFloor, eStar);
        pAdd = midCents;
      }
      eTarget = Math.max(eStar, eFloor);
    }

    // Target shares and dead-band
    const totalWealth = currentCashCents + currentShares * midCents;
    const nStar = Math.floor((eTarget * totalWealth) / midCents);
    const dn = nStar - currentShares;
    const isDeadband = Math.abs(dn) < Math.max(hp.n_min, hp.b * nStar);

    let skippedReason: 'dead_band' | 'anti_chase' | 'no_cash' | 'no_shares' | null = null;
    let qty: number | null = null;
    let orderClass: 'TREND' | 'STOP' | 'OTHER' | null = null;

    if (state === 'WATCH') {
      orderClass = 'STOP';
    } else if (state === 'BULL' || state === 'BEAR') {
      orderClass = 'TREND';
    }

    // Execute order if wake cycle matches Poisson frequency (~every 6-8 updates)
    if (i % 7 === 0 && !isDeadband && Math.abs(dn) > 0) {
      if (dn > 0) {
        // BUY
        const cost = dn * midCents;
        if (cost <= currentCashCents) {
          qty = dn;
          currentCashCents -= cost;
          currentShares += dn;
          holdingsTimeline.push({
            time_ns: timeNs,
            cash_cents: currentCashCents,
            shares: currentShares,
          });
        } else {
          skippedReason = 'no_cash';
        }
      } else if (dn < 0) {
        // SELL
        const sellQty = Math.min(currentShares, Math.abs(dn));
        if (sellQty > 0) {
          qty = sellQty;
          currentCashCents += sellQty * midCents;
          currentShares -= sellQty;
          holdingsTimeline.push({
            time_ns: timeNs,
            cash_cents: currentCashCents,
            shares: currentShares,
          });
        } else {
          skippedReason = 'no_shares';
        }
      }
    } else if (isDeadband) {
      skippedReason = 'dead_band';
    }

    decisions.push({
      time_ns: timeNs,
      state,
      a,
      s,
      m,
      g,
      e_star: eStar,
      e_target: eTarget,
      n_star: nStar,
      n: currentShares,
      dn,
      order_class: orderClass,
      u: 1.0,
      P_L: midCents,
      skipped_reason: skippedReason,
      qty,
    });
  }

  const finalHoldings = {
    CASH: currentCashCents,
    [ticker]: currentShares,
  };

  const finalState: MomFinal = {
    state,
    l_hat: lHat,
    v_hat: vHat,
    P: [
      [P00, P01],
      [P01, P11],
    ],
    holdings: finalHoldings,
  };

  return {
    name: `EKF_Mom_${agentId}`,
    hyperparams: hp,
    warmup: warmupData,
    final: finalState,
    holdings: finalHoldings,
    starting_cash: startingCash,
    C_t_final: Ct,
    price_log: priceLog,
    time_log: timeLog,
    state_history: stateChanges,
    kf_updates: kfUpdates,
    caution_updates: cautionUpdates,
    state_changes: stateChanges,
    decisions,
    news_events: newsEvents,
    holdings_timeline: holdingsTimeline,
  };
}

// Generate population of Momentum EKF Agents
export function populateMomAgents(
  agentIds: number[] = DEFAULT_MOM_AGENT_IDS,
  priceLog: number[],
  timeLog: number[],
  baselineNs: number,
  newsEventsInput: [string, string, number, string][] = [],
  ticker = 'ABM'
): Record<string, MomAgentData> {
  const result: Record<string, MomAgentData> = {};
  for (const aid of agentIds) {
    result[aid.toString()] = simulateMomAgent(
      aid,
      priceLog,
      timeLog,
      baselineNs,
      newsEventsInput,
      ticker
    );
  }
  return result;
}
