export type RecommendationStatus =
  "recommended" | "qualified" | "blocked" | "waiting_lineup_confirmation" | "expired";

export type Sportsbook = "Betano" | "Superbet";

export type RecommendationInput = {
  bankrollCents: number;
  confidence: number;
  dataQuality: number;
  estimatedProbability: number;
  id: string;
  market: string;
  match: string;
  odd: number;
  risk: "Baixo" | "Medio" | "Alto";
  selection: string;
  sportsbook: Sportsbook;
  status: RecommendationStatus;
};

export type Recommendation = RecommendationInput & {
  expectedValue: number;
  fairOdd: number;
  impliedProbability: number;
  score: number;
  stakeCents: number;
};

export function calculateImpliedProbability(odd: number) {
  assertPositiveOdd(odd);
  return 1 / odd;
}

export function calculateFairOdd(probability: number) {
  assertProbability(probability);
  return 1 / probability;
}

export function calculateExpectedValue(probability: number, odd: number) {
  assertProbability(probability);
  assertPositiveOdd(odd);
  return probability * odd - 1;
}

export function calculateCompositeScore(input: {
  dataQuality: number;
  expectedValue: number;
  confidence: number;
}) {
  const evScore = clamp(input.expectedValue * 240, -30, 35);
  const qualityScore = input.dataQuality * 0.24;
  const confidenceScore = input.confidence * 0.58;

  return Math.round(clamp(confidenceScore + qualityScore + evScore, 0, 100));
}

export function calculateStakeCents(input: {
  bankrollCents: number;
  confidence: number;
  expectedValue: number;
  risk: RecommendationInput["risk"];
}) {
  if (input.expectedValue <= 0 || input.confidence < 55) {
    return 0;
  }

  const riskMultiplier = {
    Alto: 0.25,
    Baixo: 0.65,
    Medio: 0.42
  }[input.risk];

  const fraction = clamp(input.expectedValue * riskMultiplier * (input.confidence / 100), 0, 0.025);
  return Math.round(input.bankrollCents * fraction);
}

export function enrichRecommendation(input: RecommendationInput): Recommendation {
  const impliedProbability = calculateImpliedProbability(input.odd);
  const fairOdd = calculateFairOdd(input.estimatedProbability);
  const expectedValue = calculateExpectedValue(input.estimatedProbability, input.odd);
  const score = calculateCompositeScore({
    confidence: input.confidence,
    dataQuality: input.dataQuality,
    expectedValue
  });
  const stakeCents = calculateStakeCents({
    bankrollCents: input.bankrollCents,
    confidence: input.confidence,
    expectedValue,
    risk: input.risk
  });

  return {
    ...input,
    expectedValue,
    fairOdd,
    impliedProbability,
    score,
    stakeCents
  };
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent"
  }).format(value);
}

export function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(value / 100);
}

export function formatOdd(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function assertPositiveOdd(odd: number) {
  if (!Number.isFinite(odd) || odd <= 1) {
    throw new Error("Odd decimal precisa ser maior que 1.");
  }
}

function assertProbability(probability: number) {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    throw new Error("Probabilidade precisa estar no intervalo 0-1.");
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
