// SJF_WIDGET — SJ Family · widget iPhone pour l'app Scriptable (chargé automatiquement par le script « SJ Family »)
// Variables fournies par le chargeur : TOKEN, args, config
// Paramètre du widget : « Selman », « Jandal » ou « Tous », suivi éventuellement de « ;semaine », « ;mois », « ;programme » ou « ;garde »
const API = `https://firestore.googleapis.com/v1/projects/sj-family-dd337/databases/(default)/documents/widgets/${TOKEN}?key=AIzaSyDlyQZ-O5Xuko-jtIvhJSzlncg1eL9Icdg`;
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), 'sjfamily-feed.json');
const NAVY = new Color('#0B3D6E'), NAVY2 = new Color('#0F4C87'), WHITE = Color.white(), INK = new Color('#13233A');
const JL = ['L', 'M', 'M', 'J', 'V', 'S', 'D'], JC = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'], JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOC = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const addDays = (s, k) => { const d = parseISO(s); d.setDate(d.getDate() + k); return isoOf(d); };
const t2m = t => { const [h, m] = String(t || '18:30').split(':').map(Number); return h * 60 + (m || 0); };
const dow = s => (parseISO(s).getDay() + 6) % 7;
const fmtT = t => { const [h, m] = String(t).split(':'); return `${+h}h${m === '00' ? '' : m}`; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const first = c => 'AaX'.includes(c) ? 'A' : 'BbY'.includes(c) ? 'B' : null;
function rel(d, today) {
  const k = dayDiff(today, d);
  if (k === 0) return "aujourd'hui"; if (k === 1) return 'demain';
  if (k > 1 && k < 7) return JOURS[dow(d)];
  return `${JC[dow(d)]} ${+d.slice(8)} ${MOC[+d.slice(5, 7) - 1]}`;
}
function dimC(c) { const h = c.hex.replace('#', ''), n = parseInt(h.slice(0, 6), 16); const f = (x, y) => Math.round(x * 0.8 + y * 0.2); const r = f(n >> 16, 0x5A), g = f((n >> 8) & 255, 0x6B), b = f(n & 255, 0x80); return new Color('#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''), c.alpha); }
function mix(hex, k) { const n = parseInt(hex.replace('#', ''), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = x => Math.round(x + (255 - x) * k); return new Color('#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('')); }

async function loadFeed() {
  let feed = null;
  try {
    const r = new Request(API); r.timeoutInterval = 12;
    const j = await r.loadJSON();
    if (j && j.fields && j.fields.payload) { feed = JSON.parse(j.fields.payload.stringValue); fm.writeString(cachePath, JSON.stringify(feed)); }
    else if (j && j.error) console.log('Firestore : ' + j.error.message);
  } catch (e) { console.log('Réseau indisponible : ' + e); }
  if (!feed && fm.fileExists(cachePath)) { try { feed = JSON.parse(fm.readString(cachePath)); feed._offline = true; } catch (e) { /* */ } }
  return feed;
}

const _cellCache = {};
function pastCell(color, w, h) {
  const k = `${color.hex}-${w}-${h}`; if (_cellCache[k]) return _cellCache[k];
  const dc = new DrawContext(); dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = true;
  dc.setFillColor(color); dc.fillRect(new Rect(0, 0, w, h));
  const p = new Path(); p.move(new Point(0, h)); p.addLine(new Point(w, 0));
  dc.addPath(p); dc.setStrokeColor(new Color('#13233A', 0.55)); dc.setLineWidth(1.4); dc.strokePath();
  return (_cellCache[k] = dc.getImage());
}
const feed = await loadFeed();
const family = config.widgetFamily || 'medium';
const raw = String(args.widgetParameter || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
let who = raw[0] || 'tous', view = norm(raw[1] || '');
if (['semaine', 'mois', 'programme', 'garde'].includes(norm(who))) { view = norm(who); who = 'tous'; }

function errorWidget(msg) {
  const w = new ListWidget(); w.backgroundColor = NAVY;
  const t = w.addText('SJ Family'); t.font = Font.boldSystemFont(14); t.textColor = WHITE;
  w.addSpacer(6);
  const m = w.addText(msg); m.font = Font.systemFont(12); m.textColor = new Color('#ffffff', 0.85);
  return w;
}

let widget;
if (!feed) widget = errorWidget("Impossible de charger le planning. Vérifiez internet et le lien secret (SJ Family › Widgets).");
else {
  const now = new Date(), today = isoOf(now), nowM = now.getHours() * 60 + now.getMinutes();
  const P = feed.parents || {}, colA = (P.A && P.A.color) || '#9DC3E6', colB = (P.B && P.B.color) || '#F8CBAD';
  const all = feed.children || [];
  const kids = ['tous', 'all', 'les deux', '*', ''].includes(norm(who)) ? all : all.filter(c => norm(c.name).startsWith(norm(who)));
  const K = kids.length ? kids : all;
  const kidIds = K.map(k => k.id);
  const label = K.length === all.length && all.length > 1 ? (all.length === 2 ? all.map(c => c.name).join(' & ') : 'Les enfants') : K.map(c => c.name).join(' & ');
  const code = (c, d) => { const i = dayDiff(feed.start, d); return (c.days || '')[i] || '.'; };
  const evening = (c, d) => { const h = (feed.handovers || []).find(x => x.d === d && !x.m && (x.k || []).includes(c.id)); return h ? t2m(h.t) : t2m(feed.ht); };
  const presence = (c, d, m) => {
    if (m >= evening(c, d)) return first(code(c, addDays(d, 1)));
    const x = code(c, d), mid = t2m(feed.mid || '14:00');
    if (x === 'X') return m < mid ? 'A' : 'B'; if (x === 'Y') return m < mid ? 'B' : 'A';
    return first(x);
  };
  const short = p => (P[p] && (P[p].short || P[p].name)) || '—';
  const name = p => (P[p] && P[p].name) || '—';
  const colorOf = c => c === 'A' ? new Color(colA) : c === 'B' ? new Color(colB) : c === 'a' ? mix(colA, .55) : c === 'b' ? mix(colB, .55) : c === 'X' || c === 'Y' ? mix(c === 'X' ? colA : colB, .25) : new Color('#ffffff', 0.15);
  const nowWho = presence(K[0], today, nowM);
  const split = K.some(k => presence(k, today, nowM) !== nowWho);
  const hand = (feed.handovers || []).filter(h => (h.k || []).some(id => kidIds.includes(id)) && (h.d > today || (h.d === today && t2m(h.t) > nowM)));
  const next = hand[0];
  const nextDate = next ? (() => { const d = parseISO(next.d); d.setHours(Math.floor(t2m(next.t) / 60), t2m(next.t) % 60, 0, 0); return d; })() : null;
  const events = (feed.events || []).filter(e => !e.k.length || e.k.some(id => kidIds.includes(id)));
  const tasks = (feed.tasks || []).filter(t => !t.k.length || t.k.some(id => kidIds.includes(id)));
  const kidNames = ids => all.filter(c => ids.includes(c.id)).map(c => c.name).join(' & ');

  const W = new ListWidget();
  const g = new LinearGradient(); g.colors = [NAVY2, new Color('#0A3360')]; g.locations = [0, 1]; W.backgroundGradient = g;
  W.url = (feed.app || 'https://newboy7745.github.io/sj-family/') + '#/agenda';
  const txt = (stack, s, size, opts = {}) => { const t = stack.addText(s); t.font = opts.bold ? Font.boldSystemFont(size) : Font.systemFont(size); t.textColor = opts.color || WHITE; if (opts.op) t.textOpacity = opts.op; t.lineLimit = opts.lines || 1; t.minimumScaleFactor = opts.min || 0.7; return t; };
  const header = (title, right) => {
    const h = W.addStack(); h.layoutHorizontally(); h.centerAlignContent();
    txt(h, title.toUpperCase(), 11, { bold: true, op: 0.75 }); h.addSpacer();
    if (right) txt(h, right, 11, { bold: true, op: 0.9 });
    return h;
  };
  const dot = (stack, color, size = 12) => { const d = stack.addStack(); d.size = new Size(size, size); d.cornerRadius = size / 2; d.backgroundColor = color; return d; };
  const appUrl = feed.app || 'https://newboy7745.github.io/sj-family/';
  const dayUrl = d => `${appUrl}#/agenda?d=${d}`;
  /** compte à rebours qui avance tout seul (heures:minutes:secondes) */
  const timer = (stack, size = 12) => {
    if (!nextDate) return;
    const r = stack.addStack(); r.layoutHorizontally(); r.centerAlignContent();
    txt(r, '⏱', size - 1, { color: new Color('#FFE3B0') }); r.addSpacer(3);
    const d = r.addDate(nextDate); d.applyTimerStyle(); d.font = Font.boldMonospacedSystemFont(size); d.textColor = new Color('#FFE3B0'); d.lineLimit = 1;
  };
  const nextLine = (stack, size = 12, withTimer = true) => {
    if (!next) { txt(stack, 'Aucun relais prévu', size, { op: 0.8 }); return; }
    const r = stack.addStack(); r.layoutHorizontally(); r.centerAlignContent();
    txt(r, `🔁 ${cap(rel(next.d, today))} ${fmtT(next.t)} → ${short(next.to)}`, size, { bold: true });
    if (next.p) { r.addSpacer(4); txt(r, `(${next.p})`, size - 1, { op: 0.8 }); }
    if (withTimer && nextDate) { r.addSpacer(6); timer(r, size); }
  };
  const view2 = view || (family === 'small' ? 'garde' : family === 'large' || family === 'extraLarge' ? 'mois' : family.startsWith('accessory') ? 'garde' : 'semaine');

  if (family === 'accessoryInline') {
    W.addText(`${nowWho ? 'Chez ' + short(nowWho) : 'SJ Family'}${next ? ' · 🔁 ' + rel(next.d, today) + ' ' + fmtT(next.t) : ''}`);
  } else if (family === 'accessoryCircular') {
    W.addAccessoryWidgetBackground = true;
    const t = W.addText(nowWho ? short(nowWho).slice(0, 1) : '?'); t.font = Font.boldSystemFont(22); t.centerAlignText();
    if (next) { const s = W.addText(fmtT(next.t)); s.font = Font.systemFont(10); s.centerAlignText(); }
  } else if (family === 'accessoryRectangular') {
    const a = W.addText(`🏠 ${nowWho ? 'Chez ' + short(nowWho) : 'Pas de planning'}`); a.font = Font.boldSystemFont(14);
    if (next) { const b = W.addText(`🔁 ${rel(next.d, today)} ${fmtT(next.t)} → ${short(next.to)}`); b.font = Font.systemFont(12); }
    const c = W.addText(label); c.font = Font.systemFont(11); c.textOpacity = 0.7;
  } else if (view2 === 'garde') {
    W.setPadding(14, 14, 12, 14);
    header(label);
    W.addSpacer(8);
    if (split) {
      for (const k of K) { const r = W.addStack(); r.centerAlignContent(); const p = presence(k, today, nowM); dot(r, colorOf(p), 10); r.addSpacer(6); txt(r, `${k.name} : ${p ? short(p) : '—'}`, 15, { bold: true }); W.addSpacer(3); }
    } else {
      txt(W, 'Actuellement chez', 11, { op: 0.75 });
      const r = W.addStack(); r.centerAlignContent(); dot(r, colorOf(nowWho), 14); r.addSpacer(7);
      txt(r, nowWho ? short(nowWho) : '—', 26, { bold: true, min: 0.5 });
    }
    W.addSpacer();
    nextLine(W, 12, false);
    timer(W, 13);
  } else if (view2 === 'semaine') {
    W.setPadding(12, 12, 10, 12);
    header(`${label} · semaine`, nowWho ? `Chez ${short(nowWho)}` : '');
    W.addSpacer(8);
    const row = W.addStack(); row.layoutHorizontally();
    const mon = addDays(today, -dow(today));
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i), c = code(K[0], d);
      const cell = row.addStack(); cell.layoutVertically(); cell.size = new Size(40, 46); cell.cornerRadius = 9; cell.backgroundColor = colorOf(c);
      if (d < today) { cell.backgroundColor = dimC(colorOf(c)); cell.backgroundImage = pastCell(dimC(colorOf(c)), 40, 46); }
      if (family !== 'small') cell.url = dayUrl(d);
      if (d === today) { cell.borderWidth = 2.5; cell.borderColor = WHITE; }
      cell.addSpacer(4);
      const l1 = cell.addStack(); l1.addSpacer(); txt(l1, JL[i], 10, { bold: true, color: INK }); l1.addSpacer();
      const l2 = cell.addStack(); l2.addSpacer(); txt(l2, String(+d.slice(8)), 15, { bold: true, color: INK }); l2.addSpacer();
      const ho = hand.some(h => h.d === d) || (feed.handovers || []).some(h => h.d === d && (h.k || []).some(id => kidIds.includes(id)));
      const l3 = cell.addStack(); l3.addSpacer(); txt(l3, ho ? '🔁' : ' ', 7, { color: INK }); l3.addSpacer();
      if (i < 6) row.addSpacer(4);
    }
    W.addSpacer(8);
    nextLine(W, 12);
    const ev = events.find(e => e.d >= today);
    if (ev) { W.addSpacer(2); txt(W, `${ev.i} ${cap(rel(ev.d, today))}${ev.t ? ' ' + fmtT(ev.t) : ''} · ${ev.n}`, 11, { op: 0.85 }); }
  } else if (view2 === 'mois') {
    W.setPadding(12, 12, 10, 12);
    const [y, m] = today.split('-').map(Number);
    { const h = W.addStack(); h.layoutHorizontally(); h.centerAlignContent();
      const tt = h.addStack(); tt.layoutVertically(); txt(tt, `${cap(MOIS[m - 1])} ${y}`, 15, { bold: true }); txt(tt, label, 11, { bold: true, color: new Color('#F1DFA8') });
      h.addSpacer(); if (nowWho) txt(h, `Chez ${short(nowWho)}`, 12, { bold: true }); }
    W.addSpacer(6);
    const hr = W.addStack(); hr.layoutHorizontally();
    JL.forEach((j, i) => { const s = hr.addStack(); s.size = new Size(40, 14); s.addSpacer(); txt(s, j, 9, { bold: true, op: 0.7 }); s.addSpacer(); if (i < 6) hr.addSpacer(4); });
    const first1 = `${y}-${pad(m)}-01`, start = addDays(first1, -dow(first1));
    const lastDay = new Date(y, m, 0).getDate(), weeks = Math.ceil((dow(first1) + lastDay) / 7);
    for (let wk = 0; wk < weeks; wk++) {
      W.addSpacer(3);
      const r = W.addStack(); r.layoutHorizontally();
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, wk * 7 + i), inM = +d.slice(5, 7) === m, c = code(K[0], d);
        const cell = r.addStack(); cell.size = new Size(40, weeks > 5 ? 24 : 28); cell.cornerRadius = 6; cell.centerAlignContent();
        cell.backgroundColor = inM ? colorOf(c) : new Color('#ffffff', 0.06);
        if (inM && d < today) { cell.backgroundColor = dimC(colorOf(c)); cell.backgroundImage = pastCell(dimC(colorOf(c)), 40, weeks > 5 ? 24 : 28); }
        if (inM) cell.url = dayUrl(d);
        if (d === today) { cell.borderWidth = 2; cell.borderColor = WHITE; }
        cell.addSpacer(); txt(cell, String(+d.slice(8)), 11, { bold: true, color: inM ? ((feed.off || {})[d] ? new Color('#C0392B') : INK) : new Color('#ffffff', 0.35) }); cell.addSpacer();
        if (i < 6) r.addSpacer(4);
      }
    }
    W.addSpacer(8);
    const lg = W.addStack(); lg.centerAlignContent(); dot(lg, new Color(colA), 9); lg.addSpacer(4); txt(lg, name('A'), 10, { op: 0.85 }); lg.addSpacer(10); dot(lg, new Color(colB), 9); lg.addSpacer(4); txt(lg, name('B'), 10, { op: 0.85 }); lg.addSpacer(10); dot(lg, mix(colB, .55), 9); lg.addSpacer(4); txt(lg, 'école', 10, { op: 0.85 });
    W.addSpacer(6);
    nextLine(W, 12);
    const ev = events.find(e => e.d >= today); if (ev) txt(W, `${ev.i} ${cap(rel(ev.d, today))}${ev.t ? ' ' + fmtT(ev.t) : ''} · ${ev.n}`, 11, { op: 0.85 });
  } else {
    // programme
    W.setPadding(12, 14, 10, 14);
    header(`Programme · ${label}`, nowWho ? `Chez ${short(nowWho)}` : '');
    W.addSpacer(8);
    const max = family === 'large' || family === 'extraLarge' ? 10 : 4;
    const items = [];
    for (const h of hand.slice(0, 3)) items.push({ k: h.d + h.t, s: `🔁 ${cap(rel(h.d, today))} ${fmtT(h.t)} · ${kidNames(h.k)} → ${name(h.to)}${h.p ? ' (' + h.p + ')' : ''}` });
    for (const e of events.filter(e => e.d >= today).slice(0, 8)) items.push({ k: e.d + (e.t || '00:00'), s: `${e.i} ${cap(rel(e.d, today))}${e.t ? ' ' + fmtT(e.t) : ''} · ${e.n}${e.k.length && K.length > 1 ? ' (' + kidNames(e.k) + ')' : ''}` });
    items.sort((a, b) => a.k.localeCompare(b.k));
    const lines = items.slice(0, max).map(i => i.s);
    for (const t of tasks.slice(0, 2)) if (lines.length < max) lines.push(`✅ ${t.n}${t.d ? ' · ' + rel(t.d, today) : ''}`);
    const note = (feed.notes || [])[0]; if (note && lines.length < max) lines.push(`📒 ${note.by} : ${note.x}`);
    if (!lines.length) lines.push('Rien de prévu pour le moment 🙂');
    for (const l of lines) { txt(W, l, 12, { lines: 1, min: 0.75 }); W.addSpacer(3); }
    W.addSpacer();
  }
  if (feed._offline && !family.startsWith('accessory')) { const o = W.addText('hors ligne'); o.font = Font.systemFont(8); o.textColor = WHITE; o.textOpacity = 0.5; }
  // prochaine actualisation : au prochain relais, à minuit, et au plus tard dans 1 h
  const mid = new Date(now); mid.setHours(24, 1, 0, 0);
  let nextRefresh = Math.min(mid.getTime(), now.getTime() + 3600000);
  if (nextDate && nextDate.getTime() > now.getTime()) nextRefresh = Math.min(nextRefresh, nextDate.getTime() + 60000);
  W.refreshAfterDate = new Date(nextRefresh);
  widget = W;

  // rappels locaux des prochains relais (2 h avant)
  try {
    const want = new Map();
    for (const h of (feed.handovers || []).filter(h => h.d >= today).slice(0, 4)) {
      const at = parseISO(h.d); at.setHours(Math.floor(t2m(h.t) / 60), t2m(h.t) % 60, 0, 0);
      const when = new Date(at.getTime() - 2 * 3600000); if (when <= now) continue;
      want.set(`sjf-${h.d}-${h.t}-${h.to}`, { when, title: `🔁 Relais ${rel(h.d, isoOf(when))} à ${fmtT(h.t)}`, body: `${kidNames(h.k)} : ${name(h.f)} → ${name(h.to)}${h.p ? ' — ' + h.p : ''}` });
    }
    const pending = await Notification.allPending();
    const stale = pending.filter(n => (n.identifier || '').startsWith('sjf-') && !want.has(n.identifier)).map(n => n.identifier);
    if (stale.length) Notification.removePending(stale);
    const have = new Set(pending.map(n => n.identifier));
    for (const [id, x] of want) {
      if (have.has(id)) continue;
      const n = new Notification(); n.identifier = id; n.threadIdentifier = 'sjfamily'; n.title = x.title; n.body = x.body; n.openURL = feed.app || '';
      n.setTriggerDate(x.when); await n.schedule();
    }
  } catch (e) { console.log('Rappels : ' + e); }
}

if (config.runsInWidget) Script.setWidget(widget);
else if (config.widgetFamily === undefined || config.runsInApp) {
  const f = family === 'small' ? 'presentSmall' : family === 'large' ? 'presentLarge' : 'presentMedium';
  await widget[f]();
}
Script.complete();
