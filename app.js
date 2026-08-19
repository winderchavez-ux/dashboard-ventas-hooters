/* ---------- estado ---------- */
let SEDE = 'COLOMBIA';
const V = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C1 = () => V('--s1'), C2 = () => V('--s2'), C3 = () => V('--s3');
const CG = () => V('--good'), CB = () => V('--critical'), CX = () => V('--axis');
const COLOR_SEDE = {'ZONA T': '--s1', 'MEDELLÍN': '--s2', 'SALITRE': '--s3', 'COLOMBIA': '--s7'};
const cSede = s => V(COLOR_SEDE[s] || '--muted');
const corto = s => s === 'COLOMBIA' ? 'Colombia' : s;
const mesCorto = i => DATA.meses[i].etiqueta.split(' ')[0];

/* ---------- controles ---------- */
function initControls() {
  const seg = document.getElementById('seg-sedes');
  seg.innerHTML = '';
  if (!DATA.sedes.includes(SEDE)) SEDE = DATA.sedes[0];
  DATA.sedes.forEach(s => {
    const b = el('button');
    const dot = el('i'); dot.style.setProperty('--dot', cSede(s));
    b.appendChild(dot); b.appendChild(document.createTextNode(s === 'COLOMBIA' ? 'Colombia (total)' : s));
    b.setAttribute('aria-pressed', s === SEDE);
    b.onclick = () => { SEDE = s; [...seg.children].forEach(c => c.setAttribute('aria-pressed', false)); b.setAttribute('aria-pressed', true); render(); };
    seg.appendChild(b);
  });
  document.getElementById('btn-tema').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
    [...seg.children].forEach((b, i) => b.firstChild.style.setProperty('--dot', cSede(DATA.sedes[i])));
    render();
  };
  document.getElementById('btn-tabla').onclick = () => {
    const w = document.getElementById('tabla-card');
    w.hidden = !w.hidden;
    if (!w.hidden) { render(); w.scrollIntoView({behavior: 'smooth', block: 'start'}); }
  };
}

/* ---------- cálculos ---------- */
function serieSemanal(sede) {
  const act = [], prev = [], labels = [], trx = [];
  DATA.semanal[sede].semanas.forEach(w => {
    if (w.act > 0) { labels.push('S' + w.s); act.push(w.act); prev.push(w.prev); trx.push(w.trx); }
  });
  return {labels, act, prev, trx, n: labels.length};
}

function kpis(sede) {
  const s = serieSemanal(sede);
  const acum = s.act.reduce((a, b) => a + b, 0);
  const acumPrev = s.prev.reduce((a, b) => a + b, 0);
  const trx = s.trx.reduce((a, b) => a + (b || 0), 0);
  const cerrados = DATA.meses.slice(0, DATA.mes_actual_idx).map(m => m.sedes[sede]).filter(Boolean);
  const pptoCerr = cerrados.reduce((a, b) => a + (b.presupuesto || 0), 0);
  const ventasCerr = cerrados.reduce((a, b) => a + (b.total || 0), 0);
  const mAct = DATA.meses[DATA.mes_actual_idx];
  const bAct = mAct.sedes[sede] || {};
  const proy = bAct.dias_transcurridos ? bAct.total / bAct.dias_transcurridos * mAct.dias_mes : 0;
  return {s, acum, acumPrev, trx, tkt: trx ? acum / trx : 0, pptoCerr, ventasCerr,
          mAct, bAct, proy, var: acumPrev ? acum / acumPrev - 1 : 0};
}

function tile(label, value, deltaHtml, cls, accent, spark) {
  const k = el('div', 'kpi');
  k.style.setProperty('--accent', accent);
  k.appendChild(el('div', 'label', label));
  k.appendChild(el('div', 'value', value));
  if (deltaHtml) { const d = el('div', 'delta ' + (cls || '')); d.innerHTML = deltaHtml; k.appendChild(d); }
  if (spark) { const sp = el('div', 'spark'); k.appendChild(sp); k._spark = {node: sp, vals: spark, color: accent}; }
  return k;
}

/* ---------- render ---------- */
function render() {
  const k = kpis(SEDE), s = k.s;
  const nom = SEDE === 'COLOMBIA' ? 'Colombia (total compañía)' : SEDE;
  document.getElementById('ctx').textContent =
    nom + ' · ' + DATA.anio + ' · ' + s.n + ' semanas con venta registrada';

  /* --- KPIs --- */
  const kp = document.getElementById('kpis'); kp.innerHTML = '';
  const ult = 12;
  const tiles = [
    tile('Venta acumulada ' + DATA.anio, fmtCOP(k.acum),
      `${fmtPct(k.var)}: ${fmtCOP(Math.abs(k.acum - k.acumPrev))} ${k.acum >= k.acumPrev ? 'más' : 'menos'} que en ${DATA.anio_prev}`,
      k.var >= 0 ? 'up' : 'down', cSede(SEDE), s.act.slice(-ult)),
    tile('Lo mismo en ' + DATA.anio_prev, fmtCOP(k.acumPrev),
      `Las mismas ${s.n} semanas del año pasado`, '', C2(), s.prev.slice(-ult)),
    tile('Ticket promedio', fmtCOP(k.tkt), `Lo que gasta cada mesa · ${fmtInt(k.trx)} cuentas`, '', V('--s4'),
      s.act.map((v, i) => s.trx[i] ? v / s.trx[i] : null).slice(-ult).filter(v => v != null)),
  ];
  const cumpl = k.pptoCerr ? k.ventasCerr / k.pptoCerr : 0;
  const faltó = k.pptoCerr - k.ventasCerr;
  tiles.push(tile(`Cumplimiento presupuesto ${mesCorto(0).slice(0, 3)}–${mesCorto(DATA.mes_actual_idx - 1).slice(0, 3)}`,
    fmtPct0(cumpl),
    faltó > 0 ? `Faltaron ${fmtCOP(faltó)} para la meta` : `${fmtCOP(-faltó)} por encima de la meta`,
    cumpl >= 1 ? 'up' : 'down', cumpl >= 1 ? CG() : CB(),
    DATA.meses.slice(0, DATA.mes_actual_idx).map(m => {
      const b = m.sedes[SEDE] || {}; return b.presupuesto ? b.total / b.presupuesto * 100 : 0;
    })));
  const cumplProy = k.bAct.presupuesto ? k.proy / k.bAct.presupuesto : 0;
  const faltaMes = (k.bAct.presupuesto || 0) - k.proy;
  tiles.push(tile('Proyección a fin de ' + mesCorto(DATA.mes_actual_idx), fmtCOP(k.proy),
    faltaMes > 0 ? `${fmtPct0(cumplProy)} de la meta: faltarían ${fmtCOP(faltaMes)}`
                 : `${fmtPct0(cumplProy)} de la meta: ${fmtCOP(-faltaMes)} por encima`,
    cumplProy >= 1 ? 'up' : 'down',
    cumplProy >= 1 ? CG() : V('--warning')));
  tiles.push(tile('Venta ' + mesCorto(DATA.mes_actual_idx) + ' a hoy', fmtCOP(k.bAct.total || 0),
    `Con ${k.bAct.dias_transcurridos || 0} de ${k.mAct.dias_mes} días del mes`, '', V('--s7')));
  tiles.forEach(t => kp.appendChild(t));
  tiles.forEach(t => { if (t._spark) sparkline(t._spark.node, t._spark.vals, t._spark.color); });

  /* --- 1. venta semanal --- */
  lineChart(document.getElementById('ch-semanal'), {
    uid: 'sem' + SEDE, labels: s.labels, height: 300,
    series: [
      {name: String(DATA.anio), color: C1(), values: s.act, area: true},
      {name: String(DATA.anio_prev), color: C2(), values: s.prev, dashed: true}
    ],
    tipTitle: i => 'Semana ' + s.labels[i].slice(1),
    tipExtra: i => {
      const v = s.prev[i] ? s.act[i] / s.prev[i] - 1 : 0;
      return `<div class="row">Variación<b style="color:${v >= 0 ? 'var(--good-text)' : 'var(--critical)'}">${fmtPct(v)}</b></div>`;
    }
  });
  document.getElementById('lg-semanal').innerHTML =
    `<span><i style="background:${C1()}"></i>${DATA.anio}</span><span><i style="background:${C2()}"></i>${DATA.anio_prev}</span>`;

  /* --- 2. diferencia semanal --- */
  const dif = s.act.map((v, i) => v - s.prev[i]);
  barChart(document.getElementById('ch-var'), {
    labels: s.labels, height: 250,
    series: [{name: 'Diferencia', colorFn: v => v >= 0 ? CG() : CB(), values: dif}],
    tipTitle: i => 'Semana ' + s.labels[i].slice(1),
    tipExtra: i => `<div class="row">${DATA.anio}<b>${fmtCOP(s.act[i])}</b></div><div class="row">${DATA.anio_prev}<b>${fmtCOP(s.prev[i])}</b></div><div class="row">Variación<b>${fmtPct(s.prev[i] ? s.act[i] / s.prev[i] - 1 : 0)}</b></div>`
  });
  const arriba = dif.filter(v => v >= 0).length;
  document.getElementById('lg-var').innerHTML =
    `<span><i style="background:${CG()}"></i>Por encima de ${DATA.anio_prev} — ${arriba} semanas</span><span><i style="background:${CB()}"></i>Por debajo — ${dif.length - arriba} semanas</span>`;

  /* --- 3. acumulado --- */
  let a = 0, b = 0;
  const acA = s.act.map(v => (a += v)), acP = s.prev.map(v => (b += v));
  lineChart(document.getElementById('ch-acum'), {
    uid: 'ac' + SEDE, labels: s.labels, height: 250,
    series: [{name: DATA.anio + ' acumulado', color: C1(), values: acA, area: true},
             {name: DATA.anio_prev + ' acumulado', color: C2(), values: acP, dashed: true}],
    tipTitle: i => 'Acumulado a semana ' + s.labels[i].slice(1),
    tipExtra: i => `<div class="row">Brecha<b style="color:${acA[i] - acP[i] >= 0 ? 'var(--good-text)' : 'var(--critical)'}">${fmtCOP(acA[i] - acP[i])}</b></div>`
  });
  document.getElementById('lg-acum').innerHTML =
    `<span><i style="background:${C1()}"></i>${DATA.anio}</span><span><i style="background:${C2()}"></i>${DATA.anio_prev}</span>`;

  /* --- 4. mes a mes vs presupuesto --- */
  const meses = DATA.meses;
  barChart(document.getElementById('ch-mes'), {
    labels: meses.map((m, i) => mesCorto(i).slice(0, 3)), height: 280,
    series: [
      {name: 'Venta neta', colorFn: (v, i) => {
        const bb = meses[i].sedes[SEDE] || {};
        const p = bb.presupuesto ? bb.total / bb.presupuesto : 0;
        return i === DATA.mes_actual_idx ? V('--s7') : (p >= 1 ? CG() : p >= 0.9 ? V('--warning') : CB());
      }, values: meses.map(m => (m.sedes[SEDE] || {}).total || 0)},
      {name: 'Presupuesto', color: CX(), values: meses.map(m => (m.sedes[SEDE] || {}).presupuesto || 0)}
    ],
    tipTitle: i => meses[i].etiqueta,
    tipExtra: i => {
      const bb = meses[i].sedes[SEDE] || {};
      const p = bb.presupuesto ? bb.total / bb.presupuesto : 0;
      let x = `<div class="row">Cumplimiento<b style="color:${p >= 1 ? 'var(--good-text)' : 'var(--critical)'}">${fmtPct0(p)}</b></div>`;
      if (i === DATA.mes_actual_idx) x += `<div class="row muted">Mes en curso (${bb.dias_transcurridos}/${meses[i].dias_mes} días)</div>`;
      return x;
    }
  });
  document.getElementById('lg-mes').innerHTML =
    `<span><i style="background:${CG()}"></i>Cumplió la meta</span><span><i style="background:${V('--warning')}"></i>Entre 90 y 100%</span><span><i style="background:${CB()}"></i>Bajo 90%</span><span><i style="background:${V('--s7')}"></i>Mes en curso</span><span><i style="background:${CX()}"></i>Presupuesto</span>`;

  /* --- 5. día de la semana --- */
  const dsem = DATA.dias_semana[SEDE];
  barChart(document.getElementById('ch-dia'), {
    labels: DATA.dias.map(d => d.slice(0, 3)), height: 260,
    series: [
      {name: 'Promedio ' + DATA.anio, color: C1(), values: DATA.dias.map(d => dsem.anio[d] || 0)},
      {name: mesCorto(DATA.mes_actual_idx), color: C3(), values: DATA.dias.map(d => dsem.mes[d] || 0)}
    ],
    tipTitle: i => DATA.dias[i]
  });
  document.getElementById('lg-dia').innerHTML =
    `<span><i style="background:${C1()}"></i>Promedio del año</span><span><i style="background:${C3()}"></i>${mesCorto(DATA.mes_actual_idx)}</span>`;

  /* --- 6. cumplimiento del mes por sede --- */
  const mA = DATA.meses[DATA.mes_actual_idx];
  const prop = mA.dias_mes ? mA.dias_transcurridos / mA.dias_mes : 1;
  const fila = x => { const bb = mA.sedes[x] || {}; return {nombre: corto(x) === 'Colombia' ? 'Colombia (total)' : x,
    color: cSede(x), valor: bb.total || 0, meta: bb.presupuesto || 0, metaHoy: (bb.presupuesto || 0) * prop,
    dias: `${mA.dias_transcurridos} de ${mA.dias_mes} días`}; };
  progressRows(document.getElementById('ch-sedes'),
    DATA.sedes.filter(x => x !== 'COLOMBIA').map(fila).concat([fila('COLOMBIA')]));
  document.getElementById('nota-sedes').textContent =
    `${mA.etiqueta} · ${mA.dias_transcurridos} de ${mA.dias_mes} días. El % compara contra la meta proporcional a la fecha (marca gris); la marca negra es el presupuesto del mes completo.`;

  /* --- 7. aporte por sede --- */
  const otras = DATA.sedes.filter(x => x !== 'COLOMBIA');
  barChart(document.getElementById('ch-aporte'), {
    labels: otras, height: 250,
    series: [
      {name: String(DATA.anio), colorFn: (v, i) => cSede(otras[i]), values: otras.map(x => serieSemanal(x).act.reduce((p, q) => p + q, 0))},
      {name: String(DATA.anio_prev), color: CX(), values: otras.map(x => serieSemanal(x).prev.reduce((p, q) => p + q, 0))}
    ],
    tipTitle: i => otras[i],
    tipExtra: i => {
      const y = serieSemanal(otras[i]);
      const A = y.act.reduce((p, q) => p + q, 0), B = y.prev.reduce((p, q) => p + q, 0);
      return `<div class="row">Variación<b style="color:${A >= B ? 'var(--good-text)' : 'var(--critical)'}">${fmtPct(B ? A / B - 1 : 0)}</b></div>`;
    }
  });
  document.getElementById('lg-aporte').innerHTML =
    otras.map(x => `<span><i style="background:${cSede(x)}"></i>${x} ${DATA.anio}</span>`).join('') +
    `<span><i style="background:${CX()}"></i>${DATA.anio_prev}</span>`;

  /* --- 8. mix semanal por sede --- */
  const nmix = Math.min(16, s.n);
  const semMix = serieSemanal('COLOMBIA').labels.slice(-nmix);
  stackedBar(document.getElementById('ch-mix'), {
    labels: semMix, height: 290,
    series: otras.map(x => ({name: x, color: cSede(x), values: serieSemanal(x).act.slice(-nmix)})),
    tipTitle: i => 'Semana ' + semMix[i].slice(1)
  });
  document.getElementById('lg-mix').innerHTML =
    otras.map(x => `<span><i style="background:${cSede(x)}"></i>${x}</span>`).join('');
  document.getElementById('nota-mix').textContent =
    `Últimas ${nmix} semanas. La altura total es la venta de la compañía; cada color es cuánto puso cada sede.`;

  /* --- 9. mapa de calor de cumplimiento --- */
  // en el mes en curso se compara contra la meta proporcional a los dias corridos
  const cumplMes = (m, x) => {
    const bb = m.sedes[x] || {};
    if (!bb.presupuesto) return null;
    const f = m.dias_mes && m.dias_transcurridos < m.dias_mes ? m.dias_transcurridos / m.dias_mes : 1;
    return bb.total / (bb.presupuesto * f);
  };
  heatmap(document.getElementById('ch-heat'), {
    cols: meses.map((m, i) => mesCorto(i).slice(0, 3) + (i === DATA.mes_actual_idx ? '*' : '')),
    rows: DATA.sedes.filter(x => x !== 'COLOMBIA').concat(['COLOMBIA']).map(x => ({
      nombre: x === 'COLOMBIA' ? 'Colombia' : x,
      sede: x,
      valores: meses.map(m => cumplMes(m, x))
    })),
    color: rampaDiv, fuerte: rampaFuerte,
    etiqueta: v => Math.round(v * 100) + '%',
    tip: (f, j, v) => {
      const bb = meses[j].sedes[f.sede] || {};
      const enCurso = j === DATA.mes_actual_idx;
      const f2 = enCurso ? meses[j].dias_transcurridos / meses[j].dias_mes : 1;
      let x = `<b>${f.nombre} · ${meses[j].etiqueta}</b>` +
        `<div class="row">Venta<b>${fmtCOP(bb.total)}</b></div>` +
        `<div class="row">${enCurso ? 'Meta a la fecha' : 'Presupuesto'}<b>${fmtCOP(bb.presupuesto * f2)}</b></div>` +
        `<div class="row">Cumplimiento<b style="color:${v >= 1 ? 'var(--good-text)' : 'var(--critical)'}">${fmtPct0(v)}</b></div>`;
      if (enCurso) x += `<div class="row muted">Mes en curso: ${meses[j].dias_transcurridos} de ${meses[j].dias_mes} días. Presupuesto completo ${fmtCOP(bb.presupuesto)}.</div>`;
      return x;
    }
  });
  document.getElementById('nota-heat').innerHTML =
    `Azul = por encima del presupuesto, rojo = por debajo, gris = justo en la meta. ` +
    `<b>${mesCorto(DATA.mes_actual_idx).slice(0, 3)}*</b> va en curso, así que se compara contra la meta proporcional a los ${mA.dias_transcurridos} días corridos.`;

  /* --- tabla --- */
  const tb = document.getElementById('tbody'); tb.innerHTML = '';
  s.labels.forEach((l, i) => {
    const tr = document.createElement('tr');
    const v = s.prev[i] ? s.act[i] / s.prev[i] - 1 : 0;
    const tkt = s.trx[i] ? s.act[i] / s.trx[i] : 0;
    tr.innerHTML = `<td>Semana ${l.slice(1)}</td><td>${fmtCOP(s.act[i])}</td><td>${fmtCOP(s.prev[i])}</td>` +
      `<td class="${s.act[i] - s.prev[i] >= 0 ? 'pos' : 'neg'}">${fmtCOP(s.act[i] - s.prev[i])}</td>` +
      `<td class="${v >= 0 ? 'pos' : 'neg'}">${fmtPct(v)}</td><td>${s.trx[i] ? fmtInt(s.trx[i]) : '—'}</td><td>${tkt ? fmtCOP(tkt) : '—'}</td>`;
    tb.appendChild(tr);
  });

  /* --- lecturas --- */
  const ul = document.getElementById('lecturas'); ul.innerHTML = '';
  const ventasMesTot = DATA.meses.map(m => m.sedes[SEDE]).filter(Boolean).reduce((p, q) => p + (q.total || 0), 0);
  const brecha = ventasMesTot - k.acum;
  document.getElementById('nota-lect').textContent =
    `Chequeo: el comparativo semanal suma ${fmtCOP(k.acum)} y el informe diario ${fmtCOP(ventasMesTot)} ` +
    `(diferencia de ${fmtCOP(brecha)}, ${fmtPct0(k.acum ? brecha / k.acum : 0)}), normal porque las semanas no coinciden con el corte de meses.`;
  lecturas(SEDE, s, k).forEach(([txt, col]) => {
    const li = document.createElement('li');
    li.style.setProperty('--accent', col);
    li.innerHTML = txt; ul.appendChild(li);
  });
}

function lecturas(sede, s, k) {
  const nom = sede === 'COLOMBIA' ? 'La compañía' : sede;
  const mA = DATA.meses[DATA.mes_actual_idx], bA = mA.sedes[sede] || {};
  const prop = mA.dias_mes ? mA.dias_transcurridos / mA.dias_mes : 1;
  const metaHoy = (bA.presupuesto || 0) * prop;
  const cumplHoy = metaHoy ? bA.total / metaHoy : 0;
  const cumpl = k.pptoCerr ? k.ventasCerr / k.pptoCerr : 0;
  const dif = s.act.map((v, i) => v - s.prev[i]);
  const ult4 = dif.slice(-4), pos4 = ult4.filter(v => v >= 0).length;
  const saldo4 = ult4.reduce((a, b) => a + b, 0);
  const dsem = DATA.dias_semana[sede].anio;
  const dd = DATA.dias.slice().sort((a, b) => (dsem[b] || 0) - (dsem[a] || 0));

  return [
    [`<b>Año:</b> ${nom.toLowerCase() === 'la compañía' ? 'la compañía' : nom} lleva <b>${fmtCOP(k.acum)}</b> en ${s.n} semanas, ` +
     `<b>${fmtPct(k.var)}</b> frente a ${DATA.anio_prev} (${fmtCOP(k.acum - k.acumPrev)}), y cerró los meses de ` +
     `${mesCorto(0).slice(0, 3)} a ${mesCorto(DATA.mes_actual_idx - 1).slice(0, 3)} en <b>${fmtPct0(cumpl)}</b> del presupuesto.`,
     k.var >= 0 && cumpl >= 1 ? CG() : k.var >= 0 ? V('--warning') : CB()],

    [`<b>${mA.etiqueta}:</b> lleva <b>${fmtCOP(bA.total || 0)}</b> en ${bA.dias_transcurridos} de ${mA.dias_mes} días — ` +
     `<b>${fmtPct0(cumplHoy)}</b> de lo que debería llevar a hoy (${fmtCOP(metaHoy)}) y proyecta ` +
     `<b>${fmtCOP(k.proy)}</b> a fin de mes contra un presupuesto de ${fmtCOP(bA.presupuesto || 0)}.`,
     cumplHoy >= 1 ? CG() : cumplHoy >= 0.9 ? V('--warning') : CB()],

    [`<b>Tendencia:</b> ${pos4} de las últimas ${ult4.length} semanas superaron a ${DATA.anio_prev} ` +
     `(saldo ${fmtCOP(saldo4)}); los días fuertes son <b>${dd[0]}</b> y <b>${dd[1]}</b>, el más flojo <b>${dd[dd.length - 1]}</b>.`,
     pos4 >= 3 ? CG() : pos4 >= 2 ? V('--warning') : CB()]
  ];
}

let rt;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 180); });

function startApp() {
  initControls();
  render();
}
window.startApp = startApp;
