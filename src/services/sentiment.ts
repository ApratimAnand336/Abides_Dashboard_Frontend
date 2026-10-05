export interface SentimentResult {
  positive: number;
  negative: number;
  neutral: number;
  sentiment: number; // Compound between -1.0 and 1.0
  label: 'positive' | 'negative' | 'neutral';
}

export const PREDEFINED_NEWS: [string, number][] = [
  ["Company announces record quarterly earnings", 0.90],
  ["CEO unexpectedly resigns amid internal disputes", -0.85],
  ["FDA approves company's flagship drug", 0.92],
  ["Company faces major data breach affecting millions", -0.88],
  ["Strategic merger announced with industry leader", 0.75],
  ["Revenue misses analyst expectations by 15%", -0.78],
  ["Company wins $2B government contract", 0.82],
  ["Product recall issued due to safety concerns", -0.70],
  ["Analysts upgrade stock to strong buy", 0.65],
  ["Regulatory investigation launched into company practices", -0.72],
];

// Lexicon for domain financial sentiment (FinBERT financial lexicon emulation)
const POSITIVE_FINANCIAL_WORDS: Record<string, number> = {
  record: 0.85,
  earnings: 0.3,
  growth: 0.7,
  profit: 0.8,
  profitable: 0.85,
  soars: 0.9,
  surges: 0.88,
  beats: 0.75,
  exceeds: 0.75,
  approves: 0.8,
  approval: 0.8,
  breakthrough: 0.9,
  contract: 0.6,
  upgrade: 0.7,
  upgrades: 0.7,
  buy: 0.65,
  dividend: 0.5,
  innovation: 0.65,
  rally: 0.75,
  merger: 0.5,
  expansion: 0.6,
  partnership: 0.55,
  strong: 0.6,
  success: 0.75,
  successful: 0.8,
  rebound: 0.65,
  outperforms: 0.8,
  bullish: 0.85,
  gain: 0.6,
  gains: 0.65,
};

const NEGATIVE_FINANCIAL_WORDS: Record<string, number> = {
  resigns: 0.8,
  resignation: 0.8,
  breach: 0.85,
  plunges: 0.9,
  slumps: 0.85,
  drops: 0.6,
  misses: 0.75,
  missed: 0.75,
  loss: 0.7,
  losses: 0.75,
  investigation: 0.75,
  probe: 0.7,
  fraud: 0.95,
  lawsuit: 0.75,
  sued: 0.75,
  recall: 0.7,
  downgrade: 0.75,
  downgrades: 0.75,
  sell: 0.6,
  bearish: 0.8,
  deficit: 0.7,
  scandal: 0.9,
  dispute: 0.6,
  warning: 0.65,
  debt: 0.5,
  default: 0.9,
  bankruptcy: 0.95,
  cut: 0.5,
  cuts: 0.55,
  crisis: 0.85,
  decline: 0.6,
  declining: 0.65,
};

export function scoreHeadline(headline: string): SentimentResult {
  const clean = headline.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);

  let posScore = 0;
  let negScore = 0;
  let matches = 0;

  for (const word of words) {
    if (POSITIVE_FINANCIAL_WORDS[word]) {
      posScore += POSITIVE_FINANCIAL_WORDS[word];
      matches++;
    }
    if (NEGATIVE_FINANCIAL_WORDS[word]) {
      negScore += NEGATIVE_FINANCIAL_WORDS[word];
      matches++;
    }
  }

  // Predefined exact matches
  for (const [preset, score] of PREDEFINED_NEWS) {
    if (headline.toLowerCase().trim() === preset.toLowerCase().trim()) {
      if (score > 0) {
        return {
          positive: Number((score * 0.9 + 0.05).toFixed(4)),
          negative: Number((0.05).toFixed(4)),
          neutral: Number((1.0 - (score * 0.9 + 0.1)).toFixed(4)),
          sentiment: score,
          label: 'positive',
        };
      } else {
        const absScore = Math.abs(score);
        return {
          positive: Number((0.04).toFixed(4)),
          negative: Number((absScore * 0.9 + 0.05).toFixed(4)),
          neutral: Number((1.0 - (absScore * 0.9 + 0.09)).toFixed(4)),
          sentiment: score,
          label: 'negative',
        };
      }
    }
  }

  if (matches === 0) {
    return {
      positive: 0.12,
      negative: 0.11,
      neutral: 0.77,
      sentiment: 0.0,
      label: 'neutral',
    };
  }

  const rawSentiment = (posScore - negScore) / Math.max(1, posScore + negScore);
  const clamped = Math.max(-1.0, Math.min(1.0, rawSentiment));

  // Compute soft probabilities
  const total = posScore + negScore + 1.2;
  const pPos = Number((posScore / total).toFixed(4));
  const pNeg = Number((negScore / total).toFixed(4));
  const pNeu = Number(Math.max(0, 1 - (pPos + pNeg)).toFixed(4));

  let label: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (clamped > 0.1) label = 'positive';
  else if (clamped < -0.1) label = 'negative';

  return {
    positive: pPos,
    negative: pNeg,
    neutral: pNeu,
    sentiment: Number(clamped.toFixed(4)),
    label,
  };
}
