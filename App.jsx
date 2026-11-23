import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Atom,
  BookOpen,
  CheckSquare,
  ExternalLink,
  Filter,
  FlaskConical,
  Gauge,
  Layers,
  Plus,
  Sliders,
  Trash2
} from 'lucide-react';
import {
  ELEMENT_PROPERTIES,
  MATERIAL_PRESETS,
  ECM_LITERATURE_RECORDS
} from './data/ecmLiteratureDataset.js';
import { runEcmPrediction } from './engine/alloyPhysicsAndPredictor.js';

const ELEMENT_LIST = Object.keys(ELEMENT_PROPERTIES);

const DEFAULT_FILTERS = {
  voltage: true,
  electrolyte: true,
  feedAndIeg: true,
  mrr: true,
  surfaceRoughness: true,
  overcut: true,
  alloyPhysics: true,
  warnings: true,
  literature: true
};

export default function App() {
  const [activeTab, setActiveTab] = useState('predictor');

  // Step 1: Material mode (Single Material vs Alloy / Modified Alloy)
  const [materialMode, setMaterialMode] = useState('alloy');
  const [basis, setBasis] = useState('wt');
  const [selectedPresetId, setSelectedPresetId] = useState('ti64');
  const [rows, setRows] = useState([
    { element: 'Ti', value: 90 },
    { element: 'Al', value: 6 },
    { element: 'V', value: 4 }
  ]);

  // Step 2: Basic ECM Process Questions
  const [ecmType, setEcmType] = useState('Any');
  const [electrolytePref, setElectrolytePref] = useState('Auto');
  const [goal, setGoal] = useState('Balanced');
  const [ideaCurrentA, setIdeaCurrentA] = useState('');
  const [ideaVoltageV, setIdeaVoltageV] = useState('');

  // Step 3: Output Filters
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [dbFamilyFilter, setDbFamilyFilter] = useState('All');

  const applyPreset = (mode, presetId) => {
    const preset = MATERIAL_PRESETS[mode].find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setBasis('wt');
    setRows(Object.entries(preset.composition).map(([element, value]) => ({ element, value })));
  };

  const handleModeSwitch = (mode) => {
    setMaterialMode(mode);
    const first = MATERIAL_PRESETS[mode][0];
    applyPreset(mode, first.id);
  };

  const updateRow = (idx, field, val) => {
    setSelectedPresetId('custom');
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  };

  const addElementRow = () => {
    const used = new Set(rows.map((r) => r.element));
    const nextEl = ELEMENT_LIST.find((e) => !used.has(e)) || 'Mo';
    setSelectedPresetId('custom');
    setRows((prev) => [...prev, { element: nextEl, value: 5 }]);
  };

  const removeRow = (idx) => {
    if (rows.length <= 1) return;
    setSelectedPresetId('custom');
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const result = useMemo(() => {
    const rawComposition = {};
    for (const r of rows) {
      const num = parseFloat(r.value);
      if (Number.isFinite(num) && num > 0) {
        rawComposition[r.element] = (rawComposition[r.element] || 0) + num;
      }
    }
    return runEcmPrediction({
      rawComposition,
      basis,
      ecmType,
      electrolytePref,
      goal,
      userIdea: {
        currentA: ideaCurrentA ? parseFloat(ideaCurrentA) : null,
        voltageV: ideaVoltageV ? parseFloat(ideaVoltageV) : null
      }
    });
  }, [rows, basis, ecmType, electrolytePref, goal, ideaCurrentA, ideaVoltageV]);

  const filteredDbRecords = useMemo(() => {
    if (dbFamilyFilter === 'All') return ECM_LITERATURE_RECORDS;
    return ECM_LITERATURE_RECORDS.filter((r) => r.alloyFamily === dbFamilyFilter);
  }, [dbFamilyFilter]);

  const fmtRange = (stat, unit, decimals = 2) => {
    if (!stat) return 'Insufficient data in matching studies';
    const low = Math.max(0, stat.mean - stat.std).toFixed(decimals);
    const high = (stat.mean + stat.std).toFixed(decimals);
    return `${stat.mean.toFixed(decimals)} ${unit}  (Range: ${low} to ${high} ${unit}, n=${stat.supportCount})`;
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="badge-course">MEDX55 | Advanced Machining Process</span>
          <h1>AI-Driven Alloy Intelligence &amp; ECM Parameter Prediction</h1>
          <p className="subtitle">
            Literature-grounded Electrochemical Machining screening tool for single metals, standard aerospace alloys, and compositionally modified alloys.
          </p>
        </div>
        <nav className="tabs">
          <button
            className={activeTab === 'predictor' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('predictor')}
          >
            <Gauge size={16} /> ECM Parameter Predictor
          </button>
          <button
            className={activeTab === 'database' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('database')}
          >
            <BookOpen size={16} /> Verified Literature Base ({ECM_LITERATURE_RECORDS.length})
          </button>
        </nav>
      </header>

      {activeTab === 'predictor' ? (
        <main className="grid-layout">
          {/* LEFT COLUMN: INPUT WIZARD */}
          <section className="panel">
            <div className="step-header">
              <Atom size={18} />
              <h2>Step 1: Single Material or Alloy Composition</h2>
            </div>

            <div className="segmented">
              <button
                className={materialMode === 'single' ? 'seg-btn active' : 'seg-btn'}
                onClick={() => handleModeSwitch('single')}
              >
                Single Material (Pure Metal)
              </button>
              <button
                className={materialMode === 'alloy' ? 'seg-btn active' : 'seg-btn'}
                onClick={() => handleModeSwitch('alloy')}
              >
                Alloy / Modified Composition
              </button>
            </div>

            <label className="field-label">Quick Select Standard Material / Alloy</label>
            <select
              className="input"
              value={selectedPresetId}
              onChange={(e) => applyPreset(materialMode, e.target.value)}
            >
              {MATERIAL_PRESETS[materialMode].map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom Composition</option>
            </select>

            {materialMode === 'alloy' && (
              <>
                <div className="row-between" style={{ marginTop: 12 }}>
                  <label className="field-label">Elemental Composition</label>
                  <div className="basis-toggle">
                    <button
                      className={basis === 'wt' ? 'chip active' : 'chip'}
                      onClick={() => setBasis('wt')}
                    >
                      wt.%
                    </button>
                    <button
                      className={basis === 'at' ? 'chip active' : 'chip'}
                      onClick={() => setBasis('at')}
                    >
                      at.%
                    </button>
                  </div>
                </div>

                <div className="comp-list">
                  {rows.map((r, idx) => (
                    <div key={idx} className="comp-row">
                      <select
                        className="input"
                        value={r.element}
                        onChange={(e) => updateRow(idx, 'element', e.target.value)}
                      >
                        {ELEMENT_LIST.map((sym) => (
                          <option key={sym} value={sym}>
                            {sym} ({ELEMENT_PROPERTIES[sym].name})
                          </option>
                        ))}
                      </select>
                      <input
                        className="input num-input"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={r.value}
                        onChange={(e) => updateRow(idx, 'value', e.target.value)}
                      />
                      <button
                        className="icon-btn"
                        title="Remove element"
                        onClick={() => removeRow(idx)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                <button className="btn-secondary" onClick={addElementRow}>
                  <Plus size={15} /> Add Element
                </button>
              </>
            )}

            <hr className="divider" />

            <div className="step-header">
              <Sliders size={18} />
              <h2>Step 2: ECM Cutting Process Questions</h2>
            </div>

            <label className="field-label">1. What ECM operation do you plan to perform?</label>
            <select className="input" value={ecmType} onChange={(e) => setEcmType(e.target.value)}>
              <option value="Any">Any / Recommend from Literature</option>
              <option value="Sinking ECM">Sinking ECM (Cavity / Die Sinking)</option>
              <option value="Pulsed ECM">Pulsed ECM (PECM / Aero Blades)</option>
              <option value="Micro-ECM">Micro-ECM / Micro-Hole Drilling</option>
              <option value="Jet ECM">Jet ECM (Micromilling / Surface Texturing)</option>
              <option value="Through-Mask ECM">Through-Mask ECM (Micro-Arrays)</option>
            </select>

            <label className="field-label">2. Preferred electrolyte chemistry?</label>
            <select
              className="input"
              value={electrolytePref}
              onChange={(e) => setElectrolytePref(e.target.value)}
            >
              <option value="Auto">Auto-select based on alloy passivation</option>
              <option value="NaNO3">NaNO3 (Passivating, higher precision)</option>
              <option value="NaCl">NaCl (Active chloride, higher MRR)</option>
              <option value="NaNO3 + NaOH">NaNO3 + NaOH (Alkaline, low stray corrosion)</option>
            </select>

            <label className="field-label">3. Primary machining priority?</label>
            <select className="input" value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="Balanced">Balanced MRR, Finish &amp; Precision</option>
              <option value="High MRR">Maximize Material Removal Rate (MRR)</option>
              <option value="Surface Finish">Best Surface Finish (Minimize Ra)</option>
              <option value="Precision">Highest Precision (Minimize Overcut)</option>
            </select>

            <div className="two-col" style={{ marginTop: 10 }}>
              <div>
                <label className="field-label">Optional: Planned Current (A)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g. 50"
                  value={ideaCurrentA}
                  onChange={(e) => setIdeaCurrentA(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Optional: Target Voltage (V)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g. 15"
                  value={ideaVoltageV}
                  onChange={(e) => setIdeaVoltageV(e.target.value)}
                />
              </div>
            </div>

            <hr className="divider" />

            <div className="step-header">
              <Filter size={18} />
              <h2>Step 3: Filter Predicted Outputs</h2>
            </div>
            <div className="filter-grid">
              {[
                ['voltage', 'Voltage Window (V)'],
                ['electrolyte', 'Electrolyte Setup'],
                ['feedAndIeg', 'Feed Rate & IEG'],
                ['mrr', 'Predicted MRR'],
                ['surfaceRoughness', 'Surface Roughness (Ra)'],
                ['overcut', 'Radial Overcut'],
                ['alloyPhysics', 'Faraday & Alloy Descriptors'],
                ['warnings', 'Passivation & OOD Warnings'],
                ['literature', 'Matching Research Papers']
              ].map(([key, label]) => (
                <label key={key} className="check-item">
                  <input
                    type="checkbox"
                    checked={filters[key]}
                    onChange={() => toggleFilter(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* RIGHT COLUMN: PREDICTED RESULTS */}
          <section className="results-col">
            {!result.ok ? (
              <div className="panel error-card">{result.error}</div>
            ) : (
              <>
                <div className="panel summary-strip">
                  <div>
                    <div className="meta-label">Data Coverage Status</div>
                    <div className="meta-value">{result.coverageLevel}</div>
                  </div>
                  <div>
                    <div className="meta-label">Composition Sum ({basis}.%)</div>
                    <div className="meta-value">
                      {result.normalized.rawSum.toFixed(1)}%
                      {result.normalized.wasNormalized ? ' (Auto-normalized to 100%)' : ' (Valid)'}
                    </div>
                  </div>
                  <div>
                    <div className="meta-label">Top Literature Similarity</div>
                    <div className="meta-value">{result.topMatches[0].similarityPct}%</div>
                  </div>
                </div>

                {filters.warnings && result.oodWarning && (
                  <div className="warning-banner">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Extrapolation &amp; Safety Notice:</strong> {result.oodWarning}
                    </div>
                  </div>
                )}

                <div className="cards-grid">
                  {filters.voltage && (
                    <div className="metric-card">
                      <div className="card-title">Candidate Voltage Window</div>
                      <div className="card-val">{fmtRange(result.predictions.voltage, 'V', 1)}</div>
                      {ideaVoltageV && result.predictions.voltage && (
                        <div className="card-note">
                          Your planned {ideaVoltageV} V is{' '}
                          {Number(ideaVoltageV) >= result.predictions.voltage.min &&
                          Number(ideaVoltageV) <= result.predictions.voltage.max
                            ? 'inside'
                            : 'outside'}{' '}
                          the closest literature voltage band ({result.predictions.voltage.min}–{result.predictions.voltage.max} V).
                        </div>
                      )}
                    </div>
                  )}

                  {filters.electrolyte && (
                    <div className="metric-card">
                      <div className="card-title">Electrolyte &amp; Concentration</div>
                      <div className="card-val">{result.recommendedElectrolyte}</div>
                      <div className="card-note">
                        Conc.: {fmtRange(result.predictions.elecConc, 'g/L', 0)}
                      </div>
                      <div className="card-note">{result.electrolyteRationale}</div>
                    </div>
                  )}

                  {filters.feedAndIeg && (
                    <div className="metric-card">
                      <div className="card-title">Feed Rate &amp; Inter-Electrode Gap</div>
                      <div className="card-val">{fmtRange(result.predictions.feedRate, 'mm/min', 2)}</div>
                      <div className="card-note">IEG: {fmtRange(result.predictions.ieg, 'mm', 2)}</div>
                    </div>
                  )}

                  {filters.mrr && (
                    <div className="metric-card">
                      <div className="card-title">Estimated Material Removal Rate (MRR)</div>
                      <div className="card-val">{fmtRange(result.predictions.mrr, 'mm³/min', 2)}</div>
                      {result.faradayEstimateMm3Min && (
                        <div className="card-note">
                          Theoretical Faraday MRR at {ideaCurrentA} A (100% eff.):{' '}
                          <strong>{result.faradayEstimateMm3Min.toFixed(2)} mm³/min</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {filters.surfaceRoughness && (
                    <div className="metric-card">
                      <div className="card-title">Estimated Surface Roughness (Ra)</div>
                      <div className="card-val">{fmtRange(result.predictions.ra, 'µm', 2)}</div>
                    </div>
                  )}

                  {filters.overcut && (
                    <div className="metric-card">
                      <div className="card-title">Estimated Radial Overcut (ROC)</div>
                      <div className="card-val">{fmtRange(result.predictions.overcut, 'mm', 3)}</div>
                    </div>
                  )}
                </div>

                {filters.alloyPhysics && (
                  <div className="panel">
                    <div className="step-header">
                      <FlaskConical size={18} />
                      <h2>Computed Alloy Physics &amp; Electrochemical Descriptors</h2>
                    </div>
                    <div className="desc-grid">
                      <div>
                        <span>Alloy Density (ρ)</span>
                        <strong>{result.descriptors.rhoAlloy.toFixed(2)} g/cm³</strong>
                      </div>
                      <div>
                        <span>Faraday Equivalent (ω)</span>
                        <strong>{result.descriptors.omegaMm3Amin.toFixed(3)} mm³/(A·min)</strong>
                      </div>
                      <div>
                        <span>Valence Electron Conc. (VEC)</span>
                        <strong>{result.descriptors.vec.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span>Atomic Size Mismatch (δ)</span>
                        <strong>{result.descriptors.deltaPct.toFixed(2)}%</strong>
                      </div>
                      <div>
                        <span>Oxide-Former Fraction</span>
                        <strong>{result.descriptors.oxideFormerWt.toFixed(1)} wt.%</strong>
                      </div>
                      <div>
                        <span>Micro-Galvanic E⁰ Spread</span>
                        <strong>{result.descriptors.e0SpreadV.toFixed(2)} V</strong>
                      </div>
                    </div>
                    <p className="physics-note">
                      <strong>Phase Cue:</strong> {result.descriptors.phaseCue} &nbsp;|&nbsp;{' '}
                      <strong>Passivation Tendency:</strong> {result.descriptors.passivationRisk}
                    </p>
                    <div className="basis-table">
                      {Object.keys(result.normalized.wtPct).map((sym) => (
                        <span key={sym} className="el-pill">
                          {sym}: {result.normalized.wtPct[sym].toFixed(1)} wt.% ({result.normalized.atPct[sym].toFixed(1)} at.%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {filters.literature && (
                  <div className="panel">
                    <div className="step-header">
                      <Layers size={18} />
                      <h2>Closest Verified Peer-Reviewed ECM Studies</h2>
                    </div>
                    <div className="match-list">
                      {result.topMatches.map(({ record, similarityPct }) => (
                        <div key={record.id} className="match-card">
                          <div className="row-between">
                            <strong>
                              {record.alloyName} — {record.ecmType} ({record.electrolyte})
                            </strong>
                            <span className="sim-pill">{similarityPct}% alloy match</span>
                          </div>
                          <div className="match-metrics">
                            <span>Voltage: {record.voltageV} V</span>
                            <span>Conc.: {record.electrolyteConcGL} g/L</span>
                            {record.mrrMm3Min !== null && <span>MRR: {record.mrrMm3Min} mm³/min</span>}
                            {record.raUm !== null && <span>Ra: {record.raUm} µm</span>}
                            {record.overcutMm !== null && <span>Overcut: {record.overcutMm} mm</span>}
                          </div>
                          <p className="match-notes">{record.notes}</p>
                          <a
                            className="doi-link"
                            href={record.doiUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {record.authors} — {record.journal} <ExternalLink size={13} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="disclaimer-foot">
                  <CheckSquare size={15} />
                  <span>
                    Research decision-support output only. Conduct potentiodynamic polarization and supervised benchtop ECM trials before industrial machining.
                  </span>
                </div>
              </>
            )}
          </section>
        </main>
      ) : (
        <section className="panel">
          <div className="row-between" style={{ marginBottom: 14 }}>
            <div className="step-header" style={{ marginBottom: 0 }}>
              <BookOpen size={18} />
              <h2>Curated Peer-Reviewed ECM Experimental Knowledge Base</h2>
            </div>
            <select
              className="input"
              style={{ width: 220 }}
              value={dbFamilyFilter}
              onChange={(e) => setDbFamilyFilter(e.target.value)}
            >
              <option value="All">All Alloy Families</option>
              <option value="Titanium">Titanium Alloys</option>
              <option value="Nickel">Nickel Superalloys</option>
              <option value="Aluminium">Aluminium Alloys</option>
              <option value="Ferrous">Stainless Steels</option>
              <option value="Nickel-Titanium">NiTi Shape Memory</option>
            </select>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alloy &amp; Family</th>
                  <th>ECM Variant</th>
                  <th>Electrolyte</th>
                  <th>Voltage / IEG</th>
                  <th>Measured Outcomes</th>
                  <th>Source Paper</th>
                </tr>
              </thead>
              <tbody>
                {filteredDbRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <strong>{rec.alloyName}</strong>
                      <div className="sub-cell">{rec.alloyFamily}</div>
                    </td>
                    <td>{rec.ecmType}</td>
                    <td>
                      {rec.electrolyte} ({rec.electrolyteConcGL} g/L)
                    </td>
                    <td>
                      {rec.voltageV} V / {rec.iegMm} mm
                    </td>
                    <td>
                      {rec.mrrMm3Min !== null ? `MRR: ${rec.mrrMm3Min} mm³/min ` : ''}
                      {rec.raUm !== null ? `| Ra: ${rec.raUm} µm ` : ''}
                      {rec.overcutMm !== null ? `| ROC: ${rec.overcutMm} mm` : ''}
                    </td>
                    <td>
                      <a href={rec.doiUrl} target="_blank" rel="noreferrer" className="doi-link">
                        {rec.authors} <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
