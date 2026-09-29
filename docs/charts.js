// Chart.js is loaded lazily (and cached by the service worker for offline use).
const SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
let lib = null;
const charts = {};

function load() {
  return (lib ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC; s.onload = () => resolve(window.Chart); s.onerror = () => { lib = null; reject(new Error('Chart.js failed to load')); };
    document.head.appendChild(s);
  }));
}

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function base(Chart) {
  Chart.defaults.color = css('--muted');
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.borderColor = css('--line');
  Chart.defaults.animation.duration = 300;
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#242a2f', borderColor: '#333b41', borderWidth: 1, padding: 10, displayColors: false } },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, ticks: { maxTicksLimit: 5 }, beginAtZero: false },
    },
  };
}

function draw(Chart, id, config) {
  charts[id]?.destroy();
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, config);
}

export async function renderCharts(d) {
  const Chart = await load();
  const opts = base(Chart);
  const accent = css('--accent'), blue = css('--machine'), warm = css('--warm');
  draw(Chart, 'cWeekly', {
    type: 'bar',
    data: { labels: d.weeklyLabels, datasets: [{ data: d.weekly, backgroundColor: d.weekly.map((_, i) => (i === d.weekly.length - 1 ? accent : 'rgba(194,242,97,0.35)')), borderRadius: 6, maxBarThickness: 22 }] },
    options: { ...opts, scales: { ...opts.scales, y: { ...opts.scales.y, beginAtZero: true } }, plugins: { ...opts.plugins, tooltip: { ...opts.plugins.tooltip, callbacks: { label: (c) => `${Math.round(c.raw).toLocaleString()} kg` } } } },
  });
  const line = (data, color, label) => ({ label, data, borderColor: color, backgroundColor: color, tension: 0.3, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2.5, spanGaps: true });
  draw(Chart, 'cStrength', {
    type: 'line',
    data: { labels: d.labels, datasets: [line(d.top, accent, 'Top weight'), line(d.e1, blue, 'Est. 1RM')] },
    options: { ...opts, plugins: { ...opts.plugins, tooltip: { ...opts.plugins.tooltip, displayColors: true, callbacks: { label: (c) => ` ${c.dataset.label}: ${c.raw} kg` } } } },
  });
  draw(Chart, 'cVolume', {
    type: 'bar',
    data: { labels: d.labels, datasets: [{ data: d.vol, backgroundColor: warm, borderRadius: 6, maxBarThickness: 18 }] },
    options: { ...opts, scales: { ...opts.scales, y: { ...opts.scales.y, beginAtZero: true } } },
  });
}
