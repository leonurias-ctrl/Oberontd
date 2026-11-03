/* Diagnóstico de Capacidad Operativa · motor de cálculo y gráficas.
   Lo comparten la herramienta pública (diagnostico.html) y la página interna
   que genera el reporte PDF (diagnostico-revision.html).
   env.state() devuelve el estado actual; env.t(clave) los textos del idioma activo. */
window.createDxEngine = function (env) {
'use strict';
const S = new Proxy({}, { get: (_, k) => env.state()[k] });
const t = (k) => env.t(k);
/* Feriados oficiales y vacaciones mínimas (días hábiles) de referencia por país */
const COUNTRIES = { MX:{h:7,v:12}, BR:{h:10,v:22}, US:{h:11,v:12}, CO:{h:18,v:15}, ES:{h:14,v:22}, AR:{h:16,v:12}, CL:{h:16,v:15}, PE:{h:16,v:22}, XX:{h:10,v:12} };
const LOCALE = { es:'es-MX', en:'en-US', pt:'pt-BR' };
const FREQS = ['d','w','q','m','b','t','s','a'];
/* Peso interno de automatización por herramienta (no se muestra al usuario) */
const TOOLW = { outlook:.75, excel:.85, sheets:.85, word:.55, pdf:.55, erp:.6, crm:.6, portal:.65, teams:.55, bi:.7, whatsapp:.4, legacy:.5, paper:.2, phone:.15, other:.4 };
const COLORS = ['#D4AF6A','#7FB8E6','#F0D5A0','#9C8BD9','#8FD9B6','#E39A7B','#BFE0F5','#C9C3B3','#B98A4A','#5F8FC2'];

const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; };
const nf = (x, d = 0) => new Intl.NumberFormat(LOCALE[S.lang], { minimumFractionDigits:d, maximumFractionDigits:d }).format(x);
const pct = (x, d = 0) => nf(x * 100, d) + '%';
const fte = (x) => nf(x, Math.abs(x) < 1 ? 2 : 1); // 0.04 FTE en vez de "0.0"
const code = (i) => (S.mode === 'proc' ? 'A-' : 'P-') + String(i + 1).padStart(2, '0');

const dayName = (d, style = 'short') => new Intl.DateTimeFormat(LOCALE[S.lang], { weekday:style }).format(new Date(2026, 0, 5 + d)).replace('.', '');


/* ---------------- Cálculos ---------------- */
function occPerYear(p) {
  switch (p.freq) {
    case 'd': return Math.max(0, num(S.daysWeek) * 52 - num(S.holidays)); // el proceso diario se cubre aunque alguien esté de vacaciones
    case 'w': return (p.weeks.length >= 4 ? 52 : 12 * p.weeks.length) * p.days.length; case 'q': return 24; case 'm': return 12;
    case 'b': return 6; case 't': return 4; case 's': return 2; case 'a': return 1;
  }
  return 0;
}
function autoScore(p) {
  if (!p.tools.length) return 0;
  const w = p.tools.map((k) => TOOLW[k] ?? .4);
  const base = .6 * (w.reduce((a, b) => a + b, 0) / w.length) + .4 * Math.max(...w);
  const steps = Math.min(1, Math.max(.55, .55 + num(p.steps) / 40));
  const rules = { rFixed:1, rMixed:.75, rJudg:.45 }[p.rules] ?? .75;
  const input = { iStruct:1, iUnstr:.85, iPaper:.6 }[p.input] ?? .85;
  const doc = { yes:1, partial:.92, no:.85 }[p.doc] ?? .92;
  return Math.min(.9, base * steps * rules * input * doc);
}
function procHours(p) {
  const tH = p.unit === 'h' ? num(p.time) : num(p.time) / 60;
  const occ = occPerYear(p);
  return { occ, annual: tH * Math.max(1, num(p.qty)) * occ * (1 + num(p.rework) / 100) };
}
function calc() {
  const hEff = Math.max(0, num(S.hoursDay) - num(S.lunch) / 60 - num(S.breaks) / 60);
  const daysBase = num(S.daysWeek) * 52;
  const daysAvail = Math.max(0, daysBase - num(S.holidays) - num(S.vacation));
  const capPerson = hEff * daysAvail;
  const ded = S.mode === 'proc' ? Math.min(100, num(S.dedication)) / 100 : 1;
  const fteAvail = num(S.people) * ded;
  const capTeam = capPerson * fteAvail;

  const procs = S.procs.map((p, i) => {
    const { occ, annual } = procHours(p);
    const auto = autoScore(p);
    return { i, code:code(i), name:p.name, annual, occ, auto, lib:annual * auto, fte:capPerson ? annual / capPerson : 0, color:COLORS[i % COLORS.length], p };
  });
  const total = procs.reduce((a, p) => a + p.annual, 0);
  const lib = procs.reduce((a, p) => a + p.lib, 0);

  // Mes típico: 4 semanas × días laborales, por proceso
  const nd = num(S.daysWeek) >= 6 ? 6 : 5;
  const cells = [0,1,2,3].map(() => Array.from({ length:nd }, () => procs.map(() => 0)));
  procs.forEach((r, j) => {
    const p = r.p, tH = p.unit === 'h' ? num(p.time) : num(p.time) / 60;
    const per = tH * Math.max(1, num(p.qty)) * (1 + num(p.rework) / 100);
    const days = p.days.filter((d) => d < nd);
    const put = (ws, ds, h) => ws.forEach((w) => ds.forEach((d) => (cells[w - 1][d][j] += h)));
    if (p.freq === 'd') put([1,2,3,4], [...Array(nd).keys()], per);
    else if (p.freq === 'w') put(p.weeks, days, per);
    else if (p.freq === 'q' && days.length) put([2,4], days, per / days.length);
    else if (p.freq === 'm' && days.length) put([num(p.week) || 4], days, per / days.length);
  });
  const weeks = cells.map((w) => procs.map((_, j) => w.reduce((a, d) => a + d[j], 0)));
  // Año: 12 meses
  const months = Array.from({ length:12 }, () => procs.map(() => 0));
  procs.forEach((r, j) => {
    const f = r.p.freq, A = r.annual;
    const per = { b:[1,3,5,7,9,11], t:[2,5,8,11], s:[5,11], a:[11] }[f];
    if (per) per.forEach((m) => (months[m][j] = A / per.length));
    else months.forEach((m) => (m[j] = A / 12));
  });
  const capWeek = capTeam / 52, capMonth = capTeam / 12, capDay = capWeek / nd;
  const peakWeek = Math.max(0, ...weeks.map((w) => w.reduce((a, b) => a + b, 0)));
  return {
    hEff, daysBase, daysAvail, capPerson, ded, fteAvail, capTeam, procs, total, lib,
    fteReq: capPerson ? total / capPerson : 0,
    util: capTeam ? total / capTeam : 0,
    auto: total ? lib / total : 0,
    weeks, months, capWeek, capMonth, cells, nd, capDay,
    peakUtil: capWeek ? peakWeek / capWeek : 0,
  };
}
const status = (u) => u < .70 ? 'libre' : u < .85 ? 'sano' : u <= 1 ? 'limite' : 'sobre';

/* ---------------- Gráficas (SVG) ---------------- */
const chartW = () => (env.chartW ? env.chartW() : 640);
function niceMax(v) { if (v <= 0) return 10; const e = Math.pow(10, Math.floor(Math.log10(v))); const n = v / e; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * e; }
function stackChart(labels, data, procs, cap, H = 250) {
  const W = chartW(), L = 46, R = 12, Tp = 22, B = 30, iw = W - L - R, ih = H - Tp - B;
  const totals = data.map((r) => r.reduce((a, b) => a + b, 0));
  const max = niceMax(Math.max(cap * 1.12, ...totals) * 1.05);
  const y = (v) => Tp + ih - (v / max) * ih;
  const bw = Math.min(56, iw / labels.length * .58);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = max * k / 4, yy = y(v); g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 8}" y="${yy + 3}" text-anchor="end">${nf(v)}</text>`; }
  labels.forEach((lab, i) => {
    const cx = L + iw * (i + .5) / labels.length; let acc = 0;
    data[i].forEach((v, j) => { if (v <= 0) return; const y0 = y(acc), y1 = y(acc + v); g += `<rect x="${cx - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - .6)}" rx="2" fill="${procs[j].color}"/>`; acc += v; });
    if (acc > 0 && bw >= 18) g += `<text class="val" x="${cx}" y="${y(acc) - 6}" text-anchor="middle"${acc > cap ? ' style="fill:#FF8A7A"' : ''}>${nf(acc, acc < 10 ? 1 : 0)}</text>`;
    g += `<text class="ax" x="${cx}" y="${H - 10}" text-anchor="middle">${esc(lab)}</text>`;
  });
  if (cap > 0) g += `<line x1="${L}" x2="${W - R}" y1="${y(cap)}" y2="${y(cap)}" stroke="#FF8A7A" stroke-width="1.6" stroke-dasharray="6 5"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
function annualChart(r) {
  const rows = [[t('aCap'), r.capTeam, 'rgba(191,224,245,.55)'], [t('aLoad'), r.total, r.total > r.capTeam ? '#FF8A7A' : '#D4AF6A'], [t('aAfter'), r.total - r.lib, '#8FD9B6']];
  const max = Math.max(...rows.map((x) => x[1])) || 1;
  return `<div class="dx-hbars">${rows.map(([lab, v, c]) => `<div class="dx-hbar"><span>${esc(lab)}</span><div><i style="width:${Math.max(1, v / max * 100)}%;background:${c}"></i></div><b>${nf(v)} h</b></div>`).join('')}</div>`;
}
const heatCol = (u) => { const a = .16 + Math.min(u, 1.5) / 1.5 * .55; return u < .70 ? `rgba(127,184,230,${a})` : u < .85 ? `rgba(143,217,182,${a})` : u <= 1 ? `rgba(240,196,106,${a})` : `rgba(255,138,122,${a})`; };
function heatmap(r) {
  const head = `<span></span>${[...Array(r.nd).keys()].map((d) => `<span class="hd">${esc(dayName(d))}</span>`).join('')}`;
  const rows = r.cells.map((w, wi) => `<span class="hd">${esc(t('weekS'))} ${wi + 1}</span>${w.map((d) => { const u = r.capDay ? d.reduce((a, b) => a + b, 0) / r.capDay : 0; return `<span class="cell" style="background:${heatCol(u)}" title="${nf(d.reduce((a, b) => a + b, 0), 1)} h">${pct(u)}</span>`; }).join('')}`).join('');
  return `<div class="dx-heat" style="grid-template-columns:52px repeat(${r.nd},1fr)">${head}${rows}</div>
    <div class="dx-legend"><span><i style="background:${heatCol(.5)}"></i>&lt; 70%</span><span><i style="background:${heatCol(.8)}"></i>70–85%</span><span><i style="background:${heatCol(.95)}"></i>85–100%</span><span><i style="background:${heatCol(1.3)}"></i>&gt; 100%</span></div>`;
}
function balanceMsg(r) {
  const list = [];
  r.cells.forEach((w, wi) => w.forEach((d, di) => list.push({ w:wi + 1, d:di, u:r.capDay ? d.reduce((a, b) => a + b, 0) / r.capDay : 0 })));
  const mx = list.reduce((a, b) => (b.u > a.u ? b : a)), mn = list.reduce((a, b) => (b.u < a.u ? b : a));
  const over = list.filter((x) => x.u > 1).length;
  const ov = over ? ' ' + fill(t('overDays'), { n:over, t:list.length }) : '';
  if (mx.u - mn.u > .35) return fill(t('balance'), { d1:dayName(mx.d, 'long'), w1:mx.w, p1:pct(mx.u), d2:dayName(mn.d, 'long'), w2:mn.w, p2:pct(mn.u) }) + ov;
  return over ? ov.trim() : t('balanceOk');
}
function gauge(u, st) {
  const max = 1.5, cx = 150, cy = 140, rr = 112;
  const pt = (f) => { const a = Math.PI * (1 - Math.min(f, max) / max); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arc = (f0, f1, c, w) => { const [x0, y0] = pt(f0), [x1, y1] = pt(f1); return `<path d="M${x0} ${y0} A${rr} ${rr} 0 0 1 ${x1} ${y1}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="butt"/>`; };
  const col = { libre:'#7FB8E6', sano:'#8FD9B6', limite:'#F0C46A', sobre:'#FF8A7A' }[st];
  const [nx, ny] = pt(u), [tx, ty] = pt(1);
  return `<svg viewBox="0 0 300 175" role="img">
    ${arc(0, .7, 'rgba(127,184,230,.25)', 18)}${arc(.7, .85, 'rgba(143,217,182,.25)', 18)}${arc(.85, 1, 'rgba(240,196,106,.28)', 18)}${arc(1, 1.5, 'rgba(255,138,122,.25)', 18)}
    ${u > 0 ? arc(0, Math.max(.005, Math.min(u, max)), col, 18) : ''}
    <line x1="${tx}" y1="${ty - 14}" x2="${(tx - cx) * 1.12 + cx}" y2="${(ty - cy) * 1.12 + cy}" stroke="rgba(244,242,236,.7)" stroke-width="1.5"/>
    <text class="ax" x="${(tx - cx) * 1.22 + cx}" y="${(ty - cy) * 1.22 + cy}" text-anchor="middle">100%</text>
    <circle cx="${nx}" cy="${ny}" r="7" fill="${col}" stroke="#070A1E" stroke-width="3"/>
    <text x="150" y="128" text-anchor="middle" style="font-family:Fraunces,serif;font-size:44px;fill:${col}">${pct(u)}</text>
    <text class="ax" x="150" y="152" text-anchor="middle">${esc(t('aLoad'))} / ${esc(t('aCap'))}</text>
  </svg>`;
}


/* Matriz de prioridad: carga anual (x) contra potencial de automatización (y) */
function matrix(r, W = 560, H = 360) {
  const L = 46, R = 16, Tp = 16, B = 40, iw = W - L - R, ih = H - Tp - B;
  const pts = r.procs.filter((x) => x.annual > 0);
  const maxX = niceMax(Math.max(...pts.map((x) => x.annual), 1) * 1.1);
  const X = (v) => L + v / maxX * iw, Y = (v) => Tp + ih - v / .9 * ih;
  const midX = X(maxX / 2), midY = Y(.45);
  let g = `<rect x="${midX}" y="${Tp}" width="${L + iw - midX}" height="${midY - Tp}" fill="rgba(143,217,182,.16)"/>`;
  g += `<text class="q" x="${L + iw - 8}" y="${Tp + 16}" text-anchor="end">${esc(t('qWin'))}</text>`;
  g += `<text class="q" x="${L + 8}" y="${Tp + 16}">${esc(t('qQuick'))}</text>`;
  g += `<text class="q" x="${L + iw - 8}" y="${Tp + ih - 8}" text-anchor="end">${esc(t('qLean'))}</text>`;
  g += `<text class="q" x="${L + 8}" y="${Tp + ih - 8}">${esc(t('qLow'))}</text>`;
  g += `<line class="mid" x1="${midX}" x2="${midX}" y1="${Tp}" y2="${Tp + ih}"/><line class="mid" x1="${L}" x2="${L + iw}" y1="${midY}" y2="${midY}"/>`;
  for (let k = 0; k <= 3; k++) { const v = .3 * k; g += `<text class="ax" x="${L - 8}" y="${Y(v) + 3}" text-anchor="end">${pct(v)}</text>`; }
  for (let k = 0; k <= 4; k++) { const v = maxX * k / 4; g += `<text class="ax" x="${X(v)}" y="${Tp + ih + 16}" text-anchor="middle">${nf(v)}</text>`; }
  g += `<text class="ax" x="${L + iw / 2}" y="${H - 4}" text-anchor="middle">${esc(t('mxX'))}</text>`;
  g += `<line class="axl" x1="${L}" x2="${L + iw}" y1="${Tp + ih}" y2="${Tp + ih}"/><line class="axl" x1="${L}" x2="${L}" y1="${Tp}" y2="${Tp + ih}"/>`;
  pts.forEach((x) => { const cx = X(x.annual), cy = Y(Math.min(.9, x.auto)); g += `<circle cx="${cx}" cy="${cy}" r="9" fill="${x.color}" stroke="#fff" stroke-width="2"/><text class="pt" x="${cx + 13}" y="${cy + 4}">${esc(x.code)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
const quadrant = (x, r) => {
  const maxX = Math.max(...r.procs.map((p) => p.annual), 1) * 1.1;
  const hi = x.annual >= niceMax(maxX) / 2, au = x.auto >= .45;
  return au && hi ? 'qWin' : au ? 'qQuick' : hi ? 'qLean' : 'qLow';
};

return { COUNTRIES, LOCALE, FREQS, TOOLW, COLORS, fill, esc, num, nf, pct, fte, code, dayName, occPerYear, autoScore, procHours, calc, status, niceMax, stackChart, annualChart, heatCol, heatmap, balanceMsg, gauge, matrix, quadrant };
};
