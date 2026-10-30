/* ---------- fuente de datos: Google Sheets ---------- */
const SHEET_SEMANAL_ID = '1j1nnFg3quapJ72VGiWMNXOXgVrabCELrFKwFqacUzg4';
const SHEET_DIARIO_ID = '1vH807gFN3vFSUz_OEkO-hahNtbtAWE7qd85JwL7Obik';

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const DIAS_NORM = DIAS.map(norm);
const DIAS_LBL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
  'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function norm(s) {
  if (s === null || s === undefined) return '';
  s = String(s).trim();
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return s.replace(/\s+/g, ' ').toUpperCase();
}
function num(v) { return typeof v === 'number' ? v : null; }
function cap(s) { return s ? s.charAt(0) + s.slice(1).toLowerCase() : s; }

async function fetchWorkbook(id) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo descargar la hoja de cálculo (' + res.status + ')');
  const buf = await res.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

function cellRange(ws) {
  if (!ws['!ref']) return { maxRow: 0, maxCol: 0 };
  const r = XLSX.utils.decode_range(ws['!ref']);
  return { maxRow: r.e.r + 1, maxCol: r.e.c + 1 };
}
function cellAt(ws, row, col) {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  const c = ws[addr];
  return c ? c.v : undefined;
}

/* ---------------------------------------------------------------- semanal */
function leerSemanal(wb) {
  const sedes = {};
  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const { maxCol } = cellRange(ws);
    const hdr = {};
    for (let c = 2; c <= maxCol; c++) hdr[c] = cellAt(ws, 2, c);
    const anios = {};
    let colTrx = null, colTkt = null, colCli = null;
    Object.entries(hdr).forEach(([cStr, v]) => {
      const c = Number(cStr);
      if (typeof v === 'number' && v > 2000 && v < 2100) {
        anios[v] = c;
      } else {
        const n = norm(v);
        if (n.startsWith('TRANSACCION')) colTrx = c;
        else if (n.startsWith('TKT')) colTkt = c;
        else if (n.startsWith('CLIENTE')) colCli = c;
      }
    });
    const anioKeys = Object.keys(anios).map(Number);
    if (anioKeys.length === 0) return;
    const anioActual = Math.max(...anioKeys);
    const semanas = [];
    for (let r = 3; r <= 54; r++) {
      const et = cellAt(ws, r, 2);
      if (!et) continue;
      const m = String(et).match(/(\d+)/);
      if (!m) continue;
      const fila = { semana: parseInt(m[1], 10), ventas: {} };
      anioKeys.forEach(a => {
        fila.ventas[String(a)] = num(cellAt(ws, r, anios[a])) || 0;
      });
      fila.trx = colTrx ? num(cellAt(ws, r, colTrx)) : null;
      fila.clientes = colCli ? num(cellAt(ws, r, colCli)) : null;
      semanas.push(fila);
    }
    const totales = {};
    anioKeys.forEach(a => { totales[String(a)] = num(cellAt(ws, 55, anios[a])) || 0; });
    sedes[name.trim()] = {
      anios: anioKeys.slice().sort((a, b) => b - a),
      anio_actual: anioActual,
      semanas,
      totales_anio: totales,
    };
  });
  return sedes;
}

/* ---------------------------------------------------------------- diario */
function leerDiario(wb) {
  const meses = [];
  wb.SheetNames.forEach(name => {
    const mesNom = norm(name);
    if (!MESES.includes(mesNom)) return;
    const ws = wb.Sheets[name];
    const { maxRow } = cellRange(ws);
    let etiqueta = null;
    const bloques = [];
    let actual = null;
    const company = {};
    for (let r = 1; r <= maxRow; r++) {
      const bRaw = cellAt(ws, r, 2);
      const b = norm(bRaw);
      const cval = cellAt(ws, r, 3);
      const ival = num(cellAt(ws, r, 9));
      if (b === 'MES INFORME' && cval) etiqueta = String(cval).trim();
      if (b.startsWith('RELACION DE VENTAS')) {
        const sede = b.replace('RELACION DE VENTAS', '').trim();
        actual = { sede, dias: {}, semanas: [null, null, null, null, null, null], total: null, presupuesto: null, dias_mes: null };
        bloques.push(actual);
        continue;
      }
      if (actual !== null) {
        const nb = b;
        if (DIAS_NORM.includes(nb)) {
          const vals = [];
          for (let c = 3; c <= 8; c++) vals.push(num(cellAt(ws, r, c)));
          actual.dias[cap(nb)] = vals;
        } else if (nb === 'VENTAS NETAS') {
          const vals = [];
          for (let c = 3; c <= 8; c++) vals.push(num(cellAt(ws, r, c)));
          actual.semanas = vals;
        } else if (nb.startsWith('TOTAL MES NETO')) {
          actual.total = ival;
        } else if (nb === 'PRESUPUESTO') {
          actual.presupuesto = ival;
        } else if (nb.startsWith('DIA MES')) {
          actual.dias_mes = ival;
        }
      }
      if (b.startsWith('PRESUPUESTO TOTAL')) {
        company.presupuesto = ival;
        actual = null;
      } else if (b.startsWith('TOTAL VENTAS COMPA')) {
        company.total = ival;
      }
    }
    bloques.forEach(bl => {
      let cnt = 0;
      Object.values(bl.dias).forEach(vals => { cnt += vals.filter(v => v !== null && v !== undefined).length; });
      bl.dias_transcurridos = cnt;
      // Respaldo: si en el Excel falta la etiqueta "Total Mes Neto" (pasa con Salitre),
      // calcular el total del mes sumando las ventas netas de cada semana.
      if (bl.total === null || bl.total === undefined) {
        const suma = bl.semanas.reduce((a, v) => a + (v || 0), 0);
        if (suma) bl.total = suma;
      }
    });
    const dtMax = bloques.length ? Math.max(...bloques.map(b => b.dias_transcurridos)) : 0;
    const diasMesMax = bloques.length ? Math.max(0, ...bloques.map(b => b.dias_mes || 0)) : 0;
    meses.push({
      mes: mesNom,
      indice: MESES.indexOf(mesNom) + 1,
      etiqueta: etiqueta || cap(mesNom),
      sedes: bloques,
      company,
      dias_mes: diasMesMax,
      dias_transcurridos: dtMax,
    });
  });
  meses.sort((a, b) => a.indice - b.indice);
  return meses;
}

/* ---------------------------------------------------------------- armado */
function canon(nombre) {
  const n = norm(nombre);
  if (n.startsWith('ZONA')) return 'ZONA T';
  if (n.startsWith('MEDELLIN')) return 'MEDELLÍN';
  if (n.startsWith('SALITRE')) return 'SALITRE';
  if (n.startsWith('CALI')) return 'CALI';
  if (n.startsWith('COLOMBIA') || n.includes('COMPA')) return 'COLOMBIA';
  return nombre.trim();
}

function construirDatos(sem, dia) {
  const anio = Math.max(...Object.values(sem).map(v => v.anio_actual));
  const anioPrev = anio - 1;

  const activas = [];
  Object.entries(sem).forEach(([nombre, v]) => {
    if (v.anio_actual === anio) activas.push([canon(nombre), nombre]);
  });
  const orden = ['COLOMBIA', 'ZONA T', 'MEDELLÍN', 'SALITRE'];
  const sedes = orden.filter(s => activas.some(([c]) => c === s));
  activas.forEach(([c]) => { if (!sedes.includes(c)) sedes.push(c); });

  const semanal = {};
  activas.forEach(([c, nombre]) => {
    const v = sem[nombre];
    const filas = v.semanas.map(w => ({
      s: w.semana,
      act: w.ventas[String(anio)] || 0,
      prev: w.ventas[String(anioPrev)] || 0,
      trx: w.trx || 0,
    }));
    semanal[c] = { semanas: filas, totales_anio: v.totales_anio, anios: v.anios };
  });

  const mesesAll = [];
  dia.forEach(m => {
    const bl = {};
    m.sedes.forEach(b => {
      bl[canon(b.sede)] = {
        total: b.total || 0,
        presupuesto: b.presupuesto || 0,
        dias_transcurridos: b.dias_transcurridos,
      };
    });
    const sumTotal = Object.values(bl).reduce((a, x) => a + x.total, 0);
    const sumPpto = Object.values(bl).reduce((a, x) => a + x.presupuesto, 0);
    bl['COLOMBIA'] = {
      total: m.company.total || sumTotal,
      presupuesto: m.company.presupuesto || sumPpto,
      dias_transcurridos: m.dias_transcurridos,
    };
    mesesAll.push({
      mes: m.mes, etiqueta: m.etiqueta,
      dias_mes: Math.trunc(m.dias_mes || 0),
      dias_transcurridos: m.dias_transcurridos,
      sedes: bl,
    });
  });
  const meses = mesesAll.filter(m => m.dias_transcurridos > 0);
  const mesActualIdx = meses.length - 1;

  const diasSemana = {};
  sedes.forEach(s => { diasSemana[s] = { anio: {}, mes: {} }; });
  const acc = {}, accm = {};
  sedes.forEach(s => {
    acc[s] = {}; accm[s] = {};
    DIAS_LBL.forEach(d => { acc[s][d] = []; accm[s][d] = []; });
  });
  dia.forEach((m, i) => {
    if (m.dias_transcurridos === 0) return;
    m.sedes.forEach(b => {
      const c = canon(b.sede);
      if (!(c in acc)) return;
      Object.entries(b.dias).forEach(([k, vals]) => {
        const idx = DIAS_NORM.indexOf(norm(k));
        if (idx === -1) return;
        const lbl = DIAS_LBL[idx];
        vals.forEach(v => {
          if (v !== null && v !== undefined) {
            acc[c][lbl].push(v);
            if (i === mesActualIdx) accm[c][lbl].push(v);
          }
        });
      });
    });
  });
  DIAS_LBL.forEach(lbl => {
    sedes.forEach(s => {
      if (s === 'COLOMBIA') return;
      diasSemana[s].anio[lbl] = acc[s][lbl].length ? acc[s][lbl].reduce((a, b) => a + b, 0) / acc[s][lbl].length : 0;
      diasSemana[s].mes[lbl] = accm[s][lbl].length ? accm[s][lbl].reduce((a, b) => a + b, 0) / accm[s][lbl].length : 0;
    });
    if ('COLOMBIA' in diasSemana) {
      diasSemana['COLOMBIA'].anio[lbl] = sedes.filter(s => s !== 'COLOMBIA').reduce((a, s) => a + diasSemana[s].anio[lbl], 0);
      diasSemana['COLOMBIA'].mes[lbl] = sedes.filter(s => s !== 'COLOMBIA').reduce((a, s) => a + diasSemana[s].mes[lbl], 0);
    }
  });

  const fmt = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  const generado = `${get('day')} de ${get('month')} de ${get('year')}, ${get('hour')}:${get('minute')}`;

  return {
    generado,
    archivos: ['Ventas Comparativo Semanal - Hooters', 'Ventas Diaria y Proyección - Hooters'],
    anio, anio_prev: anioPrev,
    sedes,
    dias: DIAS_LBL,
    semanal,
    meses,
    mes_actual_idx: mesActualIdx,
    dias_semana: diasSemana,
  };
}

async function loadDashboardData() {
  const [wbSem, wbDia] = await Promise.all([
    fetchWorkbook(SHEET_SEMANAL_ID),
    fetchWorkbook(SHEET_DIARIO_ID),
  ]);
  const sem = leerSemanal(wbSem);
  const dia = leerDiario(wbDia);
  return construirDatos(sem, dia);
}
window.loadDashboardData = loadDashboardData;
