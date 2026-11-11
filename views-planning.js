// ═══════════════ Plannings : liste, import 2026-2027, assistant 4 étapes, validation ═══════════════
import * as E from './engine.js?v=6.15';
import { SJ_PLANNINGS } from './sj-data.js?v=6.15';
import { S, engine, parents, pName, pShort, uid, myName, myCode, isParent, childName, childNames, settings, addItem, updItem, log, guard, fpath, go, needsValidation, setFamily } from './core.js?v=6.15';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, IC, promptBox } from './ui.js?v=6.15';
import { cellBg } from './views-home.js?v=6.15';

const ICONS = ['📅', '🗓️', '🏠', '🔁', '🏖️', '⭐', '🎒', '❤️', '🌙', '☀️'];
const STATE = { active: ['ok', 'Actif'], pending: ['warn', 'En attente de validation'], 'pending-archive': ['warn', 'Archivage demandé'], refused: ['err', 'Refusé'], archived: ['', 'Archivé'], cancelled: ['', 'Annulé'] };
const endOf = p => E.addDays(p.start, p.days.length - 1);

function planningCard(p) {
  const me = uid(), [cls, lbl] = STATE[p.state] || ['', p.state];
  const canDecide = isParent() && ((p.state === 'pending' && p.createdBy !== me) || (p.state === 'pending-archive' && p.archiveBy !== me));
  const share = E.patternShare(p.days.slice(0, 366), true);
  return `<div class="card"><div class="row gap"><div class="le" style="font-size:30px">${p.icon || '📅'}</div><div class="f1"><div class="b" style="font-size:18px">${esc(p.title)}</div>
    <div class="small muted">${esc(childNames(p.childIds))} · du ${E.fmtDate(p.start, 'num')} au ${E.fmtDate(endOf(p), 'num')}</div><span class="pill ${cls}" style="margin-top:5px">${lbl}</span></div></div>
    <div class="small muted mt">Créé par ${esc(p.createdByName || '—')}${p.validatedByName ? ` · validé par ${esc(p.validatedByName)} le ${new Date(p.validatedAt).toLocaleDateString('fr-FR')}` : ''}${p.source ? ' · plannings officiels' : ''}</div>
    ${p.refuseNote ? `<div class="small mt">Motif du refus : ${esc(p.refuseNote)}</div>` : ''}
    <div class="bar mt"><span style="width:${share.A}%;background:var(--pa)"></span><span style="width:${share.B}%;background:var(--pb)"></span></div>
    <div class="row between tiny muted" style="margin-top:4px"><span>${esc(pName('A'))} ${share.A} %</span><span>jours comptés</span><span>${esc(pName('B'))} ${share.B} %</span></div>
    <div class="row gap wrap mt">
      ${canDecide ? `<button class="btn ok sm" data-act="pl-validate" data-id="${p.id}">✓ Valider</button><button class="btn danger sm" data-act="pl-refuse" data-id="${p.id}">✗ Refuser</button>` : ''}
      <button class="btn soft sm" data-act="pl-view" data-id="${p.id}">${IC.eye} Voir</button>
      ${isParent() && p.state === 'active' ? `<button class="btn soft sm" data-act="pl-edit" data-id="${p.id}">${IC.edit} Modifier le rythme</button><button class="btn soft sm" data-act="pl-archive" data-id="${p.id}">${IC.archive} Archiver</button>` : ''}
      ${p.state === 'pending' && p.createdBy === me ? `<button class="btn soft sm" data-act="pl-cancel" data-id="${p.id}">Annuler la proposition</button>` : ''}
    </div></div>`;
}
export const views = {
  plannings() {
    const act = S.plannings.filter(p => ['active', 'pending', 'pending-archive'].includes(p.state)).sort((a, b) => a.start.localeCompare(b.start));
    const old = S.plannings.filter(p => !['active', 'pending', 'pending-archive'].includes(p.state)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const hasSJ = S.plannings.some(p => p.source && p.state !== 'archived' && p.state !== 'cancelled' && p.state !== 'refused');
    return {
      title: 'Planning', back: 'home',
      html: `<div class="alert info"><div class="ai">🔁</div><div class="small"><b>Règle de relais :</b> une garde qui commence un jour donné démarre par la récupération des enfants <b>la veille à ${E.fmtTime(settings().handoverTime)}</b> ; le dernier jour de garde, les enfants sont remis à l'autre parent <b>à ${E.fmtTime(settings().handoverTime)}</b>, sauf accord différent (via un échange).</div></div>
      ${isParent() ? `<div class="row gap mb"><button class="btn primary f1" data-act="wiz-start">${IC.plus} Nouveau planning</button></div>
        ${!hasSJ ? `<button class="card" style="width:100%;text-align:left;border:2px dashed var(--gold)" data-act="pl-import"><div class="row gap"><div style="font-size:34px">📥</div><div class="f1"><div class="b">Importer les plannings officiels 2026 & 2027</div><div class="small muted">Selman & Jandal · 2026 : 97 j / 97 j · 2027 : 97 j / 96 j · fériés, Aïd, ponts inclus</div></div><span class="lnk">›</span></div></button>` : ''}` : ''}
      ${act.length ? act.map(planningCard).join('') : '<div class="card empty"><div class="e-i">📅</div>Aucun planning pour l\'instant.</div>'}
      ${old.length ? `<details class="card"><summary class="b">Historique (${old.length})</summary><div class="mt">${old.map(p => `<div class="li"><div class="le">${p.icon || '📅'}</div><div class="f1"><div class="lt">${esc(p.title)}</div><div class="ls">${esc(childNames(p.childIds))} · ${(STATE[p.state] || [, p.state])[1]} · ${E.fmtDate(p.start, 'num')} → ${E.fmtDate(endOf(p), 'num')}</div></div></div>`).join('')}</div></details>` : ''}`,
    };
  },
  wizard() {
    const w = S.wiz;
    if (!w) { setTimeout(() => go('plannings'), 0); return { title: 'Nouveau planning', html: '' }; }
    const steps = ['Enfants & rythme', 'Période & vacances', 'Jours de garde', 'Titre & aperçu'];
    let body = '';
    if (w.step === 1) body = step1(w); else if (w.step === 2) body = step2(w); else if (w.step === 3) body = step3(w); else body = step4(w);
    return {
      title: 'Nouveau planning', back: 'plannings',
      html: `<div class="wiz-h"><div class="f1"><div class="wt">${steps[w.step - 1]}</div><div class="ws">Étape ${w.step} / 4</div></div></div>
        <div class="prog"><span style="width:${w.step * 25}%"></span></div>${body}
        <div class="row gap mt2">${w.step > 1 ? `<button class="btn ghost f1" data-act="wiz-prev">Précédent</button>` : ''}
        ${w.step < 4 ? `<button class="btn primary f1" data-act="wiz-next">Suivant</button>` : `<button class="btn coral f1" data-act="wiz-finish">Terminer</button>`}</div>`,
    };
  },
};

// ───── Assistant
function rotate(pat, k) { const L = pat.length; k = ((k % L) + L) % L; return pat.slice(L - k) + pat.slice(0, L - k); }
function basePattern(w) {
  const r = E.RHYTHMS.find(x => x.id === w.rhythm) || E.RHYTHMS[0];
  if (r.custom) return w.pattern || r.pattern;
  let p = r.pattern || 'aaaaaaa';
  if (r.dayPick) p = rotate(p, ((+w.relaisDow) + 1) % 7);
  if (r.resident && w.resident === 'B') p = [...p].map(E.swapCode).join('');
  if (!r.resident && w.firstParent === 'B') p = [...p].map(E.swapCode).join('');
  return p;
}
function newWiz(o = {}) {
  const today = E.todayISO();
  return { step: 1, childIds: S.children.map(c => c.id), rhythm: 'we2', resident: 'B', firstParent: 'A', relaisDow: 6, parity: 'pair', start: E.addDays(today, 1), end: '', zone: settings().zone || 'B',
    vacMode: 'halves', summer: 'months', firstEven: 'B', feries: 'pont', periods: null, assign: {}, custom: [], title: '', icon: '📅', pattern: null, ...o };
}
function wizCfg(w) {
  const r = E.RHYTHMS.find(x => x.id === w.rhythm);
  const end = w.end || E.addDays(w.start, 365 * 2 - 1);
  const all = E.schoolHolidays(w.zone, [...(settings().customHolidays || []), ...w.custom]).filter(p => p.e >= w.start && p.s <= end);
  const sel = w.periods ? all.filter(p => w.periods.includes(p.id + p.s)) : all;
  return { start: w.start, end, pattern: w.pattern || basePattern(w), parity: w.parity, special: r?.special, feries: w.feries,
    vac: { mode: w.vacMode, summer: w.summer, firstEven: w.firstEven, periods: sel.map(p => ({ ...p, assign: w.assign[p.id + p.s] || 'auto' })) } };
}
function step1(w) {
  const p = parents(), r = E.RHYTHMS.find(x => x.id === w.rhythm);
  const wk = E.isoWeek(E.todayISO()).week;
  return `<div class="card"><label class="lbl" style="margin-top:0">Enfants concernés</label>${chips('wkids', S.children.map(c => ({ v: c.id, l: `${c.emoji || ''} ${esc(c.prenom)}` })), w.childIds, { multi: true })}
    <div class="hint">Plusieurs enfants peuvent partager le même planning (frères et sœurs).</div></div>
    <div class="card"><label class="lbl" style="margin-top:0">Rythme de garde</label>
    ${E.RHYTHMS.map(x => `<button class="rh ${x.id === w.rhythm ? 'on' : ''}" data-act="wiz-rh" data-id="${x.id}"><span class="ri">${x.icon}</span><span class="f1"><span class="rn">${x.n}</span><br><span class="rd">${x.d}</span></span></button>`).join('')}</div>
    <div class="card">
      ${r?.resident ? `<label class="lbl" style="margin-top:0">Résidence principale chez</label>${chips('resident', [{ v: 'A', l: esc(p.A.name) }, { v: 'B', l: esc(p.B.name) }], [w.resident])}
        <div class="hint">L'autre parent a les week-ends prévus par le rythme.</div>` :
        `<label class="lbl" style="margin-top:0">Le cycle commence chez</label>${chips('firstParent', [{ v: 'A', l: esc(p.A.name) }, { v: 'B', l: esc(p.B.name) }], [w.firstParent])}`}
      ${r?.dayPick ? `<label class="lbl">Jour du relais (${E.fmtTime(settings().handoverTime)})</label><select class="in" name="relaisDow" data-change="wiz-field">${E.JOURS.map((j, i) => `<option value="${i}" ${+w.relaisDow === i ? 'selected' : ''}>${j}</option>`).join('')}</select>` : ''}
      ${(r?.pattern || '').length >= 14 || r?.custom ? `<label class="lbl">1re semaine du cycle</label>${chips('parity', [{ v: 'pair', l: 'Semaines paires' }, { v: 'impair', l: 'Semaines impaires' }], [w.parity])}
        <div class="hint">Cette semaine est la n° ${wk} (${wk % 2 ? 'impaire' : 'paire'}). Ensuite l'alternance est continue, même lors des années à 53 semaines.</div>` : ''}
    </div>`;
}
function holidayRows(w, all) {
  const p = parents();
  const lbl = a => a === 'A' ? esc(p.A.name) : a === 'B' ? esc(p.B.name) : a === 'rythme' ? 'Rythme' : 'Auto';
  return all.map(h => {
    const k = h.id + h.s, on = !w.periods || w.periods.includes(k), a = w.assign[k] || 'auto';
    return `<div class="per"><div class="pi">${h.i}</div><div class="f1"><div class="pn">${esc(h.n)}</div><div class="pd">Du ${E.fmtDate(h.s)} au ${E.fmtDate(h.e)}</div></div>
      ${on ? `<button class="pill navy" data-act="wiz-assign" data-k="${k}">${lbl(a)}</button>` : ''}<button class="ck ${on ? 'on' : ''}" data-act="wiz-per" data-k="${k}">${on ? '✓' : ''}</button></div>`;
  }).join('');
}
function step2(w) {
  const p = parents(), end = w.end || E.addDays(w.start, 365 * 2 - 1);
  const all = E.schoolHolidays(w.zone, [...(settings().customHolidays || []), ...w.custom]).filter(h => h.e >= w.start && h.s <= end);
  return `<div class="card"><p class="muted small" style="margin-top:0">Définissez la période sur laquelle s'applique ce planning de garde.</p>
    <div class="prow"><span>Début</span><input class="in" style="width:auto" type="date" name="start" value="${w.start}" data-change="wiz-field"></div>
    <div class="prow"><span>Fin <span class="muted small">(vide = 2 ans)</span></span><input class="in" style="width:auto" type="date" name="end" value="${w.end}" data-change="wiz-field"></div></div>
    <div class="card"><h3>🏖️ Vacances scolaires</h3>
      <div class="row between"><span class="b">Zone</span><div class="zone" style="margin:0">${['A', 'B', 'C'].map(z => `<button class="${z === w.zone ? 'on' : ''}" data-act="wiz-zone" data-z="${z}">${z}</button>`).join('')}</div></div>
      <button class="btn soft sm mt" data-act="wiz-acad">🎓 Voir la liste des académies</button>
      <label class="lbl">Partage des vacances</label>
      <select class="in" name="vacMode" data-change="wiz-field">${[['halves', 'Moitié / moitié'], ['weeks', 'Une semaine sur deux'], ['alternate', 'Périodes entières en alternance'], ['none', 'Pas de règle (le rythme continue)']].map(([v, l]) => `<option value="${v}" ${w.vacMode === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${w.vacMode !== 'none' ? `<label class="lbl">Vacances d'été</label>${chips('summer', [{ v: 'months', l: 'Juillet / août' }, { v: 'halves', l: 'Par moitié' }], [w.summer])}
      <label class="lbl">Les années paires, la 1re partie revient à</label>${chips('firstEven', [{ v: 'A', l: esc(p.A.name) }, { v: 'B', l: esc(p.B.name) }], [w.firstEven])}
      <div class="hint">Les années impaires, c'est l'inverse. Les ponts (Ascension…) suivent le parent du week-end.</div>` : ''}
      <label class="row gap mt"><span class="sw"><input type="checkbox" name="feries" ${w.feries === 'pont' ? 'checked' : ''} data-change="wiz-field"><span></span></span><span class="f1 small">Jours fériés du lundi/vendredi rattachés au week-end voisin</span></label>
    </div>
    <div class="card"><h3>Périodes (${all.length})</h3><p class="hint" style="margin-top:-4px">Touchez l'étiquette pour forcer un parent sur une période.</p>${holidayRows(w, all) || '<p class="muted">Aucune période dans cet intervalle.</p>'}
      <button class="btn ghost block mt" data-act="wiz-custom">${IC.plus} Ajouter une période personnalisée</button></div>`;
}
function patternEditor(w) {
  const pat = w.pattern || basePattern(w), L = pat.length, weeks = L / 7;
  const r = E.RHYTHMS.find(x => x.id === w.rhythm);
  if (r?.special === 'we135') return `<div class="alert info"><div class="ai">🗓️</div><div class="small">Les 1er, 3e et 5e week-ends de chaque mois sont chez ${esc(pName(E.other(w.resident)))}. Pas de cycle à éditer.</div></div>`;
  let g = '<span></span>' + E.JOURS_L.map(j => `<span class="wl">${j}</span>`).join('');
  for (let k = 0; k < weeks; k++) {
    g += `<span class="wl">${weeks === 2 ? (k === 0 ? (w.parity === 'pair' ? 'P' : 'I') : (w.parity === 'pair' ? 'I' : 'P')) : 'S' + (k + 1)}</span>`;
    for (let d = 0; d < 7; d++) { const c = pat[k * 7 + d]; g += `<button class="pc" style="background:${cellBg([c])}" data-act="wiz-cell" data-i="${k * 7 + d}">${E.isDefault(c) ? '🏫' : esc(pShort(E.first(c)).slice(0, 4))}</button>`; }
  }
  return `<div class="pat">${g}</div>`;
}
function step3(w) {
  const pat = w.pattern || basePattern(w), sh = E.patternShare(pat), p = parents();
  const r = E.RHYTHMS.find(x => x.id === w.rhythm);
  return `<div class="card"><p class="small" style="margin-top:0">Touchez les jours pour indiquer <b>chez qui sont les enfants</b> pendant le cycle. Un jour de garde commence la veille à ${E.fmtTime(settings().handoverTime)} et se termine ce jour-là à ${E.fmtTime(settings().handoverTime)}.</p>
    ${r?.custom ? `<label class="lbl">Durée du cycle</label>${chips('cycle', [7, 14, 21, 28].map(n => ({ v: n, l: `${n / 7} sem.` })), [String(pat.length)])}` : ''}
    <div class="mt">${patternEditor(w)}</div>
    <div class="row gap wrap mt"><span class="pill" style="background:var(--pa)">${esc(p.A.name)} ${sh.A}%</span><span class="pill" style="background:var(--pb)">${esc(p.B.name)} ${sh.B}%</span>${pat.includes('a') || pat.includes('b') ? '<span class="pill">🏫 = école (non compté)</span>' : ''}</div>
    <button class="btn soft block mt" data-act="wiz-invert">⇄ Inverser les jours de garde</button></div>
    <div class="hint">P = semaine paire · I = semaine impaire. Les vacances et jours fériés seront appliqués par-dessus ce cycle.</div>`;
}
function miniMonth(days, start, m) {
  const [y, mo] = m.split('-').map(Number), first = `${m}-01`, pad = E.dow(first);
  let g = E.JOURS_L.map(j => `<div class="h">${j}</div>`).join('') + '<div></div>'.repeat(pad);
  for (let d = 1; d <= E.monthDays(y, mo); d++) {
    const iso = `${m}-${String(d).padStart(2, '0')}`, k = E.diffDays(start, iso), c = k >= 0 && k < days.length ? days[k] : '.';
    g += `<div class="c" style="background:${cellBg([c])}">${d}</div>`;
  }
  return `<div class="ym"><div class="ymt">${E.MOIS[mo - 1]} ${y}</div><div class="g">${g}</div></div>`;
}
function step4(w) {
  const cfg = wizCfg(w), days = E.generateDays(cfg), p = parents();
  w._days = days;
  const months = []; let m = w.start.slice(0, 7); for (let i = 0; i < 4; i++) { months.push(m); let [y, mo] = m.split('-').map(Number); mo++; if (mo > 12) { mo = 1; y++; } m = `${y}-${String(mo).padStart(2, '0')}`; }
  const overl = S.plannings.filter(x => x.state === 'active' && x.childIds.some(c => w.childIds.includes(c)) && endOf(x) >= w.start);
  const sh = E.patternShare(days.slice(0, 365));
  const r = E.RHYTHMS.find(x => x.id === w.rhythm);
  return `<div class="card"><p class="small" style="margin-top:0">Personnalisez votre planning avec un titre et une icône.</p>
    <div class="row gap"><span class="ib" style="font-size:26px;width:54px;height:54px">${w.icon}</span><input class="in f1" name="title" value="${esc(w.title || `${r?.n || 'Planning'} · ${childNames(w.childIds)}`)}" data-change="wiz-field"></div>
    <div class="chips mt">${ICONS.map(i => `<button class="chip sm ${i === w.icon ? 'on' : ''}" data-act="wiz-seticon" data-i="${i}">${i}</button>`).join('')}</div></div>
    <div class="card"><h3>👁️ Prévisualisation</h3><div class="small muted">${esc(childNames(w.childIds))} · du ${E.fmtDate(w.start, 'num')} au ${E.fmtDate(cfg.end, 'num')} · ${esc(p.A.name)} ${sh.A}% / ${esc(p.B.name)} ${sh.B}% (1re année)</div>
      <div class="ycal mt">${months.map(mm => miniMonth(days, w.start, mm)).join('')}</div>
      <div class="legend"><span><i style="background:var(--pa)"></i>${esc(p.A.name)}</span><span><i style="background:var(--pb)"></i>${esc(p.B.name)}</span><span><i style="background:var(--pb-l)"></i>École</span></div></div>
    ${overl.length ? `<div class="alert"><div class="ai">⚠️</div><div class="small"><b>Avertissement planning récurrent :</b> en enregistrant, ce nouveau planning remplacera le précédent (${esc(overl.map(x => x.title).join(', '))}) à compter du ${E.fmtDate(w.start, 'num')}.</div></div>` : ''}
    ${needsValidation() ? `<div class="alert info"><div class="ai">🤝</div><div class="small">Ce planning sera actif après validation par ${esc(pName(E.other(myCode())))}.</div></div>` : ''}`;
}
function wizGrab() {
  const v = document.getElementById('view'); if (!v || !S.wiz) return;
  const f = readForm(v), w = S.wiz;
  if (f.wkids) w.childIds = f.wkids;
  for (const k of ['resident', 'firstParent', 'parity', 'summer', 'firstEven']) if (f[k]) w[k] = f[k];
  if (f.relaisDow !== undefined && f.relaisDow !== '') w.relaisDow = +f.relaisDow;
  if (f.start) w.start = f.start; if (f.end !== undefined && w.step === 2) w.end = f.end;
  if (f.vacMode) w.vacMode = f.vacMode;
  if (w.step === 2) w.feries = f.feries ? 'pont' : 'rythme';
  if (f.title !== undefined && w.step === 4) w.title = f.title;
  if (f.cycle && w.step === 3) { const n = +f.cycle, pat = w.pattern || basePattern(w); if (n !== pat.length) w.pattern = (pat.repeat(4)).slice(0, n); }
}
export const after = {
  wizard(v) {
    v.addEventListener('chipchange', e => {
      const grp = e.target?.dataset?.group; wizGrab();
      const r = E.RHYTHMS.find(x => x.id === S.wiz.rhythm);
      if ((grp === 'resident' || grp === 'firstParent') && !r?.custom) S.wiz.pattern = null;
      if (grp !== 'wkids') S.render();
    });
  },
};
async function savePlanning({ title, icon, childIds, start, days, comments = {}, feries = [], source = null, rhythm = null }) {
  const st = needsValidation() ? 'pending' : 'active';
  const id = await addItem('plannings', { title, icon, childIds, start, days, comments, feries, source, rhythm, state: st, ...(st === 'active' ? { validatedAt: Date.now(), validatedBy: uid(), validatedByName: myName() + ' (auto)' } : {}) });
  await log('garde', st === 'pending' ? `Nouveau planning proposé : ${title}` : `Nouveau planning : ${title}`, { body: `${childNames(childIds)} · à partir du ${E.fmtDate(start, 'num')}` });
  return { id, st };
}
export const actions = {
  'wiz-start': el => { S.wiz = newWiz(el.dataset.kids ? { childIds: el.dataset.kids.split(',') } : {}); go('wizard'); },
  'wiz-rh': el => { wizGrab(); S.wiz.rhythm = el.dataset.id; S.wiz.pattern = null; S.render(); },
  'wiz-field': () => { wizGrab(); if (S.wiz.step !== 4) { document.activeElement?.blur?.(); S.render(); } },
  'wiz-zone': el => { wizGrab(); S.wiz.zone = el.dataset.z; S.wiz.periods = null; S.wiz.assign = {}; S.render(); },
  'wiz-acad': () => openSheet(`<h3 class="sh-title">🎓 Académies par zone</h3>${['A', 'B', 'C'].map(z => `<div class="lbl">Zone ${z}</div><p style="margin:0">${esc(E.ACADEMIES[z])}</p>`).join('')}<button class="btn primary block mt2" data-act="close-sheet">Fermer</button>`),
  'wiz-per': el => {
    wizGrab(); const w = S.wiz, end = w.end || E.addDays(w.start, 365 * 2 - 1);
    const all = E.schoolHolidays(w.zone, [...(settings().customHolidays || []), ...w.custom]).filter(h => h.e >= w.start && h.s <= end).map(h => h.id + h.s);
    const set = new Set(w.periods || all); set.has(el.dataset.k) ? set.delete(el.dataset.k) : set.add(el.dataset.k); w.periods = [...set]; S.render();
  },
  'wiz-assign': el => { wizGrab(); const k = el.dataset.k, order = ['auto', 'A', 'B', 'rythme'], cur = S.wiz.assign[k] || 'auto'; S.wiz.assign[k] = order[(order.indexOf(cur) + 1) % 4]; S.render(); },
  'wiz-custom': async () => {
    wizGrab();
    openSheet(`<h3 class="sh-title">📌 Période personnalisée</h3><label class="lbl">Titre</label><input class="in" name="n" placeholder="Ex. Voyage au Maroc">
      <div class="two"><div><label class="lbl">Début</label><input class="in" type="date" name="s"></div><div><label class="lbl">Fin</label><input class="in" type="date" name="e"></div></div>
      <div class="hint">Elle sera affichée sur le calendrier de tous les membres.</div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="wiz-custom-save">Enregistrer</button></div>`);
  },
  'wiz-custom-save': async el => {
    const f = readForm(el.closest('.sheet'));
    if (!f.n || !f.s || !f.e || f.e < f.s) return toast('Titre, début et fin valides requis.', 'warn');
    const per = { id: 'perso' + Date.now().toString(36), n: f.n, s: f.s, e: f.e, i: '📌', kind: 'perso' };
    S.wiz.custom.push(per); if (S.wiz.periods) S.wiz.periods.push(per.id + per.s);
    await guard(() => setFamily({ settings: { ...settings(), customHolidays: [...(settings().customHolidays || []), per] } }));
    closeSheet(); S.render();
  },
  'wiz-cell': el => {
    wizGrab(); const w = S.wiz, pat = [...(w.pattern || basePattern(w))], i = +el.dataset.i, c = pat[i];
    const resident = pat.some(x => x === 'a' || x === 'b'), def = pat.find(x => x === 'a' || x === 'b');
    pat[i] = resident ? (E.isDefault(c) ? E.other(E.first(def)) : def) : (c === 'A' ? 'B' : 'A');
    w.pattern = pat.join(''); S.render();
  },
  'wiz-invert': () => { wizGrab(); const w = S.wiz; w.pattern = [...(w.pattern || basePattern(w))].map(E.swapCode).join(''); S.render(); },
  'wiz-seticon': el => { wizGrab(); S.wiz.icon = el.dataset.i; S.render(); },
  'wiz-prev': () => { wizGrab(); S.wiz.step--; S.render(); window.scrollTo(0, 0); },
  'wiz-next': () => {
    wizGrab(); const w = S.wiz;
    if (w.step === 1 && !w.childIds.length) return toast('Sélectionnez au moins un enfant.', 'warn');
    if (w.step === 2 && (!w.start || (w.end && w.end < w.start))) return toast('Vérifiez les dates de début et de fin.', 'warn');
    if (w.step === 2 && !w.pattern) w.pattern = basePattern(w);
    w.step++; S.render(); window.scrollTo(0, 0);
  },
  'wiz-finish': async el => {
    wizGrab(); const w = S.wiz;
    if (!w.title) w.title = `Planning · ${childNames(w.childIds)}`;
    const cfg = wizCfg(w), days = E.generateDays(cfg);
    el.disabled = true;
    const res = await guard(() => savePlanning({ title: w.title, icon: w.icon, childIds: w.childIds, start: w.start, days, rhythm: { ...w, step: 1, _days: undefined } }));
    if (res) { toast(res.st === 'pending' ? 'Planning envoyé pour validation' : 'Planning enregistré'); S.wiz = null; go('plannings'); } else el.disabled = false;
  },
  'pl-import': () => {
    const p = parents();
    const ka = /khalid/i.test(p.B.name) && !/khalid/i.test(p.A.name) ? 'B' : 'A';
    const kids = S.children.filter(c => /selman|jandal/i.test(c.prenom)).map(c => c.id);
    openSheet(`<h3 class="sh-title">📥 Plannings 2026 & 2027</h3>
      <p class="small muted">Calendriers établis pour Selman & Jandal (zone B) : week-ends alternés, moitiés de vacances, juillet/août, jours fériés, ponts et Aïd (demi-journées).</p>
      <label class="lbl">Enfants</label>${chips('kids', S.children.map(c => ({ v: c.id, l: `${c.emoji || ''} ${esc(c.prenom)}` })), kids.length ? kids : S.children.map(c => c.id), { multi: true })}
      <label class="lbl">« KA » (Khalid) correspond à</label>${chips('ka', [{ v: 'A', l: esc(p.A.name) }, { v: 'B', l: esc(p.B.name) }], [ka])}
      <div class="hint">« JE » (Jounayda) sera l'autre parent. Jours d'école : chez ${esc(ka === 'A' ? p.B.name : p.A.name)} par défaut (non comptés).</div>
      <label class="lbl">Années</label>${chips('years', [{ v: '2026', l: '2026 · 97 j / 97 j' }, { v: '2027', l: '2027 · KA 97 j / JE 96 j' }], ['2026', '2027'], { multi: true })}
      ${needsValidation() ? `<div class="alert info mt"><div class="ai">🤝</div><div class="small">Ils seront actifs après validation par l'autre parent.</div></div>` : ''}
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="pl-import-go">Importer</button></div>`);
  },
  'pl-import-go': async el => {
    const f = readForm(el.closest('.sheet'));
    if (!f.kids.length) return toast('Choisissez au moins un enfant.', 'warn');
    if (!S.children.length) return toast("Ajoutez d'abord vos enfants (Cercle).", 'warn');
    el.disabled = true;
    const ok = await guard(async () => {
      for (const y of f.years.sort()) {
        const src = SJ_PLANNINGS[y];
        await savePlanning({ title: `Garde ${y} (officiel)`, icon: src.icon, childIds: f.kids, start: src.start, days: E.mapKJ(src.days, f.ka), comments: src.comments, feries: src.feries, source: `sj-${y}` });
      }
      return true;
    });
    if (ok) { toast('Plannings importés'); closeSheet(); } else el.disabled = false;
  },
  'pl-view': el => { const p = S.plannings.find(x => x.id === el.dataset.id); if (!p) return; const today = E.todayISO(); const m = (p.start > today ? p.start : today).slice(0, 7); go('agenda', { mode: 'mois', m }); },
  'pl-edit': el => {
    const p = S.plannings.find(x => x.id === el.dataset.id); if (!p) return;
    const today = E.todayISO(), start = p.start > today ? p.start : E.addDays(today, 1);
    S.wiz = newWiz({ ...(p.rhythm || {}), childIds: p.childIds, start, end: '', step: 1, title: '', pattern: p.rhythm?.pattern || null });
    go('wizard');
  },
  'pl-validate': async el => {
    const p = S.plannings.find(x => x.id === el.dataset.id); if (!p) return;
    if (p.state === 'pending-archive') {
      await guard(async () => { await updItem('plannings', p.id, { state: 'archived', validatedArchiveBy: uid(), validatedArchiveAt: Date.now() }); await log('garde', `Archivage validé : ${p.title}`); }, 'Archivage validé');
      return;
    }
    await guard(async () => { await updItem('plannings', p.id, { state: 'active', validatedBy: uid(), validatedByName: myName(), validatedAt: Date.now() }); await log('garde', `Planning validé : ${p.title}`); }, 'Planning validé');
  },
  'pl-refuse': async el => {
    const p = S.plannings.find(x => x.id === el.dataset.id); if (!p) return;
    const note = await promptBox('Refuser', { label: 'Motif (facultatif)', placeholder: 'Expliquez pourquoi…', ok: 'Refuser', textarea: true });
    if (note === null) return;
    if (p.state === 'pending-archive') { await guard(async () => { await updItem('plannings', p.id, { state: 'active', archiveBy: null }); await log('garde', `Archivage refusé : ${p.title}`, { body: note }); }); return; }
    await guard(async () => { await updItem('plannings', p.id, { state: 'refused', refuseNote: note, refusedBy: uid(), refusedAt: Date.now() }); await log('garde', `Planning refusé : ${p.title}`, { body: note }); }, 'Planning refusé');
  },
  'pl-archive': async el => {
    const p = S.plannings.find(x => x.id === el.dataset.id); if (!p) return;
    const nv = needsValidation();
    if (!(await confirmBox('Archiver ce planning ?', `${esc(p.title)}${nv ? '<br>L\'autre parent devra valider.' : ''}`, 'Archiver'))) return;
    await guard(async () => { await updItem('plannings', p.id, nv ? { state: 'pending-archive', archiveBy: uid() } : { state: 'archived' }); await log('garde', nv ? `Archivage demandé : ${p.title}` : `Planning archivé : ${p.title}`); }, nv ? 'Demande envoyée' : 'Planning archivé');
  },
  'pl-cancel': async el => {
    const p = S.plannings.find(x => x.id === el.dataset.id); if (!p) return;
    await guard(async () => { await updItem('plannings', p.id, { state: 'cancelled' }); await log('garde', `Proposition annulée : ${p.title}`); }, 'Proposition annulée');
  },
};
