// ═══════════════════════════════════════════════════════════════
//  SJ Family — moteur de garde (fonctions pures, aucun accès DOM)
//  Codes jour :  A / B  = garde du parent A / B (jour compté)
//                a / b  = parent A / B par défaut (jours d'école, non comptés)
//                X      = A puis B (demi-journée, ex. « KA/JE »)
//                Y      = B puis A (demi-journée, ex. « JE/KA »)
//                .      = rien de défini
//  Règle de relais : un jour de garde D commence la veille (D-1) à 18h30
//  et se termine le jour D à 18h30, sauf horaire convenu différent.
// ═══════════════════════════════════════════════════════════════

export const DAYMS = 86400000;
export const pad = n => String(n).padStart(2, '0');
export function d2n(iso) { const [y, m, d] = iso.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / DAYMS); }
export function n2d(n) { return new Date(n * DAYMS).toISOString().slice(0, 10); }
export function addDays(iso, k) { return n2d(d2n(iso) + k); }
export function diffDays(a, b) { return d2n(b) - d2n(a); }
/** 0 = lundi … 6 = dimanche */
export function dow(iso) { return ((d2n(iso) + 3) % 7 + 7) % 7; }
export function todayISO(dt = new Date()) { return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`; }
export function nowMin(dt = new Date()) { return dt.getHours() * 60 + dt.getMinutes(); }
export function t2m(t) { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); }
export function m2t(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
export function mondayOf(iso) { return addDays(iso, -dow(iso)); }
export function isoWeek(iso) {
  const n = d2n(iso), thu = n - dow(iso) + 3;
  const y = new Date(thu * DAYMS).getUTCFullYear();
  return { year: y, week: 1 + Math.floor((thu - d2n(`${y}-01-01`)) / 7) };
}
export function* eachDay(from, to) { for (let n = d2n(from), e = d2n(to); n <= e; n++) yield n2d(n); }
export function monthDays(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); } // m = 1..12

export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const JOURS_C = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
export const JOURS_L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function fmtDate(iso, opt = 'long') {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (opt === 'short') return `${pad(d)}/${pad(m)}`;
  if (opt === 'num') return `${pad(d)}/${pad(m)}/${y}`;
  if (opt === 'dm') return `${d} ${MOIS[m - 1]}`;
  if (opt === 'wdm') return `${cap(JOURS_C[dow(iso)])} ${d} ${MOIS_C[m - 1]}`;
  if (opt === 'wdmy') return `${cap(JOURS[dow(iso)])} ${d} ${MOIS[m - 1]} ${y}`;
  return `${d} ${MOIS[m - 1]} ${y}`;
}
export function fmtTime(t) { if (!t) return ''; const [h, m] = t.split(':'); return `${Number(h)}h${m === '00' ? '' : m}`; }
export function fmtNum(x) { if (x % 1 === 0) return String(x); const i = Math.floor(x); return (i ? i : '') + '½'; }
export function relDay(iso, today = todayISO()) {
  const k = diffDays(today, iso);
  if (k === 0) return "aujourd'hui"; if (k === 1) return 'demain'; if (k === -1) return 'hier';
  if (k > 1 && k < 7) return JOURS[dow(iso)];
  return fmtDate(iso, 'wdm');
}
export function age(birth, at = todayISO()) {
  if (!birth) return null;
  const [by, bm, bd] = birth.split('-').map(Number), [y, m, d] = at.split('-').map(Number);
  let a = y - by; if (m < bm || (m === bm && d < bd)) a--; return a;
}

// ───────────── Jours fériés & vacances scolaires ─────────────
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${pad(month)}-${pad(day)}`;
}
const _fer = {};
export function feriesFR(y) {
  if (_fer[y]) return _fer[y];
  const e = easter(y);
  return (_fer[y] = {
    [`${y}-01-01`]: "Jour de l'an", [addDays(e, 1)]: 'Lundi de Pâques', [`${y}-05-01`]: 'Fête du travail',
    [`${y}-05-08`]: '8 mai 1945', [addDays(e, 39)]: 'Ascension', [addDays(e, 50)]: 'Lundi de Pentecôte',
    [`${y}-07-14`]: 'Fête nationale', [`${y}-08-15`]: 'Assomption', [`${y}-11-01`]: 'Toussaint',
    [`${y}-11-11`]: 'Armistice', [`${y}-12-25`]: 'Noël',
  });
}
export function ferieName(iso) { return feriesFR(+iso.slice(0, 4))[iso] || null; }

// Calendrier officiel (Éducation nationale) — début = 1er jour sans classe, fin = veille de la reprise
const P = (id, n, i, s, e, kind = 'vac') => ({ id, n, i, s, e, kind });
const COMMON = [
  P('noel25', 'Vacances de Noël', '🎄', '2025-12-20', '2026-01-04'),
  P('asc26', "Pont de l'Ascension", '⭐', '2026-05-14', '2026-05-17', 'pont'),
  P('ete26', "Vacances d'été", '☀️', '2026-07-04', '2026-08-31', 'ete'),
  P('tou26', 'Vacances de la Toussaint', '🎃', '2026-10-17', '2026-11-01'),
  P('noel26', 'Vacances de Noël', '🎄', '2026-12-19', '2027-01-03'),
  P('asc27', "Pont de l'Ascension", '⭐', '2027-05-06', '2027-05-09', 'pont'),
  P('ete27', "Vacances d'été", '☀️', '2027-07-03', '2027-09-01', 'ete'),
  P('tou27', 'Vacances de la Toussaint', '🎃', '2027-10-23', '2027-11-07'),
  P('noel27', 'Vacances de Noël', '🎄', '2027-12-18', '2028-01-02'),
  P('asc28', "Pont de l'Ascension", '⭐', '2028-05-25', '2028-05-28', 'pont'),
  P('ete28', "Vacances d'été", '☀️', '2028-07-04', '2028-08-31', 'ete'),
];
const ZONED = {
  A: [P('hiv26', "Vacances d'hiver", '⛄', '2026-02-07', '2026-02-22'), P('pri26', 'Vacances de printemps', '🌼', '2026-04-04', '2026-04-19'),
    P('hiv27', "Vacances d'hiver", '⛄', '2027-02-13', '2027-02-28'), P('pri27', 'Vacances de printemps', '🌼', '2027-04-10', '2027-04-25'),
    P('hiv28', "Vacances d'hiver", '⛄', '2028-02-19', '2028-03-05'), P('pri28', 'Vacances de printemps', '🌼', '2028-04-22', '2028-05-08')],
  B: [P('hiv26', "Vacances d'hiver", '⛄', '2026-02-14', '2026-03-01'), P('pri26', 'Vacances de printemps', '🌼', '2026-04-11', '2026-04-26'),
    P('hiv27', "Vacances d'hiver", '⛄', '2027-02-20', '2027-03-07'), P('pri27', 'Vacances de printemps', '🌼', '2027-04-17', '2027-05-02'),
    P('hiv28', "Vacances d'hiver", '⛄', '2028-02-05', '2028-02-20'), P('pri28', 'Vacances de printemps', '🌼', '2028-04-08', '2028-04-23')],
  C: [P('hiv26', "Vacances d'hiver", '⛄', '2026-02-21', '2026-03-08'), P('pri26', 'Vacances de printemps', '🌼', '2026-04-18', '2026-05-03'),
    P('hiv27', "Vacances d'hiver", '⛄', '2027-02-06', '2027-02-21'), P('pri27', 'Vacances de printemps', '🌼', '2027-04-03', '2027-04-18'),
    P('hiv28', "Vacances d'hiver", '⛄', '2028-02-12', '2028-02-27'), P('pri28', 'Vacances de printemps', '🌼', '2028-04-15', '2028-05-01')],
};
export const RENTREES = { 2026: '2026-09-01', 2027: '2027-09-02' };
export const ACADEMIES = {
  A: 'Besançon, Bordeaux, Clermont-Ferrand, Dijon, Grenoble, Limoges, Lyon, Poitiers',
  B: "Aix-Marseille, Amiens, Caen, Lille, Nancy-Metz, Nantes, Nice, Orléans-Tours, Reims, Rennes, Rouen, Strasbourg",
  C: 'Créteil, Montpellier, Paris, Toulouse, Versailles',
};
export function schoolHolidays(zone = 'B', custom = []) {
  const list = [...COMMON, ...(ZONED[zone] || ZONED.B), ...custom.map(c => ({ ...c, kind: c.kind || 'perso', i: c.i || '📌' }))];
  return list.sort((x, y) => x.s.localeCompare(y.s));
}
export function holidayAt(iso, zone, custom) { return schoolHolidays(zone, custom).find(p => p.s <= iso && iso <= p.e) || null; }

// ───────────── Codes ─────────────
export const first = c => (c === 'A' || c === 'a' || c === 'X') ? 'A' : (c === 'B' || c === 'b' || c === 'Y') ? 'B' : null;
export const last = c => (c === 'A' || c === 'a' || c === 'Y') ? 'A' : (c === 'B' || c === 'b' || c === 'X') ? 'B' : null;
export const isHalf = c => c === 'X' || c === 'Y';
export const isDefault = c => c === 'a' || c === 'b';
export const other = p => p === 'A' ? 'B' : 'A';
export function swapCode(c) { return ({ A: 'B', B: 'A', a: 'b', b: 'a', X: 'Y', Y: 'X' })[c] || c; }
/** Convertit un code "imporé" K/J/k/j/X/Y vers A/B selon que KA = parent A ou B */
export function mapKJ(str, kaIs = 'A') {
  const m = kaIs === 'A' ? { K: 'A', J: 'B', k: 'a', j: 'b', X: 'X', Y: 'Y' } : { K: 'B', J: 'A', k: 'b', j: 'a', X: 'Y', Y: 'X' };
  let o = ''; for (const ch of str) o += m[ch] || '.'; return o;
}

// ───────────── Moteur ─────────────
/** Aïd el-Fitr, Aïd el-Kébir… : fête musulmane (pas un jour férié en France) */
export const isEid = s => /\b(a[iï]d|eid)\b/i.test(String(s || ''));
/** Horaire régulier du matin (avant midi) : le relais a lieu le jour choisi, la garde de la veille se prolonge jusque-là */
export const isMorningRule = r => !!r?.time && t2m(r.time) < 12 * 60;
/**
 * @param {object} o
 *  plannings : [{id, childIds, start, days, end?, state, createdAt, comments?, feries?}]
 *  exchanges : [{id, childIds, changes:[{d,to}], timeChange?:{d,time,place}, state, decidedAt}]
 *  settings  : {handoverTime:'18:30', middayTime:'14:00', zone:'B', customHolidays:[]}
 */
export function makeEngine({ plannings = [], exchanges = [], settings = {} } = {}) {
  const HT = t2m(settings.handoverTime || '18:30');
  const MID = t2m(settings.middayTime || '14:00');
  const active = plannings.filter(p => p.state === 'active' && p.days && p.start)
    .map(p => ({ ...p, n0: d2n(p.start), nEnd: Math.min(d2n(p.start) + p.days.length - 1, p.end ? d2n(p.end) : Infinity) }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // plus récent d'abord : il remplace l'ancien
  const byChild = new Map();
  for (const p of active) for (const c of p.childIds || []) { if (!byChild.has(c)) byChild.set(c, []); byChild.get(c).push(p); }
  // échanges acceptés → surcharges (le plus récemment validé l'emporte)
  const ov = new Map(), tov = new Map(), tovM = new Map(), ovSrc = new Map();
  [...exchanges].filter(x => x.state === 'accepted').sort((a, b) => (a.decidedAt || 0) - (b.decidedAt || 0)).forEach(x => {
    for (const c of x.childIds || []) {
      if (!ov.has(c)) { ov.set(c, new Map()); tov.set(c, new Map()); tovM.set(c, new Map()); }
      for (const ch of x.changes || []) { ov.get(c).set(ch.d, ch.to); ovSrc.set(c + '|' + ch.d, x.id); }
      // horaires convenus : un seul (échange d'horaire) ou plusieurs (début et fin d'un échange de jours)
      for (const tc of [...(x.timeChange?.d ? [x.timeChange] : []), ...(x.timeChanges || [])]) {
        if (!tc?.d) continue;
        const m = tc.morning ? tovM.get(c) : tov.get(c); // relais du matin (jour même) ou du soir / de mi-journée
        if (tc.reset) m.delete(tc.d); // retour à l'horaire habituel
        else m.set(tc.d, { time: tc.time, place: tc.place || '', midday: !!tc.midday });
      }
    }
  });
  const comments = {}, feries = {};
  for (const p of active) {
    Object.assign(comments, p.comments || {});
    for (const f of p.feries || []) feries[f] = (p.comments && p.comments[f]) || ferieName(f) || 'Férié';
  }
  const holidays = schoolHolidays(settings.zone || 'B', settings.customHolidays || []);
  const rules = (settings.relayRules || []).filter(r => r && r.time);
  const ruleCache = new Map();
  /** Précision d'une règle pour un jour donné (-1 : ne s'applique pas) ; year = année scolaire (sept. → août) */
  function dayRank(r, day) {
    if (r.year && !(day >= `${r.year}-09-01` && day <= `${+r.year + 1}-08-31`)) return -1;
    if (r.kind === 'date') return r.date === day ? 3 : -1;
    if (r.kind === 'vacStart') return holidays.some(h => h.kind !== 'pont' && addDays(h.s, -1) === day) ? 2 : -1;
    if (r.kind === 'vacEnd') return holidays.some(h => h.kind !== 'pont' && h.e === day) ? 2 : -1;
    if (r.kind === 'dow') return dow(day) === +r.dow && (+r.every !== 2 || ((isoWeek(day).week % 2 === 0) === (r.parity === 'pair')))
      && (!r.school || !holidays.some(h => h.s <= day && day <= h.e)) ? 1 : -1;
    return -1;
  }
  /**
   * Horaire régulier du relais entre le jour iso et le lendemain, de « from » vers « to » (le plus précis l'emporte).
   * Avant midi, c'est un relais du matin : il a lieu le jour choisi (ex. lundi 8h20 à l'école), la garde de la veille se prolonge.
   */
  function ruleFor(iso, from, to) {
    const key = iso + from + to; if (ruleCache.has(key)) return ruleCache.get(key);
    let best = null, rank = -1;
    for (const r of rules) {
      if ((r.to && r.to !== to) || (r.from && r.from !== from)) continue;
      const rk = dayRank(r, isMorningRule(r) ? addDays(iso, 1) : iso);
      if (rk < 0) continue;
      const rk2 = rk + (r.year ? 0.5 : 0) + (r.from || r.to ? 0.25 : 0);
      if (rk2 > rank) { best = r; rank = rk2; }
    }
    ruleCache.set(key, best);
    return best;
  }

  function planningAt(child, iso) {
    const n = d2n(iso);
    for (const p of byChild.get(child) || []) if (n >= p.n0 && n <= p.nEnd) return p;
    return null;
  }
  function baseCode(child, iso) {
    const p = planningAt(child, iso); if (!p) return '.';
    return p.days[d2n(iso) - p.n0] || '.';
  }
  function code(child, iso) {
    const o = ov.get(child); if (o && o.has(iso)) return o.get(iso);
    return baseCode(child, iso);
  }
  function isOverridden(child, iso) { const o = ov.get(child); return !!(o && o.has(iso)); }
  /**
   * Relais entre le jour iso et le lendemain : horaire convenu (échange) > horaire régulier (règle) > horaire habituel du soir.
   * date : jour où il a lieu (iso le soir, le lendemain pour un relais du matin).
   */
  function handoverInfo(child, iso) {
    const t = tov.get(child)?.get(iso), nx = addDays(iso, 1);
    if (t && !t.midday && t.time) return { date: iso, min: t2m(t.time), place: t.place || '', custom: true, rule: null };
    const tm = tovM.get(child)?.get(nx);
    if (tm && tm.time) return { date: nx, min: t2m(tm.time), place: tm.place || '', custom: true, rule: null, morning: true };
    const a = last(code(child, iso)), b = first(code(child, nx));
    if (a && b && a !== b) {
      const r = ruleFor(iso, a, b);
      if (r) { const mo = isMorningRule(r); return { date: mo ? nx : iso, min: t2m(r.time), end: r.timeEnd || '', place: r.place || '', dropPlace: r.dropPlace || '', custom: false, rule: r, morning: mo }; }
    }
    return { date: iso, min: HT, place: '', custom: false, rule: null };
  }
  function handoverMin(child, iso) { const h = handoverInfo(child, iso); return h.date === iso ? h.min : Infinity; }
  function middayMin(child, iso) { const t = tov.get(child)?.get(iso); return t && t.midday && t.time ? t2m(t.time) : MID; }
  /** Parent ('A'|'B'|null) qui a l'enfant à un instant donné */
  function presence(child, iso, min) {
    // relais du matin : la garde de la veille continue jusqu'à l'heure du relais
    const pv = addDays(iso, -1), pa = last(code(child, pv)), cb = first(code(child, iso));
    if (pa && cb && pa !== cb) { const h = handoverInfo(child, pv); if (h.date === iso && min < h.min) return pa; }
    if (min >= handoverMin(child, iso)) return first(code(child, addDays(iso, 1)));
    const c = code(child, iso);
    if (c === 'X') return min < middayMin(child, iso) ? 'A' : 'B';
    if (c === 'Y') return min < middayMin(child, iso) ? 'B' : 'A';
    return first(c);
  }
  /** Relais entre deux dates incluses, regroupés si plusieurs enfants au même moment */
  function handovers(childIds, from, to) {
    const out = new Map();
    for (const iso of eachDay(addDays(from, -1), to)) { // la veille : un relais du matin du 1er jour
      const nx = addDays(iso, 1);
      for (const ch of childIds) {
        const c = code(ch, iso), n = code(ch, nx);
        if (isHalf(c) && iso >= from) push(out, iso, m2t(middayMin(ch, iso)), first(c), last(c), ch, 'midi', !!tov.get(ch)?.get(iso)?.midday);
        const a = last(c), b = first(n);
        if (a && b && a !== b) {
          const info = handoverInfo(ch, iso); if (info.date < from || info.date > to) continue;
          push(out, info.date, m2t(info.min), a, b, ch, info.morning ? 'matin' : 'soir', info.custom, info.place, !!info.rule, info);
        }
      }
    }
    return [...out.values()].sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  }
  function push(out, date, time, from, to, ch, kind, custom, place = '', regular = false, info = null) {
    const k = `${date}|${time}|${from}|${to}`;
    if (!out.has(k)) out.set(k, { date, time, from, to, childIds: [], kind, custom, place, regular, timeEnd: info?.end || '', dropPlace: info?.dropPlace || '', alt: info?.rule?.alt?.on ? info.rule.alt : null });
    const h = out.get(k); h.childIds.push(ch); if (custom) h.custom = true; if (place) h.place = place; if (regular) h.regular = true;
  }
  function nextHandovers(childIds, iso = todayISO(), min = nowMin(), count = 3, horizon = 120) {
    return handovers(childIds, iso, addDays(iso, horizon)).filter(h => h.date > iso || t2m(h.time) > min).slice(0, count);
  }
  /** Périodes contiguës chez un même parent (pour listes et exports) */
  function blocks(child, from, to) {
    const res = []; let cur = null;
    for (const iso of eachDay(from, to)) {
      const c = code(child, iso), key = c === '.' ? '.' : (isHalf(c) ? c : (isDefault(c) ? c : c));
      if (cur && cur.key === key) { cur.end = iso; cur.n++; }
      else { if (cur) res.push(cur); cur = { key, code: c, start: iso, end: iso, n: 1 }; }
    }
    if (cur) res.push(cur);
    return res;
  }
  /** Bilan annuel (règle du planning : jours d'école par défaut non comptés, demi-journées = ½) */
  function stats(child, year, from = `${year}-01-01`, to = `${year}-12-31`) {
    const s = { A: 0, B: 0, defA: 0, defB: 0, half: 0, none: 0, nightsA: 0, nightsB: 0, vacA: 0, vacB: 0, weA: 0, weB: 0 };
    for (const iso of eachDay(from, to)) {
      const c = code(child, iso);
      if (c === 'A') s.A++; else if (c === 'B') s.B++;
      else if (c === 'a') s.defA++; else if (c === 'b') s.defB++;
      else if (isHalf(c)) { s.A += .5; s.B += .5; s.half++; } else s.none++;
      const night = presence(child, iso, 1439); if (night === 'A') s.nightsA++; else if (night === 'B') s.nightsB++;
      const p = first(c), h = holidays.find(x => x.s <= iso && iso <= x.e && x.kind !== 'pont');
      if (h && p) s['vac' + p]++;
      if (dow(iso) >= 5 && p) s['we' + p]++;
    }
    return s;
  }
  /** Jour : férié (jour légal) ou Aïd (fête musulmane, ce n'est pas un jour férié), commentaire, vacances */
  function dayInfo(iso) {
    const f = feries[iso] || ferieName(iso) || null, eid = !!f && isEid(f);
    return {
      ferie: eid ? null : f,
      eid: eid ? f : null,
      comment: comments[iso] || (eid ? f : null),
      holiday: holidays.find(p => p.s <= iso && iso <= p.e) || null,
    };
  }
  function coverage(child) {
    const ps = byChild.get(child) || []; if (!ps.length) return null;
    return { from: n2d(Math.min(...ps.map(p => p.n0))), to: n2d(Math.max(...ps.map(p => p.nEnd))) };
  }
  return { code, baseCode, isOverridden, planningAt, presence, handovers, nextHandovers, blocks, stats, dayInfo, coverage, holidays, HT, MID, ovSrc, handoverInfo, ruleFor };
}

// ───────────── Générateur de rythmes (assistant planning) ─────────────
export const RHYTHMS = [
  { id: 'alt1', icon: '🔁', n: 'Une semaine sur deux', d: 'Alternance 7 jours / 7 jours (50/50)', pattern: 'AAAAAAABBBBBBB', dayPick: true },
  { id: '223', icon: '🔀', n: '2-2-3', d: '2 jours / 2 jours / 3 jours, cycle de 2 semaines (50/50)', pattern: 'AABBAAABBAABBB' },
  { id: '2255', icon: '🧩', n: '2-2-5-5', d: 'Lun-mar chez l\'un, mer-jeu chez l\'autre, week-ends alternés (50/50)', pattern: 'AABBAAAAABBBBB' },
  { id: '3443', icon: '📐', n: '3-4-4-3', d: '3 jours / 4 jours puis 4 jours / 3 jours (50/50)', pattern: 'AAABBBBAAAABBB' },
  { id: 'we2', icon: '🏡', n: 'Un week-end sur deux', d: 'Résidence chez un parent, un week-end sur deux chez l\'autre', pattern: 'aaaaaBBaaaaaaa', resident: true },
  { id: 'we2w', icon: '🏡', n: 'Un week-end sur deux + mercredi', d: 'Comme ci-dessus + tous les mercredis', pattern: 'aaBaaBBaaBaaaa', resident: true },
  { id: 'we2l', icon: '🏡', n: 'Un week-end sur deux prolongé', d: 'Week-end du vendredi au lundi', pattern: 'aaaaBBBBaaaaaa', resident: true },
  { id: 'we135', icon: '🗓️', n: '1er, 3e et 5e week-ends', d: 'Week-ends impairs du mois chez l\'autre parent', special: 'we135', resident: true },
  { id: 'excl', icon: '🏠', n: 'Résidence exclusive', d: 'Les enfants vivent chez un seul parent', pattern: 'aaaaaaa', resident: true },
  { id: 'custom', icon: '✏️', n: 'Personnalisé', d: 'Cochez vous-même les jours sur 1 à 4 semaines', pattern: 'AAAAAAABBBBBBB', custom: true },
];
/**
 * cfg = { start, end, pattern, parity:'pair'|'impair', shift:0..6, special?, swap?:bool,
 *         vac:{ mode:'none'|'halves'|'weeks'|'alternate', summer:'halves'|'months', firstEven:'A'|'B',
 *               periods:[{s,e,n,kind, assign:'auto'|'A'|'B'|'rythme'}] },
 *         feries:'rythme'|'pont' }
 */
export function generateDays(cfg) {
  const start = cfg.start, end = cfg.end || addDays(start, 365 * 2);
  const n0 = d2n(start), nE = d2n(end);
  // ancre : lundi de la semaine de début, décalée pour respecter la parité choisie
  // la parité s'apprécie sur la 1re semaine complète (lundi suivant si le début n'est pas un lundi),
  // puis l'alternance est continue (gère les années à 53 semaines comme 2026)
  const refMon = dow(start) === 0 ? start : addDays(mondayOf(start), 7);
  let anchor = d2n(refMon);
  const wk = isoWeek(refMon).week, wantOdd = cfg.parity === 'impair';
  if (cfg.pattern && cfg.pattern.length >= 14 && ((wk % 2 === 1) !== wantOdd)) anchor -= 7;
  anchor += (cfg.shift || 0);
  const L = cfg.pattern ? cfg.pattern.length : 7;
  let out = new Array(nE - n0 + 1);
  for (let n = n0; n <= nE; n++) {
    let c;
    if (cfg.special === 'we135') {
      const iso = n2d(n), w = dow(iso), base = cfg.pattern ? cfg.pattern[0] : 'a';
      const sat = w === 5 ? iso : w === 6 ? addDays(iso, -1) : null;
      if (sat) { const k = Math.ceil(+sat.slice(8) / 7); c = (k % 2 === 1) ? (first(base) === 'A' ? 'B' : 'A') : base; } else c = base;
    } else c = cfg.pattern[((n - anchor) % L + L) % L];
    out[n - n0] = cfg.swap ? swapCode(c) : c;
  }
  const at = iso => out[d2n(iso) - n0];
  const set = (iso, c) => { const k = d2n(iso) - n0; if (k >= 0 && k < out.length) out[k] = c; };
  // jours fériés : rattachés au week-end voisin (lundi → week-end précédent, vendredi → suivant)
  if (cfg.feries === 'pont') {
    for (let y = +start.slice(0, 4); y <= +end.slice(0, 4); y++) for (const f of Object.keys(feriesFR(y))) {
      if (f < start || f > end) continue;
      const w = dow(f); // 0 lun … 4 ven
      const weParent = iso => { const p = at(iso); return p && !isDefault(p) ? p : null; };
      if (w === 0) { const p = weParent(addDays(f, -1)); if (p) set(f, p); }                       // lundi → week-end précédent
      else if (w === 3 && feriesFR(+f.slice(0, 4))[f] === 'Ascension') { const p = weParent(addDays(f, 2)); if (p) { set(f, p); set(addDays(f, 1), p); } } // pont de l'Ascension
      else if (w === 4) { const p = weParent(addDays(f, 1)); if (p) set(f, p); }                     // vendredi → week-end suivant
    }
  }
  // vacances scolaires
  const v = cfg.vac || { mode: 'none' };
  if (v.mode && v.mode !== 'none') {
    const periods = (v.periods || []).filter(p => p.e >= start && p.s <= end).sort((a, b) => a.s.localeCompare(b.s));
    let alt = 0;
    for (const p of periods) {
      const assign = p.assign || 'auto';
      if (assign === 'rythme') continue;
      const y = +p.s.slice(0, 4), even = y % 2 === 0;
      const fp = even ? (v.firstEven || 'A') : other(v.firstEven || 'A');
      const len = diffDays(p.s, p.e) + 1;
      const fill = (a, b, who) => { for (const iso of eachDay(a, b)) set(iso, who); };
      if (assign === 'A' || assign === 'B') { fill(p.s, p.e, assign); continue; }
      if (p.kind === 'pont' || len <= 5) { // pont : suit le parent du week-end inclus
        let who = null; for (const iso of eachDay(p.s, p.e)) if (dow(iso) >= 5 && at(iso) && !isDefault(at(iso))) { who = first(at(iso)); break; }
        if (!who) who = fp; fill(p.s, p.e, who); continue;
      }
      if (v.mode === 'alternate') { fill(p.s, p.e, alt % 2 === 0 ? fp : other(fp)); alt++; continue; }
      if (v.mode === 'weeks') { let k = 0; for (let s = p.s; s <= p.e; s = addDays(s, 7), k++) fill(s, addDays(s, 6) > p.e ? p.e : addDays(s, 6), k % 2 === 0 ? fp : other(fp)); continue; }
      // moitié / moitié
      let mid;
      if (p.kind === 'ete' && v.summer === 'months') mid = `${y}-07-31`;
      else mid = addDays(p.s, Math.floor(len / 2) - 1);
      fill(p.s, mid, fp); fill(addDays(mid, 1), p.e, other(fp));
    }
  }
  return out.join('');
}
export function patternShare(str, countedOnly = false) {
  let a = 0, b = 0;
  for (const c of str) { if (countedOnly && isDefault(c)) continue; if (first(c) === 'A' && !isHalf(c)) a++; else if (first(c) === 'B' && !isHalf(c)) b++; else if (isHalf(c)) { a += .5; b += .5; } }
  const t = a + b || 1; return { A: Math.round(a * 100 / t), B: Math.round(b * 100 / t) };
}

// ───────────── Événements récurrents ─────────────
/** Type de répétition d'un événement (anciens événements : champ « repeat ») */
/** Jours de la semaine d'un événement hebdomadaire (0 = lundi) : plusieurs jours possibles */
export function evDays(e) { return [...new Set((Array.isArray(e.dows) && e.dows.length ? e.dows : [e.dow ?? dow(e.date)]).map(Number))].sort((a, b) => a - b); }
/** Vacances : 'yes' (séances maintenues), 'no' (période scolaire seulement), 'w1' (1re semaine des vacances seulement) */
export function evHol(e) { return !e.school ? 'yes' : e.holW1 ? 'w1' : 'no'; }
export function evKind(e) {
  if (e.kind) return e.kind;
  const r = e.repeat || 'none';
  return r === 'none' ? 'date' : r;
}
/**
 * Occurrences des événements entre from et to.
 * Conditions des relais habituels : chaque semaine / semaines paires ou impaires (jour, période scolaire seulement),
 * veille des vacances, fin des vacances, une date ; plus celles des événements : plusieurs jours, chaque mois, chaque année.
 * L'année scolaire (sept. → août) limite les répétitions. settings : zone et vacances personnalisées.
 */
export function expandEvents(events, from, to, settings = null) {
  const out = [];
  let hol = null; const H = () => hol || (hol = schoolHolidays(settings?.zone || 'B', settings?.customHolidays || []));
  for (const e of events) {
    if (!e.date) continue;
    let until = e.until && e.until < to ? e.until : to;
    let lo = from;
    if (e.year) { const ys = `${e.year}-09-01`, ye = `${+e.year + 1}-08-31`; if (ye < until) until = ye; if (ys > lo) lo = ys; }
    const ex = new Set(e.exceptions || []);
    const add = iso => { if (iso >= lo && iso <= until && !ex.has(iso)) out.push({ ...e, occ: iso }); };
    const k = evKind(e);
    if (k === 'date') { add(e.date); if (e.endDate && e.endDate > e.date) for (const iso of eachDay(addDays(e.date, 1), e.endDate)) add(iso); continue; }
    if (e.date > until) continue;
    if (k === 'dow') {
      // à partir de la date de début, le(s) jour(s) choisi(s), une semaine sur deux (paire / impaire) si demandé ;
      // vacances scolaires : séances maintenues, supprimées (school) ou seulement la 1re semaine (school + holW1)
      const d0 = e.date > lo ? e.date : lo;
      for (const wd of evDays(e)) {
        let iso = addDays(d0, (wd - dow(d0) + 7) % 7);
        for (; iso <= until; iso = addDays(iso, 7)) {
          if (+e.every === 2 && ((isoWeek(iso).week % 2 === 0) !== (e.parity !== 'impair'))) continue;
          if (e.school) { const h = H().find(h => h.s <= iso && iso <= h.e); if (h && !(e.holW1 && iso <= addDays(h.s, 6))) continue; }
          add(iso);
        }
      }
    } else if (k === 'vacStart' || k === 'vacEnd') {
      for (const h of H()) {
        if (h.kind === 'pont') continue;
        const iso = k === 'vacStart' ? addDays(h.s, -1) : h.e;
        if (iso >= e.date) add(iso);
      }
    } else if (k === 'weekly' || k === 'biweekly') {
      const step = k === 'weekly' ? 7 : 14;
      let n = Math.max(0, Math.ceil(diffDays(e.date, lo) / step));
      for (let iso = addDays(e.date, n * step); iso <= until; iso = addDays(iso, step)) add(iso);
    } else if (k === 'monthly') {
      const [y0, m0, d0] = e.date.split('-').map(Number);
      for (let i = 0; i < 400; i++) {
        const m = (m0 - 1 + i) % 12 + 1, y = y0 + Math.floor((m0 - 1 + i) / 12);
        if (d0 > monthDays(y, m)) continue;
        const iso = `${y}-${pad(m)}-${pad(d0)}`; if (iso > until) break; add(iso);
      }
    } else if (k === 'yearly') {
      const [y0, m0, d0] = e.date.split('-').map(Number);
      for (let y = Math.max(y0, +lo.slice(0, 4)); y <= +until.slice(0, 4); y++) add(`${y}-${pad(m0)}-${pad(d0)}`);
    }
  }
  return out.sort((a, b) => (a.occ + (a.time || '')).localeCompare(b.occ + (b.time || '')));
}

/**
 * État de chaque séance : evx = { 'idEvénement_date': { type: 'absent' | 'match', cause, child, time, timeEnd, place } }.
 * Chaque occurrence reçoit .x (son état). Les matchs qui remplacent une séance sont ajoutés comme occurrences (.match).
 */
export const evxKey = (id, iso) => `${id}_${iso}`;
export function withStatus(occs, evx = {}) {
  const out = [];
  for (const o of occs) {
    const x = evx[evxKey(o.id, o.occ)] || null;
    out.push(x ? { ...o, x } : o);
    if (x?.type === 'match') out.push({ id: o.id, src: o, match: true, x, occ: o.occ, title: 'Match de foot', icon: '⚽', cat: 'activite', childIds: x.child ? [x.child] : (o.childIds || []), time: x.time || '', timeEnd: x.timeEnd || '', place: x.place || '', dropPlace: x.place || '', pickPlace: x.place || '', kind: 'date', date: o.occ });
  }
  return out.sort((a, b) => (a.occ + (a.time || '')).localeCompare(b.occ + (b.time || '')));
}
/** Séances qui ont vraiment lieu (sans absences ni séances remplacées par un match), matchs compris */
export const activeOccs = occs => occs.filter(o => !o.x || o.match);
/** Durée d'une séance en minutes (0 si toute la journée) */
export function occMinutes(o) { const a = o.time, b = o.timeEnd || o.endTime; return a && b && b > a ? t2m(b) - t2m(a) : 0; }
/**
 * Bilan des activités sur une période : par activité (même titre et mêmes enfants, tous jours confondus),
 * séances prévues, faites, à venir, absences, remplacées par un match ; heures faites et prévues. Les matchs à part.
 */
export function activityStats(events, evx, from, to, settings, now = { date: todayISO(), min: nowMin() }) {
  const occs = withStatus(expandEvents(events, from, to, settings), evx), G = new Map();
  const past = o => o.occ < now.date || (o.occ === now.date && t2m(o.timeEnd || o.endTime || o.time || '23:59') <= now.min);
  for (const o of occs) {
    const kids = [...(o.childIds || [])].sort().join(',');
    const key = o.match ? `match|${kids}` : `${String(o.title || '').trim().toLowerCase()}|${kids}`;
    const g = G.get(key) || { key, title: o.match ? 'Matchs de foot' : o.title, icon: o.icon || '📌', childIds: o.childIds || [], match: !!o.match, ids: new Set(), planned: 0, done: 0, todo: 0, absent: 0, matched: 0, minDone: 0, minAll: 0, causes: [] };
    g.ids.add(o.id); G.set(key, g);
    if (!o.match && o.x?.type === 'absent') { g.absent++; if (o.x.cause) g.causes.push({ d: o.occ, c: o.x.cause }); continue; }
    if (!o.match && o.x?.type === 'match') { g.matched++; continue; }
    const m = occMinutes(o); g.planned++; g.minAll += m;
    if (past(o)) { g.done++; g.minDone += m; } else g.todo++;
  }
  return [...G.values()].map(g => ({ ...g, ids: [...g.ids] })).sort((a, b) => (a.match - b.match) || a.childIds.join().localeCompare(b.childIds.join()) || a.title.localeCompare(b.title));
}
/** Périodes « de vacances à vacances » d'une année scolaire : rentrée → Toussaint, Toussaint → Noël, …, été */
export function schoolPeriods(year, zone = 'B', custom = []) {
  const ys = `${year}-09-01`, ye = `${year + 1}-08-31`;
  const hs = schoolHolidays(zone, custom).filter(h => h.kind !== 'pont' && h.s > ys && h.s <= ye).sort((a, b) => a.s.localeCompare(b.s));
  const nm = h => String(h.n || '').replace(/^Vacances (de la |de l'|d'|de |du )/i, '').replace(/^./, c => c.toUpperCase());
  const out = []; let start = ys, name = 'Rentrée';
  for (const h of hs) { out.push({ id: `${year}-${out.length}`, from: start, to: addDays(h.s, -1), n: `${name} → ${nm(h)}` }); start = h.s; name = nm(h); }
  out.push({ id: `${year}-${out.length}`, from: start, to: ye, n: name === 'Été' ? 'Été' : `${name} → fin août` });
  return out;
}

// ───────────── Export agenda (.ics) ─────────────
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const icsD = iso => iso.replace(/-/g, '');
function fold(line) { const out = []; let s = line; while (s.length > 72) { out.push(s.slice(0, 72)); s = ' ' + s.slice(72); } out.push(s); return out.join('\r\n'); }
export function buildICS({ engine, childIds, children, parents, from, to, events = [], withHandovers = true, withBlocks = true, alarmMin = 120, uidPrefix = 'sjf' }) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SJ Family//Planning//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:SJ Family', 'X-WR-TIMEZONE:Europe/Paris'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const names = ids => ids.map(id => children.find(c => c.id === id)?.prenom || '').filter(Boolean).join(' & ');
  if (withBlocks) for (const ch of childIds) for (const b of engine.blocks(ch, from, to)) {
    if (b.key === '.') continue;
    const who = isHalf(b.code) ? `${parents[first(b.code)].name} puis ${parents[last(b.code)].name}` : parents[first(b.code)].name;
    const sum = `${isDefault(b.code) ? '🏫' : '🏠'} ${names([ch])} chez ${who}${isDefault(b.code) ? ' (semaine)' : ''}`;
    L.push('BEGIN:VEVENT', `UID:${uidPrefix}-blk-${ch}-${b.start}@sjfamily`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsD(b.start)}`,
      `DTEND;VALUE=DATE:${icsD(addDays(b.end, 1))}`, fold(`SUMMARY:${icsEsc(sum)}`), 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  if (withHandovers) for (const h of engine.handovers(childIds, from, to)) {
    const [hh, mm] = h.time.split(':');
    const dt = `${icsD(h.date)}T${hh}${mm}00`;
    const endM = t2m(h.time) + 15, dte = `${icsD(h.date)}T${pad(Math.floor(endM / 60))}${pad(endM % 60)}00`;
    const sum = `🔁 Relais ${fmtTime(h.time)} : ${names(h.childIds)} → ${parents[h.to].name}`;
    L.push('BEGIN:VEVENT', `UID:${uidPrefix}-rel-${h.date}-${h.time.replace(':', '')}-${h.to}@sjfamily`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Paris:${dt}`, `DTEND;TZID=Europe/Paris:${dte}`, fold(`SUMMARY:${icsEsc(sum)}`),
      fold(`DESCRIPTION:${icsEsc(`Déposés par ${parents[h.from].name}${h.dropPlace ? ' (' + h.dropPlace + ')' : ''}, récupérés par ${parents[h.to].name}${h.place ? ' (' + h.place + ')' : ''}${h.timeEnd ? ' — entre ' + fmtTime(h.time) + ' et ' + fmtTime(h.timeEnd) : ''}`)}`));
    if (alarmMin) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${alarmMin}M`, fold(`DESCRIPTION:${icsEsc(sum)}`), 'END:VALARM');
    L.push('END:VEVENT');
  }
  for (const e of expandEvents(events, from, to)) {
    if (e.childIds && e.childIds.length && !e.childIds.some(id => childIds.includes(id))) continue;
    L.push('BEGIN:VEVENT', `UID:${uidPrefix}-ev-${e.id}-${e.occ}@sjfamily`, `DTSTAMP:${stamp}`);
    if (e.time) {
      const st = `${icsD(e.occ)}T${e.time.replace(':', '')}00`, en = e.endTime ? `${icsD(e.occ)}T${e.endTime.replace(':', '')}00` : null;
      L.push(`DTSTART;TZID=Europe/Paris:${st}`); if (en) L.push(`DTEND;TZID=Europe/Paris:${en}`);
    } else L.push(`DTSTART;VALUE=DATE:${icsD(e.occ)}`, `DTEND;VALUE=DATE:${icsD(addDays(e.occ, 1))}`);
    L.push(fold(`SUMMARY:${icsEsc((e.icon ? e.icon + ' ' : '') + e.title + (e.childIds?.length ? ' (' + names(e.childIds) + ')' : ''))}`));
    if (e.place) L.push(fold(`LOCATION:${icsEsc(e.place)}`));
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}

// ───────────── Flux des widgets (lu par l'app Android et Scriptable) ─────────────
export function buildFeed({ engine, family, children, parents, events = [], evx = {}, tasks = [], notes = [], includeHealth = false, today = todayISO(), appUrl, apk = 0 }) {
  const prevMonth = (() => { let [y, m] = today.split('-').map(Number); m--; if (m < 1) { m = 12; y--; } return `${y}-${pad(m)}-01`; })();
  // début du flux : jusqu'à un an en arrière (navigation ‹ › dans les widgets), au moins le mois précédent
  let from = mondayOf(prevMonth);
  for (const c of children) { const cv = engine.coverage(c.id); if (cv) { const f0 = cv.from > addDays(today, -366) ? cv.from : addDays(today, -366); if (f0 < from) from = f0; } }
  let maxTo = addDays(today, 30);
  for (const c of children) { const cv = engine.coverage(c.id); if (cv && cv.to > maxTo) maxTo = cv.to; }
  const to = maxTo > addDays(today, 400) ? addDays(today, 400) : maxTo;
  const ids = children.map(c => c.id);
  const feed = {
    v: 2, gen: Date.now(), app: appUrl, apk, family: family.name || 'SJ Family', start: from,
    ht: family.settings?.handoverTime || '18:30', mid: family.settings?.middayTime || '14:00',
    parents: { A: pick(parents.A), B: pick(parents.B) },
    children: children.map(c => {
      let days = ''; for (const iso of eachDay(from, to)) days += engine.code(c.id, iso);
      const info = { school: c.school || '', cls: c.cls || '', teacher: c.teacher || '', birth: c.birth || '' };
      if (includeHealth) Object.assign(info, { doctor: c.doctor || '', doctorPhone: c.doctorPhone || '', allergies: c.allergies || '', treatments: c.treatments || '', blood: c.blood || '' });
      return { id: c.id, name: c.prenom, emoji: c.emoji || '🧒', color: c.color || '', days, info };
    }),
    handovers: engine.handovers(ids, from, to).map(h => ({ d: h.date, t: h.time, f: h.from, to: h.to, k: h.childIds, p: h.place || '', m: h.kind === 'midi' ? 1 : 0, ...(h.kind === 'matin' ? { mo: 1 } : {}), ...(h.timeEnd ? { t2: h.timeEnd } : {}), ...(h.dropPlace ? { dp: h.dropPlace } : {}) })),
    events: activeOccs(withStatus(expandEvents(events, today, addDays(today, 45), family?.settings), evx)).slice(0, 60).map(e => ({ d: e.occ, t: e.time || '', t2: e.timeEnd || e.endTime || '', n: e.title, i: e.icon || '📌', k: e.childIds || [], w: e.place || '', dp: e.dropPlace || '', pp: e.kind ? e.pickPlace || '' : e.place || '', by: e.from || '', tk: e.to || '' })),
    tasks: tasks.filter(t => !t.done).slice(0, 10).map(t => ({ n: t.title, d: t.due || '', k: t.childIds || [] })),
    notes: notes.slice(0, 3).map(n => ({ x: String(n.text || '').slice(0, 140), at: n.at, by: n.byName || '', k: n.childIds || [] })),
    off: {},
  };
  feed.fer = {}; // 1 = jour férié (point rouge), 2 = fête de l'Aïd (croissant vert émeraude)
  for (const iso of eachDay(from, to)) { const i = engine.dayInfo(iso); const lbl = i.comment || i.ferie || i.eid; if (lbl) feed.off[iso] = lbl; if (i.ferie) feed.fer[iso] = 1; else if (i.eid) feed.fer[iso] = 2; }
  return feed;
}
function pick(p) { return p ? { name: p.name || '', short: p.name || '', color: p.color || '' } : null; } // widgets : prénom (jamais Papa / Maman)
