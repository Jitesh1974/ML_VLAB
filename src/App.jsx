import React from "react";

import { useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownToLine, BookOpen, Check, ChevronDown, CircleHelp,
  Database, FileUp, FlaskConical, Plus, RefreshCw, Sigma, Trash2,
  TrendingUp, Upload, X,
} from 'lucide-react';
import {
  CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';

const COLORS = { ink: '#14213d', blue: '#4263eb', cyan: '#24a6a6', muted: '#6b7890' };

function makeDataset(count = 24, trend = 'positive', noise = 14) {
  const data = [];
  const slope = trend === 'negative' ? -1.35 : trend === 'weak' ? 0.25 : 1.35;
  for (let i = 0; i < count; i += 1) {
    const x = Math.round((i / Math.max(count - 1, 1)) * 90 + 5 + (Math.random() - 0.5) * 9);
    let signal = trend === 'nonlinear' ? 0.035 * (x - 45) ** 2 + 18 : slope * x + 15;
    if (trend === 'weak') signal = 0.25 * x + 35;
    const y = Math.max(0, Number((signal + (Math.random() - 0.5) * noise * 2).toFixed(2)));
    data.push({ id: crypto.randomUUID?.() ?? `${Date.now()}-${i}`, x: Number(x.toFixed(2)), y });
  }
  return data.sort((a, b) => a.x - b.x);
}

function calculateRegression(data) {
  const valid = data.filter((p) => p.x !== '' && p.y !== '' && p.x !== null && p.y !== null && p.x !== undefined && p.y !== undefined && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
  const n = valid.length;
  if (n < 2) return { n, error: 'Add at least two valid data points to fit a line.' };
  const sumX = valid.reduce((s, p) => s + Number(p.x), 0);
  const sumY = valid.reduce((s, p) => s + Number(p.y), 0);
  const sumXY = valid.reduce((s, p) => s + Number(p.x) * Number(p.y), 0);
  const sumX2 = valid.reduce((s, p) => s + Number(p.x) ** 2, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  const denominator = n * sumX2 - sumX ** 2;
  if (Math.abs(denominator) < 1e-12) {
    return { n, error: 'All X values are the same. Change X values to calculate a unique regression line.' };
  }
  // Ordinary least squares, implemented directly from the closed-form equations.
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = meanY - slope * meanX;
  const enriched = valid.map((p) => {
    const x = Number(p.x);
    const y = Number(p.y);
    const predicted = slope * x + intercept;
    return { ...p, x, y, predicted, residual: y - predicted };
  });
  const sse = enriched.reduce((s, p) => s + p.residual ** 2, 0);
  const sst = enriched.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const mae = enriched.reduce((s, p) => s + Math.abs(p.residual), 0) / n;
  const rmse = Math.sqrt(sse / n);
  const r2 = sst === 0 ? (sse < 1e-10 ? 1 : null) : 1 - sse / sst;
  const sorted = [...enriched].sort((a, b) => a.x - b.x);
  return { n, sumX, sumY, sumXY, sumX2, meanX, meanY, slope, intercept, sse, sst, mae, rmse, r2, points: enriched, sorted };
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error('The CSV needs a header row and at least one data row.');
  const splitLine = (line) => {
    const cells = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { cells.push(current.trim()); current = ''; }
      else current += char;
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = splitLine(lines[0]).map((h, i) => h || `Column ${i + 1}`);
  const rows = lines.slice(1).map(splitLine).filter((row) => row.some((v) => v !== ''));
  if (rows.some((row) => row.length > headers.length)) throw new Error('Some rows contain more columns than the header.');
  return { headers, rows };
}

function fmt(value, digits = 3) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : '—';
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, sub, icon: Icon }) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>X = {fmt(Number(label), 2)}</strong>{payload.map((p, i) => <div key={`${p.name}-${i}`}><span style={{ color: p.color || p.fill }}>●</span> {p.name}: {fmt(Number(p.value), 3)}</div>)}</div>;
}

export default function App() {
  const [points, setPoints] = useState(() => makeDataset());
  const [trend, setTrend] = useState('positive');
  const [noise, setNoise] = useState(14);
  const [pointCount, setPointCount] = useState(24);
  const [predictX, setPredictX] = useState('50');
  const [showResiduals, setShowResiduals] = useState(true);
  const [activeTab, setActiveTab] = useState('experiment');
  const [csvInfo, setCsvInfo] = useState(null);
  const [xColumn, setXColumn] = useState('');
  const [yColumn, setYColumn] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);
  const result = useMemo(() => calculateRegression(points), [points]);
  const canPredict = !result.error && predictX.trim() !== '' && Number.isFinite(Number(predictX));
  const prediction = canPredict ? result.slope * Number(predictX) + result.intercept : null;

  function generate() {
    setPoints(makeDataset(pointCount, trend, noise));
    setCsvInfo(null);
    setNotice('A new random dataset has been generated.');
  }
  function updatePoint(id, field, value) {
    setCsvInfo(null);
    setPoints((old) => old.map((p) => p.id === id ? { ...p, [field]: value === '' ? '' : Number(value) } : p));
  }
  function addPoint() {
    setCsvInfo(null);
    const last = points.length ? Math.max(...points.map((p) => Number(p.x) || 0)) : 0;
    setPoints((old) => [...old, { id: crypto.randomUUID?.() ?? `${Date.now()}-new`, x: last + 1, y: 0 }]);
  }
  function removePoint(id) {
    setCsvInfo(null);
    setPoints((old) => old.filter((p) => p.id !== id));
  }
  function applyCsv(info, xName, yName) {
    const xi = info.headers.indexOf(xName);
    const yi = info.headers.indexOf(yName);
    if (xi < 0 || yi < 0 || xi === yi) { setNotice('Choose two different columns for X and Y.'); return; }
    const converted = info.rows.map((row, index) => ({
      id: `csv-${Date.now()}-${index}`,
      x: String(row[xi] ?? '').trim() === '' ? NaN : Number(String(row[xi]).replace(/,/g, '')),
      y: String(row[yi] ?? '').trim() === '' ? NaN : Number(String(row[yi]).replace(/,/g, '')),
    })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (converted.length < 2) { setNotice('The selected columns need at least two rows with numeric X and Y values.'); return; }
    setCsvInfo(info);
    setXColumn(xName); setYColumn(yName);
    setPoints(converted);
    setNotice(`Loaded ${converted.length} numeric rows from the CSV.`);
  }
  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const info = parseCsv(await file.text());
      const numericColumns = info.headers.filter((header, index) => info.rows.some((row) => row[index] !== '' && Number.isFinite(Number(String(row[index] ?? '').replace(/,/g, '')))));
      if (numericColumns.length < 2) throw new Error('Could not find two numeric columns. Please use a CSV with at least two numeric columns.');
      applyCsv(info, numericColumns[0], numericColumns[1]);
    } catch (error) {
      setNotice(error.message || 'Could not read that CSV file.');
    }
  }
  function exportCsv() {
    const lines = ['x,y,predicted,residual', ...points.map((p) => {
      const yHat = result.error ? '' : result.slope * Number(p.x) + result.intercept;
      const residual = result.error ? '' : Number(p.y) - yHat;
      return `${p.x},${p.y},${yHat === '' ? '' : yHat.toFixed(6)},${residual === '' ? '' : residual.toFixed(6)}`;
    })];
    downloadText('linear-regression-results.csv', lines.join('\n'));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><FlaskConical size={21} /></div><div><div className="brand-title">ML VIRTUAL LAB</div><div className="brand-subtitle">Explore. Experiment. Understand.</div></div></div>
        <div className="topbar-right"><span className="status-dot" /> <span>Runs locally in your browser</span><span className="version-pill">LR • 01</span></div>
      </header>

      <main className="main-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> MACHINE LEARNING EXPERIMENT</div>
            <h1>Linear Regression <span>Lab</span></h1>
            <p>Discover how a straight line learns patterns in data. Change the dataset, watch the fit update live, and explore the maths behind every prediction.</p>
            <div className="hero-tags"><span><Check size={14} /> From-scratch algorithm</span><span><Check size={14} /> Interactive experiments</span><span><Check size={14} /> No backend required</span></div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="visual-grid" />
            <svg viewBox="0 0 330 190" role="img" aria-label="Scatter points and a fitted regression line">
              <g stroke="#dbe5fb" strokeWidth="1"><path d="M30 20V160H310" fill="none" />{[50,90,130].map(y => <path key={y} d={`M30 ${y}H310`} strokeDasharray="3 6" />)}{[85,140,195,250].map(x => <path key={x} d={`M${x} 20V160`} strokeDasharray="3 6" />)}</g>
              <path d="M42 140 L298 38" stroke="#4263eb" strokeWidth="3" strokeLinecap="round" />
              {[[45,133],[58,128],[68,143],[84,111],[95,125],[111,100],[122,112],[137,92],[151,108],[165,76],[178,88],[196,65],[210,82],[226,52],[244,64],[257,37],[276,47],[292,34]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="4.2" fill="#24a6a6" stroke="white" strokeWidth="1.6" />)}
            </svg>
            <div className="equation-float">ŷ = mx + b <span>least squares</span></div>
          </div>
        </section>

        <div className="section-nav">
          <button className={activeTab === 'experiment' ? 'nav-tab active' : 'nav-tab'} onClick={() => setActiveTab('experiment')}><Activity size={16} /> Experiment</button>
          <button className={activeTab === 'concepts' ? 'nav-tab active' : 'nav-tab'} onClick={() => setActiveTab('concepts')}><BookOpen size={16} /> Learn the maths</button>
          <div className="nav-spacer" />
          <span className="autosave-label"><span className="tiny-live-dot" /> Live calculations</span>
        </div>

        {activeTab === 'experiment' ? (
          <>
            <section className="controls-card">
              <div className="card-heading"><div className="heading-icon"><RefreshCw size={18} /></div><div><h2>Experiment controls</h2><p>Generate a fresh sample or bring your own dataset.</p></div></div>
              <div className="control-grid">
                <div className="field"><label htmlFor="trend">Data pattern</label><div className="select-wrap"><select id="trend" value={trend} onChange={(e) => setTrend(e.target.value)}><option value="positive">Positive trend</option><option value="negative">Negative trend</option><option value="weak">Weak positive trend</option><option value="nonlinear">Non-linear pattern</option></select><ChevronDown size={15} /></div></div>
                <div className="field"><div className="label-line"><label htmlFor="count">Number of points</label><strong>{pointCount}</strong></div><input id="count" type="range" min="8" max="100" value={pointCount} onChange={(e) => setPointCount(Number(e.target.value))} /></div>
                <div className="field"><div className="label-line"><label htmlFor="noise">Noise level</label><strong>{noise}</strong></div><input id="noise" type="range" min="0" max="35" value={noise} onChange={(e) => setNoise(Number(e.target.value))} /></div>
                <button className="primary-button generate-button" onClick={generate}><RefreshCw size={16} /> Generate dataset</button>
              </div>
              <div className="upload-row">
                <div className="upload-copy"><div className="upload-icon"><Database size={17} /></div><div><strong>Use your own data</strong><span>Upload a CSV containing at least two numeric columns.</span></div></div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden-file" />
                <button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={16} /> Upload CSV</button>
                <button className="secondary-button" onClick={addPoint}><Plus size={16} /> Add custom row</button>
              </div>
              {csvInfo && <div className="csv-column-controls"><span className="csv-loaded"><Check size={14} /> CSV loaded</span><div className="field compact-field"><label htmlFor="xcol">X feature</label><select id="xcol" value={xColumn} onChange={(e) => applyCsv(csvInfo, e.target.value, yColumn)}>{csvInfo.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div><div className="field compact-field"><label htmlFor="ycol">Y target</label><select id="ycol" value={yColumn} onChange={(e) => applyCsv(csvInfo, xColumn, e.target.value)}>{csvInfo.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></div><button className="icon-button" title="Clear CSV column mapping" onClick={() => setCsvInfo(null)}><X size={16}/></button></div>}
              {notice && <div className="notice" role="status"><CircleHelp size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={14}/></button></div>}
            </section>

            <section className="metrics-grid">
              <Metric label="Data points" value={result.n} sub="Numeric X/Y pairs" icon={Database} />
              <Metric label="Slope (m)" value={result.error ? '—' : fmt(result.slope, 4)} sub={result.error ? 'Not available' : (result.slope >= 0 ? 'Y rises as X rises' : 'Y falls as X rises')} icon={TrendingUp} />
              <Metric label="R-squared" value={result.error || result.r2 === null ? '—' : fmt(result.r2, 4)} sub="Variance explained by the line" icon={Activity} />
              <Metric label="RMSE" value={result.error ? '—' : fmt(result.rmse, 3)} sub="Typical prediction error scale" icon={Sigma} />
            </section>

            {result.error ? <div className="error-card"><CircleHelp size={19}/><div><strong>Regression cannot be fitted yet</strong><p>{result.error}</p></div></div> : (
              <section className="chart-grid">
                <div className="panel chart-panel main-chart-panel">
                  <div className="panel-heading"><div><h2>Regression visualizer</h2><p>Observed data compared with the line fitted by least squares.</p></div><span className="chart-chip"><span className="legend-dot actual-dot" /> Actual <span className="legend-line" /> Fitted line</span></div>
                  <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={result.sorted} margin={{ top: 15, right: 20, bottom: 12, left: 2 }}>
                    <CartesianGrid stroke="#e9edf5" strokeDasharray="4 5" vertical={false}/><XAxis type="number" dataKey="x" name="X" tick={{ fill: '#7d8799', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#dce2ec' }} label={{ value: 'X (input feature)', position: 'insideBottom', offset: -3, fill: '#7d8799', fontSize: 11 }}/><YAxis type="number" dataKey="y" tick={{ fill: '#7d8799', fontSize: 11 }} tickLine={false} axisLine={false} width={48} label={{ value: 'Y (target)', angle: -90, position: 'insideLeft', fill: '#7d8799', fontSize: 11 }}/><Tooltip content={<ChartTooltip/>}/><ReferenceLine y={result.meanY} stroke="#aab4c5" strokeDasharray="5 5" ifOverflow="extendDomain"/><Line type="linear" dataKey="predicted" name="Fitted value" stroke={COLORS.blue} strokeWidth={2.7} dot={false} activeDot={false} isAnimationActive={false}/><Scatter data={result.sorted} dataKey="y" name="Actual value" fill={COLORS.cyan} fillOpacity={0.88} shape="circle" isAnimationActive={false}/>
                  </ComposedChart></ResponsiveContainer></div>
                  <div className="chart-footnote"><span><i className="footnote-dot teal"/> Each dot is one observation</span><span><i className="footnote-line"/> Dashed line marks mean Y</span></div>
                </div>
                <div className="panel prediction-panel">
                  <div className="panel-heading"><div><h2>Try a prediction</h2><p>Enter an X value to estimate Y.</p></div><div className="heading-icon small"><TrendingUp size={17}/></div></div>
                  <label className="input-label" htmlFor="predictX">Input feature (X)</label><div className="prediction-input-row"><input id="predictX" type="number" value={predictX} onChange={(e) => setPredictX(e.target.value)} placeholder="e.g. 50"/><button className="secondary-button compact" onClick={() => setPredictX(String(Number(result.meanX.toFixed(2))))}>Use mean X</button></div>
                  <div className="prediction-result"><span>Predicted value (Ŷ)</span><strong>{canPredict ? fmt(prediction, 4) : '—'}</strong><div className="prediction-equation">Ŷ = {fmt(result.slope, 4)} × {canPredict ? fmt(Number(predictX), 3) : 'X'} + ({fmt(result.intercept, 4)})</div></div>
                  <div className="model-equation"><div className="equation-label">YOUR MODEL</div><div className="equation">ŷ = <b>{fmt(result.slope, 3)}</b>x {result.intercept < 0 ? '−' : '+'} <b>{fmt(Math.abs(result.intercept), 3)}</b></div><p>The slope tells you how much predicted Y changes for a one-unit increase in X.</p></div>
                  <div className="mini-stats"><div><span>Intercept (b)</span><strong>{fmt(result.intercept, 4)}</strong></div><div><span>Mean absolute error</span><strong>{fmt(result.mae, 4)}</strong></div></div>
                </div>
              </section>
            )}

            {showResiduals && !result.error && <section className="panel residual-panel"><div className="panel-heading"><div><h2>Residual analysis</h2><p>Residual = observed Y − predicted Y. Points close to zero indicate smaller errors.</p></div><button className="text-button" onClick={() => setShowResiduals(false)}>Hide chart <ChevronDown size={14}/></button></div><div className="residual-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 2 }}><CartesianGrid stroke="#e9edf5" strokeDasharray="4 5" vertical={false}/><XAxis type="number" dataKey="x" name="X" tick={{ fill: '#7d8799', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#dce2ec' }} label={{ value: 'X (input feature)', position: 'insideBottom', offset: -1, fill: '#7d8799', fontSize: 11 }}/><YAxis type="number" dataKey="residual" name="Residual" tick={{ fill: '#7d8799', fontSize: 11 }} tickLine={false} axisLine={false} width={55}/><ReferenceLine y={0} stroke="#4263eb" strokeWidth={1.5}/><Tooltip content={<ChartTooltip/>}/><Scatter data={result.points} dataKey="residual" name="Residual" fill="#e58e26" fillOpacity={0.85}/></ScatterChart></ResponsiveContainer></div></section>}
            {!showResiduals && !result.error && <button className="show-chart-button" onClick={() => setShowResiduals(true)}><Activity size={15}/> Show residual analysis</button>}

            <section className="panel data-panel"><div className="panel-heading data-heading"><div><h2>Dataset workspace</h2><p>Inspect or edit numeric values. Model outputs recalculate automatically.</p></div><div className="data-actions"><span className="row-count">{points.length} rows</span><button className="secondary-button compact" onClick={exportCsv}><ArrowDownToLine size={15}/> Export results</button><button className="icon-button danger" onClick={() => { setPoints([]); setCsvInfo(null); }} title="Clear all rows"><Trash2 size={16}/></button></div></div>
              <div className="table-scroll"><table className="data-table"><thead><tr><th>#</th><th>X · Input feature</th><th>Y · Observed target</th>{!result.error && <><th>Predicted Ŷ</th><th>Residual</th></>}<th aria-label="Remove row"/></tr></thead><tbody>
                {points.map((p, index) => { const x = Number(p.x); const y = Number(p.y); const pred = !result.error && Number.isFinite(x) ? result.slope * x + result.intercept : null; const residual = pred !== null && Number.isFinite(y) ? y - pred : null; return <tr key={p.id}><td className="row-number">{index + 1}</td><td><input aria-label={`Row ${index + 1} X value`} type="number" step="any" value={p.x} onChange={(e) => updatePoint(p.id, 'x', e.target.value)}/></td><td><input aria-label={`Row ${index + 1} Y value`} type="number" step="any" value={p.y} onChange={(e) => updatePoint(p.id, 'y', e.target.value)}/></td>{!result.error && <><td className="calculated-cell">{fmt(pred, 4)}</td><td className={Math.abs(residual ?? 0) > result.rmse ? 'residual-cell high-error' : 'residual-cell'}>{fmt(residual, 4)}</td></>}<td><button className="row-delete" aria-label={`Delete row ${index + 1}`} onClick={() => removePoint(p.id)}><X size={14}/></button></td></tr>; })}
                {points.length === 0 && <tr><td colSpan={6} className="empty-table">No rows yet. Generate a dataset or add a custom row.</td></tr>}
              </tbody></table></div>
              <div className="table-footer"><span><CircleHelp size={14}/> Tip: edit the X or Y cells to see the line and metrics respond.</span><button className="text-button" onClick={addPoint}><Plus size={14}/> Add row</button></div>
            </section>
          </>
        ) : (
          <section className="learning-layout">
            <div className="panel lesson-intro"><div className="lesson-icon"><BookOpen size={22}/></div><div className="eyebrow">THE IDEA</div><h2>Fit the best straight line</h2><p>Simple linear regression models the relationship between one input variable X and a numeric target Y. It chooses the line that minimizes the sum of squared vertical errors between observations and predictions.</p><div className="big-equation">ŷ = mx + b</div><div className="equation-legend"><span><b>m</b> slope</span><span><b>b</b> intercept</span><span><b>ŷ</b> predicted value</span></div></div>
            <div className="panel math-panel"><div className="panel-heading"><div><h2>Least-squares formula</h2><p>This lab computes these equations directly in JavaScript—no ML library.</p></div><div className="heading-icon"><Sigma size={20}/></div></div><div className="formula-block"><span className="formula-step">STEP 1</span><h3>Calculate the slope (m)</h3><div className="math-formula">m = <span className="fraction"><span>nΣxy − (Σx)(Σy)</span><span>nΣx² − (Σx)²</span></span></div><p>The slope describes the expected change in Y for each one-unit increase in X.</p></div><div className="formula-block"><span className="formula-step">STEP 2</span><h3>Calculate the intercept (b)</h3><div className="math-formula">b = ȳ − m x̄</div><p>The intercept is the model's predicted Y value when X equals zero.</p></div><div className="formula-block"><span className="formula-step">STEP 3</span><h3>Make a prediction</h3><div className="math-formula">ŷ = mx + b</div><p>Substitute a new X into the fitted equation to estimate the corresponding Y.</p></div><div className="calculation-card"><h3><Sigma size={17}/> Values from your current dataset</h3>{result.error ? <p>{result.error}</p> : <div className="sum-grid"><div><span>n</span><strong>{result.n}</strong></div><div><span>Σx</span><strong>{fmt(result.sumX, 3)}</strong></div><div><span>Σy</span><strong>{fmt(result.sumY, 3)}</strong></div><div><span>Σxy</span><strong>{fmt(result.sumXY, 3)}</strong></div><div><span>Σx²</span><strong>{fmt(result.sumX2, 3)}</strong></div><div><span>x̄</span><strong>{fmt(result.meanX, 3)}</strong></div><div><span>ȳ</span><strong>{fmt(result.meanY, 3)}</strong></div><div><span>m</span><strong>{fmt(result.slope, 4)}</strong></div><div><span>b</span><strong>{fmt(result.intercept, 4)}</strong></div></div>}</div></div>
            <div className="panel metric-explainer"><div className="panel-heading"><div><h2>How do we evaluate the model?</h2><p>These metrics are recalculated from the current sample.</p></div></div><div className="metric-definition"><b>R² — Coefficient of determination</b><p>R² = 1 − SSE / SST. It measures how much of the variation around the mean is explained by the fitted line. Closer to 1 generally means a better fit to this dataset.</p></div><div className="metric-definition"><b>MAE — Mean absolute error</b><p>MAE = mean(|Y − Ŷ|). It gives the average size of prediction errors in the target's units.</p></div><div className="metric-definition"><b>RMSE — Root mean squared error</b><p>RMSE = √mean((Y − Ŷ)²). Squaring makes larger errors count more heavily.</p></div><div className="metric-definition"><b>Residual</b><p>A residual is the observed value minus the predicted value. A residual plot can help reveal patterns the straight line does not capture.</p></div><button className="primary-button full-button" onClick={() => setActiveTab('experiment')}>Return to experiment <Activity size={16}/></button></div>
          </section>
        )}

        <footer className="footer"><div className="footer-brand"><FlaskConical size={16}/> ML Virtual Lab <span>•</span> Linear Regression</div><div>Built for learning · Calculations run in your browser</div></footer>
      </main>
    </div>
  );
}
