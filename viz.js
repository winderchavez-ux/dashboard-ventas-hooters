/* ---------- utilidades ---------- */
const fmtCOP = n => '$' + new Intl.NumberFormat('es-CO', {maximumFractionDigits: 0}).format(Math.round(n || 0));
const fmtM = n => {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 1 : 2).replace('.', ',') + ' MM';
  if (a >= 1e6) return (n / 1e6).toFixed(0) + ' M';
  if (a >= 1e3) return (n / 1e3).toFixed(0) + ' k';
  return String(Math.round(n));
};
const fmtPct = (n, d = 1) => (n >= 0 ? '+' : '−') + Math.abs(n * 100).toFixed(d).replace('.', ',') + '%';
const fmtPct0 = (n, d = 1) => (n * 100).toFixed(d).replace('.', ',') + '%';
const fmtInt = n => new Intl.NumberFormat('es-CO').format(Math.round(n || 0));
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (t, attrs) => { const e = document.createElementNS(NS, t); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

function hashStr(t) { let h = 0; t = String(t); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; }
const mezcla = (hex, pct) => hex; // los degradados usan stop-opacity

function niceTicks(min, max, count) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return out;
}

/* ---------- tooltip global ---------- */
const tip = el('div', 'viz-tip');
tip.style.display = 'none';
document.body.appendChild(tip);
function showTip(html, x, y) {
  tip.innerHTML = html; tip.style.display = 'block';
  const r = tip.getBoundingClientRect();
  let left = x + 14, top = y - r.height - 12;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
  if (top < 8) top = y + 18;
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
const hideTip = () => { tip.style.display = 'none'; };

/* ---------- gráfica de líneas ---------- */
function lineChart(node, cfg) {
  node.innerHTML = '';
  const W = Math.max(300, Math.round(node.clientWidth || 900)), H = cfg.height || 300;
  const m = {t: 16, r: 16, b: 34, l: 62};
  const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz-svg'});
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const all = cfg.series.flatMap(s => s.values.filter(v => v != null));
  if (!all.length) { node.appendChild(el('p', 'muted', 'Sin datos')); return; }
  let lo = Math.min(0, Math.min(...all)), hi = Math.max(...all);
  const ticks = niceTicks(lo, hi, 5);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const n = cfg.labels.length;
  const X = i => m.l + (n === 1 ? iw / 2 : iw * i / (n - 1));
  const Y = v => m.t + ih - ih * (v - lo) / (hi - lo);

  ticks.forEach(t => {
    svg.appendChild(svgEl('line', {x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'axis-line' : 'grid-line'}));
    const tx = svgEl('text', {x: m.l - 8, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end'});
    tx.textContent = fmtM(t); svg.appendChild(tx);
  });
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 46))));
  const ultimo = n - 1, chocaL = ultimo % every !== 0 && (ultimo - Math.floor(ultimo / every) * every) < every * 0.7;
  cfg.labels.forEach((l, i) => {
    if (i % every !== 0 && !(i === ultimo && !chocaL)) return;
    const tx = svgEl('text', {x: X(i), y: H - 12, class: 'tick', 'text-anchor': 'middle'});
    tx.textContent = l; svg.appendChild(tx);
  });
  const defs = svgEl('defs', {});
  svg.appendChild(defs);
  cfg.series.forEach((s, si) => {
    let d = '', started = false;
    s.values.forEach((v, i) => {
      if (v == null) { started = false; return; }
      d += (started ? 'L' : 'M') + X(i) + ' ' + Y(v) + ' '; started = true;
    });
    if (s.area) {
      const gid = 'g' + Math.abs(hashStr(cfg.uid + si));
      const lg = svgEl('linearGradient', {id: gid, x1: 0, y1: 0, x2: 0, y2: 1});
      const a = svgEl('stop', {offset: '0%', 'stop-color': s.color, 'stop-opacity': .30});
      const b = svgEl('stop', {offset: '100%', 'stop-color': s.color, 'stop-opacity': 0});
      lg.appendChild(a); lg.appendChild(b); defs.appendChild(lg);
      const idx = s.values.map((v, i) => v == null ? -1 : i).filter(i => i >= 0);
      if (idx.length) {
        const area = d + 'L' + X(idx[idx.length - 1]) + ' ' + Y(lo) + ' L' + X(idx[0]) + ' ' + Y(lo) + ' Z';
        svg.appendChild(svgEl('path', {d: area, fill: `url(#${gid})`, stroke: 'none', class: 'cel'}));
      }
    }
    const path = svgEl('path', {d, fill: 'none', stroke: s.color, 'stroke-width': s.dashed ? 2 : 2.4,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke',
      'stroke-dasharray': s.dashed ? '6 4' : ''});
    if (!s.dashed) {
      try {
        svg.appendChild(path);
        const len = Math.ceil(path.getTotalLength()) || 0;
        if (len) { path.style.setProperty('--len', len); path.setAttribute('stroke-dasharray', len); path.classList.add('linea'); }
      } catch (e) { }
    } else { path.setAttribute('class', 'cel'); svg.appendChild(path); }
    const li = s.values.map((v, i) => v == null ? -1 : i).filter(i => i >= 0).pop();
    if (li != null && li >= 0) {
      svg.appendChild(svgEl('circle', {cx: X(li), cy: Y(s.values[li]), r: 5, fill: s.color,
        stroke: 'var(--surface-1)', 'stroke-width': 2.5, class: 'cel'}));
    }
  });
  const cross = svgEl('line', {y1: m.t, y2: m.t + ih, class: 'crosshair', opacity: 0});
  svg.appendChild(cross);
  const dots = cfg.series.map(s => { const c = svgEl('circle', {r: 4.5, fill: s.color, stroke: 'var(--surface-1)', 'stroke-width': 2, opacity: 0}); svg.appendChild(c); return c; });
  const hit = svgEl('rect', {x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent'});
  svg.appendChild(hit);
  hit.addEventListener('mousemove', ev => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width * W;
    let i = Math.round((px - m.l) / (iw / Math.max(1, n - 1)));
    i = Math.max(0, Math.min(n - 1, i));
    cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('opacity', 1);
    let html = '<b>' + (cfg.tipTitle ? cfg.tipTitle(i) : cfg.labels[i]) + '</b>';
    cfg.series.forEach((s, k) => {
      const v = s.values[i];
      if (v == null) { dots[k].setAttribute('opacity', 0); return; }
      dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(v)); dots[k].setAttribute('opacity', 1);
      html += `<div class="row"><i style="background:${s.color}"></i>${s.name}<b>${fmtCOP(v)}</b></div>`;
    });
    if (cfg.tipExtra) html += cfg.tipExtra(i);
    showTip(html, ev.clientX, ev.clientY);
  });
  hit.addEventListener('mouseleave', () => { hideTip(); cross.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); });
  node.appendChild(svg);
}

/* ---------- barras agrupadas ---------- */
function barChart(node, cfg) {
  node.innerHTML = '';
  const W = Math.max(300, Math.round(node.clientWidth || 900)), H = cfg.height || 300;
  const m = {t: 16, r: 16, b: 40, l: 62};
  const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz-svg'});
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const all = cfg.series.flatMap(s => s.values.filter(v => v != null));
  if (!all.length) { node.appendChild(el('p', 'muted', 'Sin datos')); return; }
  let ticks = niceTicks(Math.min(0, ...all), Math.max(...all), 5);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const n = cfg.labels.length, ns = cfg.series.length;
  const bandw = iw / n, gap = Math.min(18, bandw * 0.28);
  const groupw = Math.min(bandw - gap, 120 * ns), bw = (groupw - 2 * (ns - 1)) / ns;
  const Y = v => m.t + ih - ih * (v - lo) / (hi - lo);
  ticks.forEach(t => {
    svg.appendChild(svgEl('line', {x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'axis-line' : 'grid-line'}));
    const tx = svgEl('text', {x: m.l - 8, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end'});
    tx.textContent = fmtM(t); svg.appendChild(tx);
  });
  const paso = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 34))));
  const ult = n - 1, choca = ult % paso !== 0 && (ult - Math.floor(ult / paso) * paso) < paso * 0.7;
  cfg.labels.forEach((l, i) => {
    if (paso > 1 && i % paso !== 0 && !(i === ult && !choca)) return;
    const tx = svgEl('text', {x: m.l + bandw * i + bandw / 2, y: H - 14, class: 'tick', 'text-anchor': 'middle'});
    tx.textContent = l; svg.appendChild(tx);
  });
  cfg.labels.forEach((l, i) => {
    cfg.series.forEach((s, k) => {
      const v = s.values[i]; if (v == null) return;
      const x = m.l + bandw * i + (bandw - groupw) / 2 + k * (bw + 2);
      const y = Math.min(Y(v), Y(0)), h = Math.max(1.5, Math.abs(Y(v) - Y(0)));
      const color = s.colorFn ? s.colorFn(v, i) : s.color;
      const r = svgEl('rect', {x, y, width: bw, height: h, rx: 4, fill: color, class: 'bar'});
      r.style.transformOrigin = v >= 0 ? '50% 100%' : '50% 0%';
      r.style.animationDelay = (i * 14 + k * 40) + 'ms';
      r.addEventListener('mousemove', ev => {
        let html = `<b>${cfg.tipTitle ? cfg.tipTitle(i) : l}</b>`;
        cfg.series.forEach(ss => { if (ss.values[i] != null) html += `<div class="row"><i style="background:${ss.colorFn ? ss.colorFn(ss.values[i], i) : ss.color}"></i>${ss.name}<b>${(cfg.fmt || fmtCOP)(ss.values[i])}</b></div>`; });
        if (cfg.tipExtra) html += cfg.tipExtra(i);
        showTip(html, ev.clientX, ev.clientY);
      });
      r.addEventListener('mouseleave', hideTip);
      svg.appendChild(r);
    });
  });
  node.appendChild(svg);
}

/* ---------- barras horizontales con meta ---------- */
function progressRows(node, rows) {
  node.innerHTML = '';
  const max = Math.max(...rows.map(r => Math.max(r.valor, r.meta)), 1);
  rows.forEach(r => {
    const w = el('div', 'prow');
    const head = el('div', 'prow-head');
    const nm = el('span', 'prow-name');
    const dot = el('i'); dot.style.setProperty('--dot', r.color || 'var(--muted)');
    nm.appendChild(dot); nm.appendChild(document.createTextNode(r.nombre));
    head.appendChild(nm);
    const pct = r.meta ? r.valor / r.meta : 0;
    const pctHoy = r.metaHoy ? r.valor / r.metaHoy : pct;
    const badge = el('span', 'badge ' + (pctHoy >= 1 ? 'good' : pctHoy >= 0.9 ? 'warn' : 'bad'), fmtPct0(pctHoy));
    head.appendChild(badge);
    w.appendChild(head);
    const track = el('div', 'ptrack');
    const fill = el('div', 'pfill');
    fill.style.width = (r.valor / max * 100) + '%';
    fill.style.background = pctHoy >= 1 ? 'var(--good)' : pctHoy >= 0.9 ? 'var(--warning)' : 'var(--critical)';
    track.appendChild(fill);
    if (r.metaHoy) {
      const gh = el('div', 'pgoal hoy');
      gh.style.left = (r.metaHoy / max * 100) + '%';
      track.appendChild(gh);
    }
    const goal = el('div', 'pgoal');
    goal.style.left = (r.meta / max * 100) + '%';
    track.appendChild(goal);
    w.appendChild(track);
    const sub = el('div', 'prow-sub');
    sub.innerHTML = `<span>${fmtCOP(r.valor)}</span><span class="muted">debería llevar ${fmtCOP(r.metaHoy || r.meta)} · mes ${fmtCOP(r.meta)}</span>`;
    w.appendChild(sub);
    w.addEventListener('mousemove', ev => showTip(`<b>${r.nombre}</b><div class="row">Venta a hoy<b>${fmtCOP(r.valor)}</b></div><div class="row">Deberia llevar hoy<b>${fmtCOP(r.metaHoy || r.meta)}</b></div><div class="row">Cumplimiento a hoy<b>${fmtPct0(pctHoy)}</b></div><div class="row muted">${r.dias || ''}</div><div class="row">Diferencia<b>${fmtCOP(r.valor - (r.metaHoy || r.meta))}</b></div><div class="row muted">Presupuesto mes completo<b>${fmtCOP(r.meta)}</b></div>`, ev.clientX, ev.clientY));
    w.addEventListener('mouseleave', hideTip);
    node.appendChild(w);
  });
}

/* ---------- sparkline para las tarjetas KPI ---------- */
function sparkline(node, values, color) {
  const W = Math.max(60, Math.round(node.clientWidth || 150)), H = 26, p = 2;
  const vals = values.filter(v => v != null);
  if (vals.length < 2) return;
  const lo = Math.min(...vals), hi = Math.max(...vals), rng = (hi - lo) || 1;
  const X = i => p + (W - 2 * p) * i / (values.length - 1);
  const Y = v => H - p - (H - 2 * p) * (v - lo) / rng;
  const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz-svg'});
  const gid = 'sp' + Math.abs(hashStr(color + values.length + values[0]));
  const defs = svgEl('defs', {});
  const lg = svgEl('linearGradient', {id: gid, x1: 0, y1: 0, x2: 0, y2: 1});
  lg.appendChild(svgEl('stop', {offset: '0%', 'stop-color': color, 'stop-opacity': .34}));
  lg.appendChild(svgEl('stop', {offset: '100%', 'stop-color': color, 'stop-opacity': 0}));
  defs.appendChild(lg); svg.appendChild(defs);
  let d = '';
  values.forEach((v, i) => { d += (i ? 'L' : 'M') + X(i) + ' ' + Y(v) + ' '; });
  svg.appendChild(svgEl('path', {d: d + `L${X(values.length - 1)} ${H} L${X(0)} ${H} Z`, fill: `url(#${gid})`, class: 'cel'}));
  svg.appendChild(svgEl('path', {d, fill: 'none', stroke: color, 'stroke-width': 1.8,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke', class: 'cel'}));
  svg.appendChild(svgEl('circle', {cx: X(values.length - 1), cy: Y(values[values.length - 1]), r: 2.6, fill: color}));
  node.innerHTML = ''; node.appendChild(svg);
}

/* ---------- barras apiladas ---------- */
function stackedBar(node, cfg) {
  node.innerHTML = '';
  const W = Math.max(300, Math.round(node.clientWidth || 900)), H = cfg.height || 300;
  const m = {t: 16, r: 16, b: 40, l: 62};
  const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz-svg'});
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const n = cfg.labels.length;
  const tot = cfg.labels.map((_, i) => cfg.series.reduce((a, s) => a + (s.values[i] || 0), 0));
  if (!tot.some(v => v > 0)) { node.appendChild(el('p', 'muted', 'Sin datos')); return; }
  const ticks = niceTicks(0, Math.max(...tot), 5);
  const hi = ticks[ticks.length - 1];
  const Y = v => m.t + ih - ih * v / hi;
  ticks.forEach(t => {
    svg.appendChild(svgEl('line', {x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'axis-line' : 'grid-line'}));
    const tx = svgEl('text', {x: m.l - 8, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end'});
    tx.textContent = fmtM(t); svg.appendChild(tx);
  });
  const bandw = iw / n, bw = Math.min(bandw * 0.66, 54);
  const paso = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 38))));
  cfg.labels.forEach((l, i) => {
    if (paso > 1 && i % paso !== 0 && i !== n - 1) return;
    const tx = svgEl('text', {x: m.l + bandw * i + bandw / 2, y: H - 14, class: 'tick', 'text-anchor': 'middle'});
    tx.textContent = l; svg.appendChild(tx);
  });
  cfg.labels.forEach((l, i) => {
    let acc = 0;
    const x = m.l + bandw * i + (bandw - bw) / 2;
    cfg.series.forEach((s, k) => {
      const v = s.values[i] || 0; if (v <= 0) return;
      const y0 = Y(acc), y1 = Y(acc + v);
      const h = Math.max(1, y0 - y1 - 2);   // 2px de aire entre segmentos
      const r = svgEl('rect', {x, y: y1, width: bw, height: h, rx: 3, fill: s.color, class: 'bar'});
      r.style.transformOrigin = '50% 100%';
      r.style.animationDelay = (i * 16 + k * 40) + 'ms';
      r.addEventListener('mousemove', ev => {
        let html = `<b>${cfg.tipTitle ? cfg.tipTitle(i) : l}</b>`;
        cfg.series.forEach(ss => {
          const vv = ss.values[i] || 0;
          html += `<div class="row"><i style="background:${ss.color}"></i>${ss.name}<b>${fmtCOP(vv)} · ${fmtPct0(tot[i] ? vv / tot[i] : 0, 0)}</b></div>`;
        });
        html += `<div class="row">Total<b>${fmtCOP(tot[i])}</b></div>`;
        showTip(html, ev.clientX, ev.clientY);
      });
      r.addEventListener('mouseleave', hideTip);
      svg.appendChild(r);
      acc += v;
    });
  });
  node.appendChild(svg);
}

/* ---------- mapa de calor divergente ---------- */
function heatmap(node, cfg) {
  node.innerHTML = '';
  const filas = cfg.rows, cols = cfg.cols;
  const W = Math.max(320, Math.round(node.clientWidth || 560));
  const lw = 92, ch = 34, gap = 3;
  const cw = (W - lw) / cols.length;
  const H = filas.length * (ch + gap) + 22;
  const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz-svg'});
  cols.forEach((c, j) => {
    const t = svgEl('text', {x: lw + cw * j + cw / 2, y: 12, class: 'tick', 'text-anchor': 'middle'});
    t.textContent = c; svg.appendChild(t);
  });
  filas.forEach((f, i) => {
    const y = 22 + i * (ch + gap);
    const t = svgEl('text', {x: lw - 10, y: y + ch / 2 + 4, class: 'tick', 'text-anchor': 'end'});
    t.textContent = f.nombre; svg.appendChild(t);
    f.valores.forEach((v, j) => {
      if (v == null) return;
      const col = cfg.color(v), fuerte = cfg.fuerte(v);
      const r = svgEl('rect', {x: lw + cw * j + 1, y, width: cw - 2, height: ch, rx: 5, fill: col, class: 'cel'});
      r.style.animationDelay = (i * 60 + j * 22) + 'ms';
      r.addEventListener('mousemove', ev => showTip(cfg.tip(f, j, v), ev.clientX, ev.clientY));
      r.addEventListener('mouseleave', hideTip);
      svg.appendChild(r);
      const lb = svgEl('text', {x: lw + cw * j + cw / 2, y: y + ch / 2 + 4, class: 'cell-lbl',
        'text-anchor': 'middle', fill: fuerte ? '#fff' : 'var(--text-primary)', 'pointer-events': 'none'});
      lb.textContent = cfg.etiqueta(v); svg.appendChild(lb);
    });
  });
  node.appendChild(svg);
}

/* rampa divergente azul <-> rojo con gris al centro (100% de cumplimiento) */
function rampaDiv(p) {
  const d = Math.max(-1, Math.min(1, (p - 1) / 0.35));   // -1 .. +1
  const a = Math.abs(d);
  const alfa = 0.10 + 0.80 * Math.pow(a, 0.75);
  if (a < 0.06) return 'var(--div-mid)';
  const c = d > 0 ? '43,120,214' : '208,59,59';
  return `rgba(${c},${alfa.toFixed(3)})`;
}
const rampaFuerte = p => Math.abs(Math.max(-1, Math.min(1, (p - 1) / 0.35))) > 0.55;
