/**
 * Glicko-2 rating system (Mark Glickman).
 * @see http://www.glicko.net/glicko/glicko2.pdf
 */

const SCALE = 173.7178;
const DEFAULT_RATING = 1500;
const DEFAULT_RD = 350;
const DEFAULT_VOLATILITY = 0.06;
const TAU = 0.5;
const EPSILON = 0.000001;

function toMu(rating) {
  return (rating - DEFAULT_RATING) / SCALE;
}

function toPhi(rd) {
  return rd / SCALE;
}

function fromMu(mu) {
  return mu * SCALE + DEFAULT_RATING;
}

function fromPhi(phi) {
  return phi * SCALE;
}

function g(phi) {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu, muJ, phiJ) {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function computeNewVolatility(sigma, phi, v, delta) {
  const a = Math.log(sigma * sigma);
  const tau2 = TAU * TAU;
  const phi2 = phi * phi;
  const delta2 = delta * delta;

  const f = (x) => {
    const ex = Math.exp(x);
    const num = ex * (delta2 - phi2 - v - ex);
    const den = 2 * (phi2 + v + ex) * (phi2 + v + ex);
    return num / den - (x - a) / tau2;
  };

  let A = a;
  let B;
  if (delta2 > phi2 + v) {
    B = Math.log(delta2 - phi2 - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) {
      k += 1;
    }
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * @param {{ rating: number, rd: number, volatility: number }} player
 * @param {{ mu: number, phi: number, score: number }[]} opponents
 * @returns {{ rating: number, rd: number, volatility: number }}
 */
function updatePlayer(player, opponents) {
  if (!opponents || opponents.length === 0) {
    return player;
  }

  const mu = toMu(player.rating);
  const phi = toPhi(player.rd);
  const sigma = player.volatility;

  let vInv = 0;
  for (const opp of opponents) {
    const gPhi = g(opp.phi);
    const e = expectedScore(mu, opp.mu, opp.phi);
    vInv += gPhi * gPhi * e * (1 - e);
  }
  const v = 1 / vInv;

  let deltaSum = 0;
  for (const opp of opponents) {
    const gPhi = g(opp.phi);
    const e = expectedScore(mu, opp.mu, opp.phi);
    deltaSum += gPhi * (opp.score - e);
  }
  const delta = v * deltaSum;

  const newSigma = computeNewVolatility(sigma, phi, v, delta);
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

  let muPrimeSum = 0;
  for (const opp of opponents) {
    const gPhi = g(opp.phi);
    const e = expectedScore(mu, opp.mu, opp.phi);
    muPrimeSum += gPhi * (opp.score - e);
  }
  const newMu = mu + newPhi * newPhi * muPrimeSum;

  return {
    rating: fromMu(newMu),
    rd: fromPhi(newPhi),
    volatility: newSigma,
  };
}

/**
 * Apply pre-period RD increase for inactivity (no matches played this period).
 * @param {{ rating: number, rd: number, volatility: number }} player
 */
function applyPrePeriodRdIncrease(player) {
  const phi = toPhi(player.rd);
  const phiStar = Math.sqrt(phi * phi + player.volatility * player.volatility);
  return {
    ...player,
    rd: fromPhi(phiStar),
  };
}

function createDefaultPlayer() {
  return {
    rating: DEFAULT_RATING,
    rd: DEFAULT_RD,
    volatility: DEFAULT_VOLATILITY,
    matchesCounted: 0,
  };
}

module.exports = {
  DEFAULT_RATING,
  DEFAULT_RD,
  DEFAULT_VOLATILITY,
  SCALE,
  toMu,
  toPhi,
  updatePlayer,
  applyPrePeriodRdIncrease,
  createDefaultPlayer,
};
