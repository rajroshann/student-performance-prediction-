/* ═══════════════════════════════════════════════════════════════
   chart.js  —  Student Performance Predictor
   All Chart.js charts + prediction result rendering
   ═══════════════════════════════════════════════════════════════ */

"use strict";

/* ── Chart.js global defaults ─────────────────────────────────── */
Chart.defaults.color          = '#a0aec0';
Chart.defaults.borderColor    = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family    = "'Inter', sans-serif";
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.padding  = 16;

/* ── Colour palette ───────────────────────────────────────────── */
const COLORS = {
  blue   : '#4facfe',
  purple : '#667eea',
  teal   : '#38b2ac',
  green  : '#43e97b',
  orange : '#f093fb',
  gold   : '#f6d365',
  pink   : '#ed64a6',
  gradBlue  : ['#4facfe', '#00f2fe'],
  gradPurple: ['#667eea', '#764ba2'],
  gradGreen : ['#43e97b', '#38f9d7'],
  gradGold  : ['#f6d365', '#fda085'],
};

/* gradient helper */
function makeGrad(ctx, c1, c2, vertical = true) {
  const g = vertical
    ? ctx.createLinearGradient(0, 0, 0, ctx.canvas.height)
    : ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

/* ══════════════════════════════════════════════════════════════
   1. MODEL METRICS — Radar Chart
   ══════════════════════════════════════════════════════════════ */
function initRadarChart() {
  const ctx = document.getElementById('radarChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['R² Score', 'Accuracy', 'CV Score', 'Precision', 'Recall', 'F1'],
      datasets: [{
        label: 'Random Forest (Tuned)',
        data: [88.2, 87.5, 87.6, 86.0, 85.5, 85.8],
        backgroundColor : 'rgba(79,172,254,0.12)',
        borderColor     : COLORS.blue,
        pointBackgroundColor: COLORS.blue,
        pointRadius     : 5,
        borderWidth     : 2,
      }, {
        label: 'Baseline (Linear Reg)',
        data: [73.5, 72.0, 71.8, 70.5, 70.1, 70.3],
        backgroundColor : 'rgba(102,126,234,0.08)',
        borderColor     : COLORS.purple,
        pointBackgroundColor: COLORS.purple,
        pointRadius     : 4,
        borderWidth     : 1.5,
        borderDash      : [4, 4],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 60, max: 100,
          ticks: { stepSize: 10, backdropColor: 'transparent', font: { size: 10 } },
          grid : { color: 'rgba(255,255,255,0.06)' },
          angleLines: { color: 'rgba(255,255,255,0.06)' },
          pointLabels: { font: { size: 11 }, color: '#a0aec0' },
        }
      },
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   2. MODEL COMPARISON — Horizontal Bar
   ══════════════════════════════════════════════════════════════ */
function initModelCompareChart() {
  const ctx = document.getElementById('modelCompareChart');
  if (!ctx) return;

  const models = [
    'Linear Regression', 'Ridge', 'Lasso',
    'KNN', 'Decision Tree',
    'Gradient Boosting', 'XGBoost',
    'Random Forest (Best)',
  ];
  const r2Scores = [73.5, 74.1, 73.8, 76.2, 79.4, 83.7, 86.2, 88.2];

  const colors = r2Scores.map((v, i) =>
    i === r2Scores.length - 1
      ? 'rgba(79,172,254,0.85)'
      : 'rgba(102,126,234,0.35)'
  );

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: models,
      datasets: [{
        label: 'R² Score (%)',
        data: r2Scores,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.35','0.9').replace('0.85','1')),
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
          min: 60, max: 100,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            callback: v => v + '%',
            font: { size: 11 },
          }
        },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` R² = ${ctx.raw}%` }
        }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   3. FEATURE IMPORTANCE — Horizontal Bar
   ══════════════════════════════════════════════════════════════ */
function initFeatureChart(data) {
  const ctx = document.getElementById('featureChart');
  if (!ctx) return;

  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => k.replace(/_/g, ' ').replace('score','').trim());
  const vals   = sorted.map(([, v]) => +(v * 100).toFixed(1));

  const grad = makeGrad(ctx.getContext('2d'), COLORS.gradGreen[0], COLORS.gradGreen[1], false);

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
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw}% importance` } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   4. SCORE BREAKDOWN — Doughnut (after prediction)
   ══════════════════════════════════════════════════════════════ */
let breakdownChart = null;

function renderBreakdownChart(math, reading, writing) {
  const ctx = document.getElementById('breakdownChart');
  if (!ctx) return;

  if (breakdownChart) breakdownChart.destroy();

  breakdownChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Math', 'Reading', 'Writing'],
      datasets: [{
        data: [math, reading, writing],
        backgroundColor: [
          'rgba(79,172,254,0.75)',
          'rgba(67,233,123,0.75)',
          'rgba(240,147,251,0.75)',
        ],
        borderColor: ['#4facfe','#43e97b','#f093fb'],
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
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}/100` } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   5. SCORE RING SVG ANIMATION
   ══════════════════════════════════════════════════════════════ */
function animateRing(score) {
  const bar = document.querySelector('.score-ring-bar');
  if (!bar) return;
  const circumference = 345;
  const offset = circumference - (score / 100) * circumference;

  // Color by grade
  const colour =
    score >= 80 ? '#43e97b' :
    score >= 60 ? '#4facfe' :
    score >= 40 ? '#f6d365' : '#f5576c';

  bar.style.stroke = colour;
  bar.style.strokeDashoffset = circumference;   // reset
  requestAnimationFrame(() => {
    bar.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
    bar.style.strokeDashoffset = offset;
  });
}

/* ══════════════════════════════════════════════════════════════
   FORM SUBMIT & PREDICTION RENDER
   ══════════════════════════════════════════════════════════════ */
async function submitPrediction() {
  const btn      = document.getElementById('predictBtn');
  const errorBox = document.getElementById('errorBox');
  const panel    = document.getElementById('resultPanel');

  errorBox.classList.remove('show');

  // Collect form values
  const payload = {
    gender            : document.getElementById('gender').value,
    race_ethnicity    : document.getElementById('raceEthnicity').value,
    parental_education: document.getElementById('parentalEdu').value,
    lunch             : document.getElementById('lunch').value,
    test_prep         : document.getElementById('testPrep').value,
    reading_score     : document.getElementById('readingScore').value,
    writing_score     : document.getElementById('writingScore').value,
  };

  // Basic validation
  if (!payload.reading_score || !payload.writing_score) {
    showError('Please enter both reading and writing scores.');
    return;
  }
  const r = +payload.reading_score, w = +payload.writing_score;
  if (r < 0 || r > 100 || w < 0 || w > 100) {
    showError('Scores must be between 0 and 100.');
    return;
  }

  // Loading state
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
  const { score, grade, label, confidence, breakdown } = data;

  /* ── Score number ── */
  document.getElementById('scoreNumber').textContent = score;

  /* ── Grade pill ── */
  const gPill = document.getElementById('gradePill');
  gPill.textContent = grade === 'A+' ? 'A+' : grade;
  gPill.className   = 'grade-pill ' + (grade === 'A+' ? 'A-plus' : grade);

  /* ── Grade label ── */
  document.getElementById('gradeLabel').textContent = label;

  /* ── Confidence bar ── */
  document.getElementById('confVal').textContent = confidence + '%';
  setTimeout(() => {
    document.getElementById('confBarFill').style.width = confidence + '%';
  }, 100);

  /* ── Mini scores ── */
  document.getElementById('miniMath').textContent    = score;
  document.getElementById('miniReading').textContent = breakdown.reading;
  document.getElementById('miniWriting').textContent = breakdown.writing;

  /* ── Ring animation ── */
  animateRing(score);

  /* ── Breakdown chart ── */
  renderBreakdownChart(score, breakdown.reading, breakdown.writing);

  /* ── Show panel ── */
  const panel = document.getElementById('resultPanel');
  panel.classList.remove('show');
  panel.style.display = 'none';
  requestAnimationFrame(() => {
    panel.style.display = 'block';
    requestAnimationFrame(() => panel.classList.add('show'));
  });

  /* scroll to result */
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.classList.add('show');
}

/* ══════════════════════════════════════════════════════════════
   LOAD METRICS & INIT CHARTS ON PAGE LOAD
   ══════════════════════════════════════════════════════════════ */
async function loadMetrics() {
  try {
    const res  = await fetch('/metrics');
    const data = await res.json();

    // Fill metric cards
    setCard('metricR2',    (data.accuracy).toFixed(1) + '%');
    setCard('metricMAE',   data.mae.toFixed(2));
    setCard('metricRMSE',  data.rmse.toFixed(2));
    setCard('metricModel', data.best_model);

    // Feature importance chart
    initFeatureChart(data.feature_importance);
  } catch (e) {
    console.warn('Could not load metrics:', e);
    // Use fallback values
    setCard('metricR2',    '88.2%');
    setCard('metricMAE',   '4.12');
    setCard('metricRMSE',  '5.38');
    setCard('metricModel', 'Random Forest');

    initFeatureChart({
      avg_rw_score        : 0.412,
      writing_score       : 0.198,
      reading_score       : 0.187,
      lunch_standard      : 0.072,
      test_prep_completed : 0.061,
      parental_bachelors  : 0.034,
      gender_female       : 0.021,
      race_group_E        : 0.015,
    });
  }
}

function setCard(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── Animate metric numbers on load ──────────────────────────── */
function animateNumber(el, target, decimals = 0, suffix = '') {
  let start = 0;
  const step = target / 40;
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = start.toFixed(decimals) + suffix;
    if (start >= target) clearInterval(timer);
  }, 25);
}

/* ── DOMContentLoaded ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadMetrics();
  initRadarChart();
  initModelCompareChart();

  /* Keyboard: Enter submits form */
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') submitPrediction();
  });
});
