import { ELEMENT_PROPERTIES, ECM_LITERATURE_RECORDS } from '../data/ecmLiteratureDataset.js';

const FARADAY_C_PER_MOL = 96485.33212;

/**
 * Normalize raw elemental composition into both wt.% and at.% (sum = 100%).
 * @param {Record<string, number>} rawComp - element symbol -> percentage
 * @param {'wt' | 'at'} basis - declared input basis
 */
export function normalizeComposition(rawComp, basis = 'wt') {
  const entries = Object.entries(rawComp)
    .filter(([sym, val]) => ELEMENT_PROPERTIES[sym] && Number.isFinite(Number(val)) && Number(val) > 0)
    .map(([sym, val]) => [sym, Number(val)]);

  const rawSum = entries.reduce((acc, [, v]) => acc + v, 0);
  if (entries.length === 0 || rawSum <= 0) {
    return { valid: false, error: 'Enter at least one valid element with a positive percentage.' };
  }

  const wtPct = {};
  const atPct = {};

  if (basis === 'wt') {
    for (const [sym, v] of entries) wtPct[sym] = (v / rawSum) * 100;
    const totalMoles = entries.reduce((acc, [sym]) => acc + wtPct[sym] / ELEMENT_PROPERTIES[sym].M, 0);
    for (const [sym] of entries) {
      atPct[sym] = ((wtPct[sym] / ELEMENT_PROPERTIES[sym].M) / totalMoles) * 100;
    }
  } else {
    for (const [sym, v] of entries) atPct[sym] = (v / rawSum) * 100;
    const totalMass = entries.reduce((acc, [sym]) => acc + atPct[sym] * ELEMENT_PROPERTIES[sym].M, 0);
    for (const [sym] of entries) {
      wtPct[sym] = ((atPct[sym] * ELEMENT_PROPERTIES[sym].M) / totalMass) * 100;
    }
  }

  return {
    valid: true,
    rawSum,
    wasNormalized: Math.abs(rawSum - 100) > 0.05,
    wtPct,
    atPct
  };
}

/**
 * Compute deterministic Materials Informatics & Electrochemical Physics Descriptors
 */
export function computeAlloyDescriptors(wtPct, atPct) {
  const syms = Object.keys(wtPct);
  let invRho = 0;
  let chargeTerm = 0; // sum(w_i * z_i / M_i)
  let meanR = 0;
  let vec = 0;
  let meanEN = 0;
  let meanE0 = 0;
  let oxideFormerWt = 0;
  let valveMetalWt = 0;
  let sMixR = 0;

  for (const sym of syms) {
    const p = ELEMENT_PROPERTIES[sym];
    const w = wtPct[sym] / 100;
    const x = atPct[sym] / 100;
    invRho += w / p.rho;
    chargeTerm += (w * p.z) / p.M;
    meanR += x * p.r;
    vec += x * p.vec;
    meanEN += x * p.en;
    meanE0 += x * p.e0;
    if (p.oxideFormer) oxideFormerWt += wtPct[sym];
    if (p.valveMetal) valveMetalWt += wtPct[sym];
    if (x > 0) sMixR -= x * Math.log(x);
  }

  const rhoAlloy = 1 / invRho; // g/cm3
  // Volumetric electrochemical equivalent: cm3/(A*s) -> mm3/(A*min) = * 1000 * 60
  const omegaCm3As = 1 / (rhoAlloy * FARADAY_C_PER_MOL * chargeTerm);
  const omegaMm3Amin = omegaCm3As * 1000 * 60;

  // Atomic size difference delta (%) and E0 standard deviation (micro-galvanic risk)
  let deltaSq = 0;
  let e0Var = 0;
  for (const sym of syms) {
    const p = ELEMENT_PROPERTIES[sym];
    const x = atPct[sym] / 100;
    deltaSq += x * Math.pow(1 - p.r / meanR, 2);
    e0Var += x * Math.pow(p.e0 - meanE0, 2);
  }
  const deltaPct = Math.sqrt(deltaSq) * 100;
  const e0SpreadV = Math.sqrt(e0Var);

  // Heuristic phase-constitution cue grounded in empirical HEA/alloy rules (Huang et al. 2019)
  let phaseCue = 'Single-Phase Solid Solution (Likely)';
  if (syms.length === 1) {
    phaseCue = 'Pure Single-Element Metal';
  } else if (deltaPct > 6.5 || (oxideFormerWt > 25 && syms.length >= 3)) {
    phaseCue = 'Multi-Phase / Intermetallic Propensity (Selective Attack Risk)';
  } else if (deltaPct > 4.2) {
    phaseCue = 'Dual-Phase / Precipitate-Strengthened Tendency';
  }

  let passivationRisk = 'Low to Moderate';
  if (valveMetalWt >= 30 || oxideFormerWt >= 45) {
    passivationRisk = 'High (Dense Valve-Metal / Multi-Oxide Passive Film)';
  } else if (oxideFormerWt >= 18) {
    passivationRisk = 'Moderate to High (Cr/Mo/Ti Oxide Passivation)';
  }

  return {
    rhoAlloy,
    omegaMm3Amin,
    vec,
    deltaPct,
    meanEN,
    meanE0,
    e0SpreadV,
    oxideFormerWt,
    valveMetalWt,
    sMixR,
    phaseCue,
    passivationRisk,
    elementCount: syms.length
  };
}

/**
 * Standardized descriptor vector for cross-alloy similarity calculation
 */
function toFeatureVector(desc) {
  return [
    desc.rhoAlloy / 10.0,
    desc.omegaMm3Amin / 3.0,
    desc.vec / 12.0,
    desc.deltaPct / 10.0,
    (desc.meanE0 + 2.5) / 3.0,
    desc.oxideFormerWt / 100.0,
    desc.valveMetalWt / 100.0
  ];
}

function compositionL1Dist(w1, w2) {
  const keys = new Set([...Object.keys(w1), ...Object.keys(w2)]);
  let diff = 0;
  for (const k of keys) diff += Math.abs((w1[k] || 0) - (w2[k] || 0));
  return (0.5 * diff) / 100; // 0 = identical, 1 = completely disjoint elements
}

function euclideanDist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.pow(a[i] - b[i], 2);
  return Math.sqrt(s);
}

function weightedStats(items, getter) {
  const valid = items.filter((it) => Number.isFinite(getter(it.record)));
  if (valid.length === 0) return null;
  const wSum = valid.reduce((acc, it) => acc + it.weight, 0);
  const mean = valid.reduce((acc, it) => acc + it.weight * getter(it.record), 0) / wSum;
  const variance = valid.reduce((acc, it) => acc + it.weight * Math.pow(getter(it.record) - mean, 2), 0) / wSum;
  const std = Math.sqrt(variance);
  const vals = valid.map((it) => getter(it.record));
  return {
    mean,
    std,
    min: Math.min(...vals),
    max: Math.max(...vals),
    supportCount: valid.length
  };
}

/**
 * Main Prediction & Retrieval Engine
 * Strictly uses verified literature records + deterministic Faraday/descriptor physics.
 */
export function runEcmPrediction({
  rawComposition,
  basis = 'wt',
  ecmType = 'Any',
  electrolytePref = 'Auto',
  goal = 'Balanced',
  userIdea = {}
}) {
  const norm = normalizeComposition(rawComposition, basis);
  if (!norm.valid) return { ok: false, error: norm.error };

  const descriptors = computeAlloyDescriptors(norm.wtPct, norm.atPct);
  const qVec = toFeatureVector(descriptors);

  // Score every verified peer-reviewed record in descriptor + process space
  const scored = ECM_LITERATURE_RECORDS.map((rec) => {
    const recNorm = normalizeComposition(rec.composition, 'wt');
    const recDesc = computeAlloyDescriptors(recNorm.wtPct, recNorm.atPct);
    const rVec = toFeatureVector(recDesc);
    const matDist = 0.65 * euclideanDist(qVec, rVec) + 0.65 * compositionL1Dist(norm.wtPct, recNorm.wtPct);

    // Process alignment penalty (keeps predictions grounded to requested ECM mode & electrolyte)
    let procPenalty = 0;
    if (ecmType !== 'Any' && rec.ecmType !== ecmType) procPenalty += 0.35;
    if (electrolytePref !== 'Auto' && !rec.electrolyte.toLowerCase().includes(electrolytePref.toLowerCase())) {
      procPenalty += 0.25;
    }
    if (goal !== 'Balanced' && rec.goalTag !== goal) procPenalty += 0.12;

    const totalDist = matDist + procPenalty;
    const similarityPct = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-1.45 * matDist))));
    const weight = 1 / Math.pow(totalDist + 0.08, 2);

    return {
      record: rec,
      recDesc,
      matDist,
      totalDist,
      similarityPct,
      weight
    };
  }).sort((a, b) => a.totalDist - b.totalDist);

  const topMatches = scored.slice(0, 4);
  const bestMatDist = Math.min(...scored.map((s) => s.matDist));

  // Out-of-Domain (OOD) Coverage Assessment
  let coverageLevel = 'High';
  let oodWarning = null;
  if (bestMatDist > 0.42) {
    coverageLevel = 'Low (Out-of-Domain Extrapolation)';
    oodWarning =
      'This composition sits outside the nearest published alloy clusters in the curated ECM dataset. Treat predicted windows strictly as initial screening estimates and run potentiodynamic polarization before cutting.';
  } else if (bestMatDist > 0.18) {
    coverageLevel = 'Moderate (Interpolated / Modified Alloy)';
    oodWarning =
      'Composition differs noticeably from exact literature alloys. Similarity does not guarantee identical passive-film breakdown; verify breakdown voltage and electrolyte compatibility experimentally.';
  }

  // Distance-weighted candidate parameter & outcome ranges
  const voltage = weightedStats(topMatches, (r) => r.voltageV);
  const feedRate = weightedStats(topMatches, (r) => r.feedRateMmMin);
  const elecConc = weightedStats(topMatches, (r) => r.electrolyteConcGL);
  const ieg = weightedStats(topMatches, (r) => r.iegMm);
  const mrr = weightedStats(topMatches, (r) => r.mrrMm3Min);
  const ra = weightedStats(topMatches, (r) => r.raUm);
  const overcut = weightedStats(topMatches, (r) => r.overcutMm);

  // Recommend electrolyte based on valve-metal/oxide physics + user goal
  let recommendedElectrolyte = topMatches[0].record.electrolyte;
  let electrolyteRationale = `Aligned with closest verified study (${topMatches[0].record.authors}).`;
  if (electrolytePref !== 'Auto') {
    recommendedElectrolyte = electrolytePref;
    electrolyteRationale = `User-selected ${electrolytePref}; verify passive-film breakdown behavior for ${descriptors.oxideFormerWt.toFixed(1)} wt.% oxide-forming elements.`;
  } else if (descriptors.valveMetalWt >= 30 && goal === 'High MRR') {
    recommendedElectrolyte = 'NaCl (100-150 g/L)';
    electrolyteRationale = 'Chloride ions break down dense TiO2/Al2O3 valve-metal passive films more effectively for higher MRR, though stray overcut increases.';
  } else if (goal === 'Precision' || goal === 'Surface Finish') {
    recommendedElectrolyte = 'NaNO3 (100-150 g/L, optional NaOH additive)';
    electrolyteRationale = 'Passivating nitrate electrolyte improves dimensional localization and reduces stray corrosion at low current density.';
  }

  // Optional Faraday sanity estimate if user provided an idea of target current (A)
  let faradayEstimateMm3Min = null;
  if (Number.isFinite(Number(userIdea.currentA)) && Number(userIdea.currentA) > 0) {
    faradayEstimateMm3Min = descriptors.omegaMm3Amin * Number(userIdea.currentA);
  }

  return {
    ok: true,
    normalized: norm,
    descriptors,
    coverageLevel,
    bestMatDist,
    oodWarning,
    recommendedElectrolyte,
    electrolyteRationale,
    faradayEstimateMm3Min,
    predictions: {
      voltage,
      feedRate,
      elecConc,
      ieg,
      mrr,
      ra,
      overcut
    },
    topMatches
  };
}
