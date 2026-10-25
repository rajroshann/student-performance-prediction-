/* ═══════════════════════════════════════════════════════════════
   chart.js  —  Student Performance Predictor
   Dashboard numbers + charts come from /metrics (model/metrics.json).
   Nothing about model quality is hardcoded in this file.
   ═══════════════════════════════════════════════════════════════ */

"use strict";

/* ── Chart.js global defaults ─────────────────────────────────── */
Chart.defaults.color       = '#a0aec0';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.padding  = 16;

const COLORS = { blue: '#4facfe', purple: '#667eea' };

/* Friendly names for the feature-importance chart (fallback: the raw key) */
const FEATURE_LABELS = {
  'avg_rw_score'          : 'Avg reading + writing',
  'reading score'         : 'Reading score',
  'writing score'         : 'Writing score',
  'gender_female'         : 'Gender: female',
  'gender_male'           : 'Gender: male',
  'lunch_standard'        : 'Lunch: standard',
  'lunch_free/reduced'    : 'Lunch: free/reduced',
  'test preparation course_completed': 'Test prep: completed',
  'test preparation course_none'     : 'Test prep: none',
  'race/ethnicity_group A': 'Ethnicity: group A',
  'race/ethnicity_group B': 'Ethnicity: group B',
  'race/ethnicity_group C': 'Ethnicity: group C',
  'race/ethnicity_group D': 'Ethnicity: group D',
  'race/ethnicity_group E': 'Ethnicity: group E',
};
const prettyFeature = key => FEATURE_LABELS[key] || key.replace(/_/g, ' ');

/* ══════════════════════════════════════════════════════════════
   1. MODEL COMPARISON — horizontal bar, test R² per model
   ══════════════════════════════════════════════════════════════ */
function initModelCompareChart(rows, deployedName) {
  const ctx = document.getElementById('modelCompareChart');
  if (!ctx || !Array.isArray(rows) || rows.length === 0) return;

  const sorted = [...rows].sort((a, b) => b.r2 - a.r2);
  const labels = sorted.map(r => r.model);
  const values = sorted.map(r => r.r2);
  const isDeployed = r => r.model === deployedName;

  const fills   = sorted.map(r => isDeployed(r) ? 'rgba(79,172,254,0.85)'  : 'rgba(102,126,234,0.35)');
  const borders = sorted.map(r => isDeployed(r) ? COLORS.blue              : 'rgba(102,126,234,0.9)');
  const axisMin = Math.max(0, Math.floor((Math.min(...values) - 0.05) * 10) / 10);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Test R²',
        data: values,
        backgroundColor: fills,
        borderColor: borders,
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: axisMin, max: 1,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { callback: v => v.toFixed(2), font: { size: 11 } }
        },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` R² = ${c.raw.toFixed(3)}` } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   2. FEATURE IMPORTANCE — horizontal bar
   ══════════════════════════════════════════════════════════════ */
function initFeatureChart(data) {
  const ctx = document.getElementById('featureChart');
  if (!ctx || !data) return;

  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => prettyFeature(k));
  const vals   = sorted.map(([, v]) => +(v * 100).toFixed(1));

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Importance (%)',
        data: vals,
        backgroundColor: 'rgba(79,172,254,0.25)',
        borderColor: COLORS.blue,
        borderWidth: 1.5,
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { callback: v => v + '%', font: { size: 11 } }
        },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.raw}% importance` } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   3. SCORE BREAKDOWN — doughnut (after each prediction)
   ══════════════════════════════════════════════════════════════ */
let breakdownChart = null;

function renderBreakdownChart(math, reading, writing) {
  const ctx = document.getElementById('breakdownChart');
  if (!ctx) return;
  if (breakdownChart) breakdownChart.destroy();

  breakdownChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Math (predicted)', 'Reading', 'Writing'],
      datasets: [{
        data: [math, reading, writing],
        backgroundColor: ['rgba(79,172,254,0.75)', 'rgba(67,233,123,0.75)', 'rgba(240,147,251,0.75)'],
        borderColor: ['#4facfe', '#43e97b', '#f093fb'],
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 14 } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw}/100` } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   4. SCORE RING ANIMATION
   ══════════════════════════════════════════════════════════════ */
function animateRing(score) {
  const bar = document.querySelector('.score-ring-bar');
  if (!bar) return;
  const circumference = 345;
  const offset = circumference - (score / 100) * circumference;

  bar.style.stroke =
    score >= 80 ? '#43e97b' :
    score >= 60 ? '#4facfe' :
    score >= 40 ? '#f6d365' : '#f5576c';

  bar.style.strokeDashoffset = circumference;
  requestAnimationFrame(() => {
    bar.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
    bar.style.strokeDashoffset = offset;
  });
}

/* ══════════════════════════════════════════════════════════════
   FORM SUBMIT & RESULT RENDER
   ══════════════════════════════════════════════════════════════ */
async function submitPrediction() {
  const btn      = document.getElementById('predictBtn');
  const errorBox = document.getElementById('errorBox');
  errorBox.classList.remove('show');

  const payload = {
    gender            : document.getElementById('gender').value,
    race_ethnicity    : document.getElementById('raceEthnicity').value,
    parental_education: document.getElementById('parentalEdu').value,
    lunch             : document.getElementById('lunch').value,
    test_prep         : document.getElementById('testPrep').value,
    reading_score     : document.getElementById('readingScore').value,
    writing_score     : document.getElementById('writingScore').value,
  };

  if (payload.reading_score === '' || payload.writing_score === '') {
    showError('Please enter both reading and writing scores.');
    return;
  }
  const r = +payload.reading_score, w = +payload.writing_score;
  if (r < 0 || r > 100 || w < 0 || w > 100) {
    showError('Scores must be between 0 and 100.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> Predicting…';

  try {
    const res  = await fetch('/predict', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    renderResult(data);
  } catch (err) {
    showError('Prediction failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-lightning-charge-fill me-2"></i>Predict Math Score';
  }
}

function renderResult(data) {
  const { score, grade, label, consistency, breakdown } = data;

  /* the ring is small, so show one decimal there (the API still returns two) */
  document.getElementById('scoreNumber').textContent = score.toFixed(1);

  const gPill = document.getElementById('gradePill');
  gPill.textContent = grade;
  gPill.className   = 'grade-pill ' + (grade === 'A+' ? 'A-plus' : grade);
  document.getElementById('gradeLabel').textContent = label;

  document.getElementById('consVal').textContent = consistency + '%';
  setTimeout(() => {
    document.getElementById('consBarFill').style.width = consistency + '%';
  }, 100);

  document.getElementById('miniMath').textContent    = score.toFixed(1);
  document.getElementById('miniReading').textContent = breakdown.reading;
  document.getElementById('miniWriting').textContent = breakdown.writing;

  animateRing(score);
  renderBreakdownChart(score, breakdown.reading, breakdown.writing);

  /* Bootstrap's d-flex is !important, so an inline display:none would not win */
  const placeholder = document.getElementById('placeholderCard');
  placeholder.classList.remove('d-flex');
  placeholder.classList.add('d-none');
  const panel = document.getElementById('resultPanel');
  panel.classList.remove('show');
  panel.style.display = 'none';
  requestAnimationFrame(() => {
    panel.style.display = 'block';
    requestAnimationFrame(() => panel.classList.add('show'));
  });
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.classList.add('show');
}

/* ══════════════════════════════════════════════════════════════
   LOAD /metrics ON PAGE LOAD
   ══════════════════════════════════════════════════════════════ */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* count distinct models; the "(tuned)" row is a variant of a model already listed */
const countBaseModels = rows =>
  Array.isArray(rows) ? rows.filter(r => !/tuned/i.test(r.model)).length : '—';

async function loadMetrics() {
  try {
    const res = await fetch('/metrics');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const m = await res.json();

    setText('metricR2',    m.r2.toFixed(3));
    setText('metricMAE',   m.mae.toFixed(2));
    setText('metricRMSE',  m.rmse.toFixed(2));
    setText('metricModel', m.deployed_model);

    setText('heroR2',     m.r2.toFixed(3));
    setText('heroMAE',    m.mae.toFixed(1));
    setText('heroModels', countBaseModels(m.model_comparison));
    /* wait for the web font so Chart.js measures the labels with the real font */
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    initModelCompareChart(m.model_comparison, m.deployed_model);
    initFeatureChart(m.feature_importance);
  } catch (e) {
    console.warn('Could not load metrics:', e);
    ['metricR2', 'metricMAE', 'metricRMSE', 'heroR2', 'heroMAE', 'heroModels']
      .forEach(id => setText(id, '—'));
    setText('metricModel', 'Unavailable');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadMetrics();

  /* Enter inside a form field submits the prediction */
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input, select')) submitPrediction();
  });
});
