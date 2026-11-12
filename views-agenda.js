// ═══════════════ Agenda : calendrier de garde + événements, jour, bilan, vacances, export ═══════════════
import * as E from './engine.js?v=6.17';
import { occs, allEvents, findEvent, canEditEv, evxMap, me, queueReminders, S, engine, parents, pName, pShort, hoTime, hoPlace, selChildren, selIds, uid, myName, isParent, childName, childNames, settings, addItem, updItem, log, guard, fpath, go, LS, can, shownItem } from './core.js?v=6.17';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, download, IC, closeSheetsThen, fmtMoney, fmtStamp } from './ui.js?v=6.17';
import { vacRecap } from './views-sac.js?v=6.17';
import { kidChips, cellBg } from './views-home.js?v=6.17';
import { altText, whoChips, placeSel, placeToggle, placeLabel, dpText, alertsBlock, alertsBlockBind, saveItemAlerts, myAlertsSheet } from './views-more.js?v=6.17';
import { openPrint } from './print.js?v=6.17';

export const EV_CATS = [
  { v: 'ecole', i: '🏫', l: 'École' }, { v: 'sante', i: '🩺', l: 'Santé' }, { v: 'activite', i: '⚽', l: 'Sport / activité' }, { v: 'cours', i: '📖', l: 'Cours' },
  { v: 'accomp', i: '🚌', l: 'Sortie scolaire (accompagnement)' }, { v: 'anniv', i: '🎂', l: 'Anniversaire' }, { v: 'famille', i: '👨‍👩‍👧', l: 'Famille' }, { v: 'vacances', i: '🏖️', l: 'Sortie / vacances' }, { v: 'autre', i: '📌', l: 'Autre' },
];
const catIcon = c => EV_CATS.find(x => x.v === c)?.i || '📌';
const ym = iso => iso.slice(0, 7);
function shiftMonth(m, k) { let [y, mo] = m.split('-').map(Number); mo += k; while (mo > 12) { mo -= 12; y++; } while (mo < 1) { mo += 12; y--; } return `${y}-${String(mo).padStart(2, '0')}`; }
/** Croissant de l'Aïd (vert émeraude) */
const MOON = (z = 11) => `<svg class="moon" width="${z}" height="${z}" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.22,2.03A10,10 0 1,0 21.97,12.78A7.6,7.6 0 1,1 11.22,2.03Z" fill="#009473"/></svg>`;
function legend() {
  const p = parents();
  return `<div class="legend"><span><i style="background:var(--pa)"></i>${esc(p.A.name)}</span><span><i style="background:var(--pb)"></i>${esc(p.B.name)}</span>
    <span><i style="background:var(--pb-l)"></i>École (${esc(p.B.name)})</span><span><i style="background:var(--pa-l)"></i>École (${esc(p.A.name)})</span>
    <span><i style="background:linear-gradient(90deg,var(--pa) 50%,var(--pb) 50%)"></i>Demi-journée</span>
    <span><i style="background:var(--gold);height:5px;vertical-align:2px"></i>Vacances scolaires</span><span><i style="background:var(--err);border-radius:50%;width:9px;height:9px"></i>Férié</span><span>${MOON(13)}Fête de l'Aïd</span><span>🔁 Relais : heure et lieu dans la case</span><span><i style="border:2px dashed var(--navy);background:#fff"></i>Échange accepté</span></div>`;
}
function monthGrid(m) {
  const eng = engine(), ids = selIds(), today = E.todayISO();
  const first = `${m}-01`, start = E.mondayOf(first);
  const [y, mo] = m.split('-').map(Number), last = `${m}-${String(E.monthDays(y, mo)).padStart(2, '0')}`;
  const end = E.addDays(E.mondayOf(last), 6);
  const evs = occs(start, end, ids);
  const byDay = {}; for (const e of evs) (byDay[e.occ] ||= []).push(e);
  for (const d in byDay) byDay[d].sort((a, b) => (!!a.x && !a.match) - (!!b.x && !b.match)); // séances annulées après
  for (const c of S.children) if (c.birth && ids.includes(c.id)) for (const yy of [y - 1, y, y + 1]) { const d = `${yy}${c.birth.slice(4)}`; if (d >= start && d <= end) (byDay[d] ||= []).push({ icon: '🎂', title: `Anniversaire ${c.prenom}` }); }
  const hoBy = {}; for (const h of eng.handovers(ids, start, end)) (hoBy[h.date] ||= []).push(h);
  const hoCell = d => (hoBy[d] || []).length ? '<span class="rel">🔁</span>' + hoBy[d].map(h => { const pl = h.dropPlace || h.place || ''; return `<span class="rl">${E.fmtTime(h.time)}${pl ? `<i>${esc(pl)}</i>` : ''}</span>`; }).join('') : '';
  let cells = E.JOURS_L.map(j => `<div class="dh">${j}</div>`).join('');
  for (const d of E.eachDay(start, end)) {
    const codes = ids.map(id => eng.code(id, d)), info = eng.dayInfo(d);
    const lbl = info.comment || info.ferie;
    const ovr = ids.some(id => eng.isOverridden(id, d));
    const de = byDay[d] || [], dots = de.slice(0, 2).map(e => `<span class="evl ${e.x && !e.match ? 'x' : ''}" title="${esc(e.title)}">${e.icon || '📌'}${e.time ? E.fmtTime(e.time) : ''}</span>`).join('') + (de.length > 2 ? `<span class="evl more">+${de.length - 2}</span>` : '');
    cells += `<button class="cday ${ym(d) !== m ? 'out' : ''} ${d === today ? 'today' : ''} ${d < today ? 'past' : ''} ${ovr ? 'ovr' : ''}" style="background:${cellBg(codes)}" data-act="open-day" data-d="${d}">
      ${info.ferie ? '<span class="fer"></span>' : info.eid ? `<span class="eid" title="Fête de l'Aïd">${MOON(12)}</span>` : ''}<span class="dn">${+d.slice(8)}</span>${hoCell(d)}
      ${lbl ? `<span class="cm">${esc(lbl.length > 16 ? lbl.slice(0, 15) + '…' : lbl)}</span>` : ''}<span class="dots">${dots}</span>${info.holiday ? '<span class="hol"></span>' : ''}</button>`;
  }
  return `<div class="cal">${cells}</div>`;
}
function monthLists(m) {
  const eng = engine(), ids = selIds(), [y, mo] = m.split('-').map(Number);
  const from = `${m}-01`, to = `${m}-${String(E.monthDays(y, mo)).padStart(2, '0')}`;
  const hs = eng.handovers(ids, E.addDays(from, -1), to);
  const evs = occs(from, to, ids);
  const tab = S.ui.agTab || 'relais';
  const body = tab === 'relais'
    ? (hs.length ? hs.map(h => `<button class="li" style="width:100%;text-align:left" data-act="open-day" data-d="${h.date}"><div class="le">🔁</div><div class="f1"><div class="lt">${E.fmtDate(h.date, 'wdm')} · ${hoTime(h)}${h.custom ? ' <span class="pill warn">convenu</span>' : ''}</div>
        <div class="ls">${esc(pName(h.from))} → ${esc(pName(h.to))} · ${esc(childNames(h.childIds))}${h.kind === 'midi' ? ' · mi-journée' : h.kind === 'matin' ? ' · le matin' : ''}${esc(hoPlace(h))}</div></div></button>`).join('') : '<div class="empty">Aucun relais ce mois-ci.</div>')
    : (evs.length ? evs.map(e => occRow(e)).join('') : '<div class="empty">Aucun événement ce mois-ci.</div>');
  return `<div class="card"><div class="seg"><button class="${tab === 'relais' ? 'on' : ''}" data-act="ag-tab" data-t="relais">🔁 Relais (${hs.length})</button><button class="${tab === 'events' ? 'on' : ''}" data-act="ag-tab" data-t="events">🗓️ Événements (${evs.length})</button></div>${body}</div>`;
}
function yearView(y) {
  const eng = engine(), ids = selIds();
  const st = eng.stats(ids[0], y), p = parents(), tot = st.A + st.B || 1;
  let months = '';
  for (let mo = 1; mo <= 12; mo++) {
    const m = `${y}-${String(mo).padStart(2, '0')}`, first = `${m}-01`, pad = E.dow(first);
    let g = E.JOURS_L.map(j => `<div class="h">${j}</div>`).join('') + '<div></div>'.repeat(pad);
    for (let d = 1; d <= E.monthDays(y, mo); d++) {
      const iso = `${m}-${String(d).padStart(2, '0')}`, info = eng.dayInfo(iso);
      g += `<div class="c ${info.ferie ? 'fe' : info.eid ? 'ei' : ''}" style="background:${cellBg(ids.map(id => eng.code(id, iso)))}" title="${esc(info.comment || info.ferie || '')}">${d}</div>`;
    }
    months += `<button class="ym" data-act="ag-month" data-m="${m}" style="text-align:left"><div class="ymt">${E.MOIS[mo - 1]}</div><div class="g">${g}</div></button>`;
  }
  return `<div class="card"><h3>Bilan ${y} · ${esc(childNames(ids.slice(0, 1)))} <a class="act" data-go="stats" data-params='{"y":"${y}"}'>Détail ›</a></h3>
    <div class="bar"><span style="width:${st.A / tot * 100}%;background:var(--pa)"></span><span style="width:${st.B / tot * 100}%;background:var(--pb)"></span></div>
    <div class="row between mt"><span><b>${esc(p.A.name)}</b> ${E.fmtNum(st.A)} j</span><span><b>${esc(p.B.name)}</b> ${E.fmtNum(st.B)} j</span></div>
    <div class="hint">Jours comptés : week-ends, vacances, jours fériés attribués (demi-journée = ½). Jours d'école non comptés.</div></div>
    <div class="ycal">${months}</div>`;
}
function relaisRows(ids) {
  const eng = engine(), today = E.todayISO(), min = E.nowMin();
  const hs = eng.handovers(ids, today, E.addDays(today, 120)).filter(h => h.date > today || E.t2m(h.time) > min);
  const rows = []; let curFrom = { date: today, time: E.m2t(min) }, holder = eng.presence(ids[0], today, min);
  for (const h of hs) { rows.push({ from: curFrom, to: h, who: holder }); curFrom = h; holder = h.to; }
  return rows;
}
function listView() {
  const kids = selChildren();
  // un seul tableau si tous les enfants sélectionnés ont exactement les mêmes relais, sinon un par enfant
  const sig = k => relaisRows([k.id]).map(r => r.to.date + r.to.time + r.who).join();
  const same = kids.every(k => sig(k) === sig(kids[0]));
  const groups = same ? [kids] : kids.map(k => [k]);
  return groups.map(g => {
    const rows = relaisRows(g.map(k => k.id));
    if (!rows.length) return `<div class="card empty">${esc(childNames(g.map(k => k.id)))} : aucun relais prévu dans les 4 prochains mois.</div>`;
    return `<div class="card">${groups.length > 1 || kids.length > 1 ? `<h3>${esc(g.map(k => (k.emoji || '') + ' ' + k.prenom).join(' & '))}</h3>` : ''}${rows.map((r, i) => `<div class="li"><span class="av" style="width:14px;height:44px;border-radius:7px;background:${r.who === 'A' ? 'var(--pa)' : 'var(--pb)'}"></span>
    <div class="f1"><div class="lt">Chez ${esc(pName(r.who))}</div><div class="ls">${i === 0 ? 'Maintenant' : `${E.fmtDate(r.from.date, 'wdm')} ${E.fmtTime(r.from.time)}`} → ${E.fmtDate(r.to.date, 'wdm')} ${E.fmtTime(r.to.time)}</div></div>
    <span class="pill">${Math.max(1, Math.round((E.d2n(r.to.date) - E.d2n(r.from.date)) + (E.t2m(r.to.time) - E.t2m(r.from.time)) / 1440))} j</span></div>`).join('')}</div>`;
  }).join('');
}
export const views = {
  agenda(p) {
    if (p.d && /^\d{4}-\d{2}-\d{2}$/.test(p.d)) { S.ui.agM = ym(p.d); S.ui.agMode = 'mois'; S.ui.openDay = p.d; } // lien depuis un widget : ce jour-là
    const mode = p.d ? 'mois' : p.mode || S.ui.agMode || 'mois';
    const m = p.d ? ym(p.d) : p.m || S.ui.agM || ym(E.todayISO()); S.ui.agM = m; S.ui.agMode = mode;
    const y = +(p.y || m.slice(0, 4));
    const [yy, mo] = m.split('-').map(Number);
    const head = mode === 'annee'
      ? `<div class="cal-h"><button class="ib" data-act="ag-year" data-k="-1">${IC.back}</button><div class="mtitle center">${y}</div><button class="ib" data-act="ag-year" data-k="1">${IC.next}</button></div>`
      : mode === 'mois' ? `<div class="cal-h"><button class="ib" data-act="ag-shift" data-k="-1">${IC.back}</button><div class="mtitle center">${E.MOIS[mo - 1]} ${yy}</div><button class="ib" data-act="ag-shift" data-k="1">${IC.next}</button></div>` : '';
    return {
      title: 'Agenda',
      html: `${kidChips()}
      <div class="seg mt"><button class="${mode === 'mois' ? 'on' : ''}" data-act="ag-mode" data-m="mois">Mois</button><button class="${mode === 'annee' ? 'on' : ''}" data-act="ag-mode" data-m="annee">Année</button><button class="${mode === 'liste' ? 'on' : ''}" data-act="ag-mode" data-m="liste">Relais à venir</button></div>
      ${head}
      ${mode === 'mois' ? `<div class="card tight">${monthGrid(m)}${legend()}</div>
        <div class="row gap6 mb ag-acts">${isParent() ? `<button class="btn primary f1 sm" data-act="ev-new">${IC.plus} Événement</button><button class="btn soft sm" data-go="activites" title="Bilan des activités">📊</button>` : ''}<button class="btn soft sm ${isParent() ? '' : 'f1'}" data-act="ag-today">Aujourd'hui</button><button class="btn soft sm" data-act="print-year" title="Imprimer le calendrier annuel">${IC.print}</button><button class="btn soft sm" data-act="ics-sheet" title="Exporter">${IC.download}</button></div>
        ${monthLists(m)}` : ''}
      ${mode === 'annee' ? `<button class="btn soft block mb" data-act="print-year" data-y="${y}">${IC.print} Imprimer le calendrier ${y}</button>${yearView(y)}` : ''}
      ${mode === 'liste' ? listView() : ''}`,
    };
  },
  stats(p) {
    const eng = engine(), years = coveredYears();
    const y = +(p.y || S.ui.statY || (years.includes(new Date().getFullYear()) ? new Date().getFullYear() : years[0] || new Date().getFullYear()));
    S.ui.statY = y;
    const kids = selChildren(), pr = parents();
    const blocks = kids.map(k => {
      const s = eng.stats(k.id, y), tot = s.A + s.B || 1;
      const months = [...Array(12)].map((_, i) => { const m = `${y}-${String(i + 1).padStart(2, '0')}`; return eng.stats(k.id, y, `${m}-01`, `${m}-${String(E.monthDays(y, i + 1)).padStart(2, '0')}`); });
      return `<div class="card"><h3>${esc(k.emoji || '🧒')} ${esc(k.prenom)} · ${y}</h3>
        <div class="bar"><span style="width:${s.A / tot * 100}%;background:var(--pa)"></span><span style="width:${s.B / tot * 100}%;background:var(--pb)"></span></div>
        <div class="row between mt"><div><div class="b" style="font-size:24px">${E.fmtNum(s.A)} j</div><div class="muted small">${esc(pr.A.name)}</div></div><div class="center"><div class="b" style="font-size:24px">${E.fmtNum(s.A + s.B)}</div><div class="muted small">jours comptés</div></div><div style="text-align:right"><div class="b" style="font-size:24px">${E.fmtNum(s.B)} j</div><div class="muted small">${esc(pr.B.name)}</div></div></div>
        <div class="hr"></div>
        <div class="stat"><span></span><span class="small b">${esc(pr.A.name)}</span><span class="small b">${esc(pr.B.name)}</span>
          <span>Week-ends (jours)</span><span class="v">${s.weA}</span><span class="v">${s.weB}</span>
          <span>Vacances scolaires (jours)</span><span class="v">${s.vacA}</span><span class="v">${s.vacB}</span>
          <span>Demi-journées</span><span class="v">${s.half}</span><span class="v">${s.half}</span>
          <span>Jours d'école (non comptés)</span><span class="v">${s.defA}</span><span class="v">${s.defB}</span>
          <span>Nuits passées</span><span class="v">${s.nightsA}</span><span class="v">${s.nightsB}</span></div>
        <div class="hr"></div>
        <div class="stat">${months.map((ms, i) => `<span class="small" style="text-transform:capitalize">${E.MOIS[i]}</span><span class="v small">${E.fmtNum(ms.A)}</span><span class="v small">${E.fmtNum(ms.B)}</span>`).join('')}</div></div>`;
    }).join('');
    return {
      title: 'Bilan', back: 'home',
      html: `${kidChips()}<div class="chips mt mb">${years.map(yy => `<button class="chip sm ${yy === y ? 'on' : ''}" data-go="stats" data-params='{"y":"${yy}"}'>${yy}</button>`).join('')}</div>
        <div class="alert info"><div class="ai">ℹ️</div><div class="small">Règle de calcul de vos plannings : sont comptés les week-ends, les vacances scolaires et les jours fériés attribués ; une demi-journée vaut ½ ; les jours d'école ne sont pas comptés. Une garde commence la veille à ${E.fmtTime(settings().handoverTime)} et se termine le dernier jour à ${E.fmtTime(settings().handoverTime)}.</div></div>
        ${blocks || '<div class="card empty">Ajoutez un enfant et un planning.</div>'}`,
    };
  },
  vacances(p) {
    const st = settings(), zone = p.zone || st.zone || 'B', eng = engine(), ids = selIds(), today = E.todayISO();
    // à venir : par ordre chronologique à partir d'aujourd'hui (les vacances en cours en premier) ; passées : dans « Archives »
    const all = E.schoolHolidays(zone, st.customHolidays || []), arch = p.tab === 'arch';
    const next = all.filter(h => h.e >= today).sort((a, b) => a.s.localeCompare(b.s)), past = all.filter(h => h.e < today).sort((a, b) => b.s.localeCompare(a.s));
    const list = arch ? past : next;
    const rows = list.map(h => {
      const parts = eng.blocks(ids[0], h.s, h.e).filter(b => b.key !== '.');
      const desc = parts.length ? parts.map(b => `<span class="pill" style="background:${b.code === 'A' || b.code === 'a' ? 'var(--pa)' : b.code === 'B' || b.code === 'b' ? 'var(--pb)' : '#eee'};color:#13233A">${esc(E.isHalf(b.code) ? '½ / ½' : pShort(E.first(b.code)))} · ${E.fmtDate(b.start, 'short')}${b.end !== b.start ? '→' + E.fmtDate(b.end, 'short') : ''}</span>`).join(' ') : '<span class="muted small">Pas de planning</span>';
      const ho = eng.handovers(ids, E.addDays(h.s, -1), E.addDays(h.e, 1)).filter(x => x.kind !== 'midi');
      const nL = h.s >= '2026-12-01' ? S.sac.filter(l => l.kind === 'vlist' && l.period?.id === h.id).length : 0;
      return `<button class="per" style="align-items:flex-start;width:100%;text-align:left" data-go="vacp" data-params='${JSON.stringify({ id: h.id, zone })}'><div class="pi">${h.i}</div><div class="f1"><div class="pn">${esc(h.n)} ${h.s.slice(2, 4)} ${h.e < today ? '<span class="pill">passées</span>' : h.s <= today ? '<span class="pill ok">en cours</span>' : ''}</div>
        <div class="pd">Du ${E.fmtDate(h.s)} au ${E.fmtDate(h.e)}</div><div class="row wrap gap6 mt" style="margin-top:6px">${desc}</div>
        ${ho.length ? `<div class="tiny muted" style="margin-top:6px">🔁 ${ho.map(x => `${E.fmtDate(x.date, 'wdm')} ${hoTime(x)} → ${esc(pName(x.to))}`).join(' · ')}</div>` : ''}
        ${isParent() && nL ? `<div class="tiny b" style="margin-top:6px">🎒 ${nL} liste${nL > 1 ? 's' : ''} du Sac</div>` : ''}</div><span class="lnk" style="align-self:center">›</span></button>`;
    }).join('');
    return {
      title: 'Vacances', back: 'home',
      html: `<div class="stick">${kidChips()}<div class="seg mtx" style="margin-bottom:0"><button class="${arch ? '' : 'on'}" data-go="vacances" data-params='${JSON.stringify({ zone })}'>📅 À venir (${next.length})</button><button class="${arch ? 'on' : ''}" data-go="vacances" data-params='${JSON.stringify({ zone, tab: 'arch' })}'>🗄️ Archives (${past.length})</button></div></div><div class="card"><div class="row between"><b>Zone</b><div class="zone" style="margin:0">${['A', 'B', 'C'].map(z => `<button class="${z === zone ? 'on' : ''}" data-go="vacances" data-params='{"zone":"${z}"}'>${z}</button>`).join('')}</div></div>
        <div class="hint">${esc(E.ACADEMIES[zone])}</div>${ids.length > 1 ? `<div class="hint">Répartition affichée pour ${esc(childNames(ids.slice(0, 1)))} (touchez un prénom pour changer).</div>` : ''}<div class="hint">Touchez une période pour son récapitulatif complet.</div></div>${rows}`,
    };
  },
};
/** Récapitulatif complet d'une période de vacances : garde, relais, échanges, événements, Sac (listes), tâches, dépenses, souvenirs */
views.vacp = p => {
  const st = settings(), zone = p.zone || st.zone || 'B', h = E.schoolHolidays(zone, st.customHolidays || []).find(x => x.id === p.id);
  if (!h) return { title: 'Vacances', back: 'vacances', html: '<div class="card empty">Période introuvable.</div>' };
  const eng = engine(), pr = parents(), yy = h.s.slice(2, 4), days = Math.round(E.d2n(h.e) - E.d2n(h.s)) + 1;
  const head = `<div class="card"><div class="row gap"><div style="font-size:34px">${h.i}</div><div class="f1"><div class="b" style="font-size:19px">${esc(h.n)} ${yy}</div>
    <div class="small muted">Du ${E.fmtDate(h.s, 'wdmy')} au ${E.fmtDate(h.e, 'wdmy')} · ${days} jour${days > 1 ? 's' : ''} · zone ${zone}</div></div></div></div>`;
  if (!isParent()) return { title: `${h.n} ${yy}`, back: 'home', html: `${head}<div class="card empty">Récapitulatif réservé aux parents.</div>` };
  const inP = d => d && d >= h.s && d <= h.e, kids = S.children;
  const pill = b => `<span class="pill" style="background:${E.first(b.code) === 'A' ? 'var(--pa)' : E.first(b.code) === 'B' ? 'var(--pb)' : '#eee'};color:#13233A">${esc(E.isHalf(b.code) ? '½ / ½' : pShort(E.first(b.code)))} · ${E.fmtDate(b.start, 'short')}${b.end !== b.start ? '→' + E.fmtDate(b.end, 'short') : ''}</span>`;
  const custody = kids.map(c => {
    const bl = eng.blocks(c.id, h.s, h.e).filter(b => b.key !== '.'), cnt = { A: 0, B: 0 };
    for (const d of E.eachDay(h.s, h.e)) { const k = eng.code(c.id, d); if (k === '.') continue; if (E.isHalf(k)) { cnt[E.first(k)] += 0.5; cnt[E.last(k)] += 0.5; } else cnt[E.first(k)]++; }
    return `<div class="vp-k"><div style="font-size:22px">${esc(c.emoji || '🧒')}</div><div class="f1"><div class="b">${esc(c.prenom)}</div>
      ${bl.length ? `<div class="row wrap gap6 mtx">${bl.map(pill).join('')}</div><div class="tiny muted mtx">${esc(pr.A.name)} : ${E.fmtNum(cnt.A)} j · ${esc(pr.B.name)} : ${E.fmtNum(cnt.B)} j</div>` : '<div class="small muted">Pas de planning sur cette période.</div>'}</div></div>`;
  }).join('');
  const ho = eng.handovers(kids.map(c => c.id), E.addDays(h.s, -1), h.e);
  const xs = S.exchanges.filter(x => (x.changes || []).some(c => inP(c.d)) && x.state !== 'cancelled').sort((a, b) => (a.proposedAt || 0) - (b.proposedAt || 0));
  const XS = { pending: ['warn', 'En attente'], accepted: ['ok', 'Acceptée'], refused: ['err', 'Refusée'] };
  const evs = occs(h.s, h.e);
  const tasks = can('tasks') ? S.tasks.filter(t => inP(t.due)).sort((a, b) => a.due.localeCompare(b.due)) : [];
  const exps = can('expenses') ? S.expenses.filter(e => inP(e.date)).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const mems = S.memories.filter(m => inP(m.date) && shownItem(m)), nMem = new Set(mems.map(m => m.grp || m.id)).size;
  const sec = (t, n, body, more = '') => `<div class="card vp-sec"><h3>${t}${n != null ? ` <span class="pill">${n}</span>` : ''}${more}</h3>${body}</div>`;
  const html = `${head}
    ${sec('👨‍👩‍👧 Garde', null, custody || '<div class="small muted">Aucun enfant.</div>')}
    ${sec('🔁 Relais', ho.length, ho.length ? ho.map(x => `<button class="li" style="width:100%;text-align:left" data-act="open-day" data-d="${x.date}"><div class="le">🔁</div><div class="f1"><div class="lt">${E.fmtDate(x.date, 'wdm')} · ${hoTime(x)}${x.custom ? ' <span class="pill warn">convenu</span>' : ''}</div><div class="ls">${esc(pName(x.from))} → ${esc(pName(x.to))} · ${esc(childNames(x.childIds))}${esc(hoPlace(x))}</div></div></button>`).join('') : '<div class="small muted">Aucun relais pendant ces vacances.</div>')}
    ${sec('🔄 Échanges', xs.length, xs.length ? xs.map(x => { const [c, l] = XS[x.state] || ['', x.state]; return `<button class="li" style="width:100%;text-align:left" data-go="exchanges" data-params='${JSON.stringify({ tab: x.state === 'pending' ? (x.proposedBy === uid() ? 'mine' : 'todo') : 'hist' })}'><div class="le">${x.type === 'time' ? '⏰' : '🔄'}</div><div class="f1"><div class="lt">${esc(x.summary || 'Échange')}</div><div class="ls">${esc(childNames(x.childIds))} · demandé par ${esc(x.proposedByName || '')} le ${fmtStamp(x.proposedAt)}</div></div><span class="pill ${c}">${l}</span></button>`; }).join('') : '<div class="small muted">Aucun échange sur cette période.</div>')}
    ${sec('🗓️ Événements', evs.length, evs.length ? evs.map(e => occRow(e)).join('') : '<div class="small muted">Aucun événement.</div>', ` <a class="act" data-act="ev-new" data-d="${h.s}">${IC.plus}</a>`)}
    ${vacRecap(h.id)}
    ${can('tasks') ? sec('✅ Tâches', tasks.length, tasks.length ? tasks.map(t => `<button class="li" style="width:100%;text-align:left" data-act="task-open" data-id="${t.id}"><div class="le">${t.done ? '✅' : '⬜'}</div><div class="f1"><div class="lt">${esc(t.title)}</div><div class="ls">📅 ${E.fmtDate(t.due, 'wdm')}${t.childIds?.length ? ' · ' + esc(childNames(t.childIds)) : ''}${t.done ? ' · fait' : ''}</div></div></button>`).join('') : '<div class="small muted">Aucune tâche à échéance pendant ces vacances.</div>') : ''}
    ${can('expenses') ? sec('💰 Dépenses', exps.length, exps.length ? `${exps.map(e => `<div class="li"><div class="f1"><div class="lt">${esc(e.title)}</div><div class="ls">${E.fmtDate(e.date, 'wdm')} · payé par ${esc(pr[e.paidBy]?.name || '')}${e.childIds?.length ? ' · ' + esc(childNames(e.childIds)) : ''}</div></div><b>${fmtMoney(e.amount)}</b></div>`).join('')}<div class="row between mt"><b>Total</b><b>${fmtMoney(exps.reduce((t, e) => t + (+e.amount || 0), 0))}</b></div>` : '<div class="small muted">Aucune dépense datée de ces vacances.</div>', ` <a class="act" data-go="budget">Budget ›</a>`) : ''}
    ${nMem ? sec('📸 Souvenirs', nMem, `<button class="btn soft block" data-go="memories">Voir les souvenirs ›</button>`) : ''}`;
  return { title: `${h.n} ${yy}`, back: 'vacances', html };
};
/** Ligne d'une séance : état (absent, remplacée par un match), 🔒 réservé aux parents */
function occRow(e, withDate = true) {
  const off = e.x && !e.match;
  const st = e.match ? ` · remplace ${esc(e.src.title)}` : off ? (e.x.type === 'absent' ? ` · ❌ Absent${e.x.cause ? ' (' + esc(e.x.cause) + ')' : ''}` : ' · 🔁 Remplacé par un match de foot') : '';
  return `<button class="li" style="width:100%;text-align:left" data-act="ev-open" data-id="${e.id}" data-d="${e.occ}"><div class="le">${e.icon || catIcon(e.cat)}</div><div class="f1"><div class="lt ${off ? 'occ-x' : ''}">${esc(e.title)}${e.pe ? ' 🔒' : ''}</div>
    <div class="ls">${withDate ? E.fmtDate(e.occ, 'wdm') + ' · ' : ''}${esc(evText(e, false))}${e.childIds?.length ? ' · ' + esc(childNames(e.childIds)) : ''}${!e.match && E.evKind(e) !== 'date' ? ' · 🔁' : ''}${st}</div></div></button>`;
}
// ───── Bilan des activités : séances, heures, absences sur l'année scolaire, de vacances à vacances ou entre deux dates
const hTxt = m => (m ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : '0 h');
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
views.activites = p => {
  if (!isParent()) return { title: 'Activités', back: 'agenda', html: '<div class="card empty">Bilan réservé aux parents.</div>' };
  const st = settings(), today = E.todayISO(), sy = schoolY(today), mode = p.m || 'annee';
  const pers = E.schoolPeriods(sy, st.zone || 'B', st.customHolidays || []);
  let from, to, label, sel = null;
  if (mode === 'vac') { sel = pers.find(x => x.id === p.per) || pers.find(x => x.from <= today && today <= x.to) || pers[0]; from = sel.from; to = sel.to; label = sel.n; }
  else if (mode === 'perso') { from = /^\d{4}-\d{2}-\d{2}$/.test(p.from || '') ? p.from : `${sy}-09-01`; to = /^\d{4}-\d{2}-\d{2}$/.test(p.to || '') && p.to >= from ? p.to : today; label = 'Dates choisies'; }
  else { from = `${sy}-09-01`; to = `${sy + 1}-08-31`; label = `Année scolaire ${sy}-${sy + 1}`; }
  const ids = selIds(), evs = allEvents().filter(e => !e.childIds?.length || e.childIds.some(i => ids.includes(i)));
  const groups = E.activityStats(evs, evxMap(), from, to, st);
  const card = g => `<div class="card"><h3>${g.icon} ${esc(g.title)} <span class="muted small" style="font-weight:600">${esc(childNames(g.childIds))}</span></h3>
    <div class="act-st"><div><b>${g.done}</b><span>${g.done > 1 ? 'séances faites' : 'séance faite'}</span></div><div><b>${hTxt(g.minDone)}</b><span>heures faites</span></div><div><b>${g.match ? '—' : g.absent}</b><span>${g.match ? 'match' : g.absent > 1 ? 'absences' : 'absence'}</span></div></div>
    <div class="small mt">À venir : ${plural(g.todo, 'séance')} · ${hTxt(g.minAll - g.minDone)}<br><b>Total sur la période : ${plural(g.planned, 'séance')} · ${hTxt(g.minAll)}</b>${g.matched ? `<br>${g.matched} séance${g.matched > 1 ? 's remplacées' : ' remplacée'} par un match de foot` : ''}</div>
    ${g.causes.length ? `<div class="tiny muted mt">Absences : ${g.causes.map(c => `${E.fmtDate(c.d, 'short')} (${esc(c.c)})`).join(' · ')}</div>` : ''}</div>`;
  const seg = (m, l) => `<button class="${mode === m ? 'on' : ''}" data-go="activites" data-params='${JSON.stringify({ m })}'>${l}</button>`;
  return {
    title: 'Bilan des activités', back: 'agenda',
    html: `${kidChips()}<div class="seg mt">${seg('annee', 'Année scolaire')}${seg('vac', 'Vacances à vacances')}${seg('perso', 'Dates')}</div>
      ${mode === 'vac' ? `<div class="chips mb">${pers.map(x => `<button class="chip sm ${x.id === sel.id ? 'on' : ''}" data-go="activites" data-params='${JSON.stringify({ m: 'vac', per: x.id })}'>${esc(x.n)}</button>`).join('')}</div>` : ''}
      ${mode === 'perso' ? `<div class="card tight"><div class="two"><div><label class="lbl">Du</label><input class="in" type="date" name="from" value="${from}"></div><div><label class="lbl">Au</label><input class="in" type="date" name="to" value="${to}"></div></div><button class="btn primary block mt" data-act="act-perso">Afficher</button></div>` : ''}
      <div class="hint mb">📅 ${esc(label)} : du ${E.fmtDate(from, 'wdmy')} au ${E.fmtDate(to, 'wdmy')}. Une activité regroupe tous ses jours (ex. foot du mercredi et du vendredi). Faites = passées et non annulées.</div>
      ${groups.length ? groups.map(card).join('') : '<div class="card empty">Aucune activité sur cette période.</div>'}`,
  };
};

// ───── Lien de création des activités de l'année (foot et PDC de Selman et Jandal) : sans doublon
// by / tk : qui dépose / qui récupère (A = Khalid, B = Jounayda ou Maman TEST, '' = le parent qui a la garde)
const ACT_PRESET = [
  { t: 'Entraînement de foot', k: 'Selman', cat: 'activite', dows: [1, 3], time: '18:00', timeEnd: '19:30', place: 'Stade de Concyr', from: '2026-09-15', hol: 'no', by: 'B', tk: 'A' },
  { t: 'Entraînement de foot', k: 'Jandal', cat: 'activite', dows: [2], time: '13:30', timeEnd: '15:00', place: 'Stade de Concyr', from: '2026-09-15', hol: 'no', by: 'A', tk: 'B' },
  { t: 'Entraînement de foot', k: 'Jandal', cat: 'activite', dows: [4], time: '18:30', timeEnd: '19:30', place: 'Stade de Concyr', from: '2026-09-15', hol: 'no', by: 'A', tk: 'B' },
  { t: 'PDC', k: 'Selman', cat: 'cours', dows: [2], time: '10:00', timeEnd: '11:00', place: 'El Fayhae', from: '2026-10-07', hol: 'w1', by: 'B', tk: 'A' },
  { t: 'PDC', k: 'Jandal', cat: 'cours', dows: [2], time: '09:00', timeEnd: '11:00', place: 'El Fayhae', from: '2026-10-07', hol: 'w1', by: 'B', tk: 'A' },
  { t: 'PDC', k: 'Jandal', cat: 'cours', dows: [5], time: '09:00', timeEnd: '11:00', place: 'El Fayhae', from: '2026-10-07', hol: 'w1', match: true, by: '', tk: '' },
];
/** Organisation (qui dépose, qui récupère, où) d'une activité */
const orgaOf = a => ({ from: a.by, dropAt: 'lieu:' + a.place, dropTxt: '', dropPlace: a.place, to: a.tk, pickAt: 'lieu:' + a.place, pickTxt: '', pickPlace: a.place, place: a.place });
const ORGA_KEYS = ['from', 'dropAt', 'dropPlace', 'to', 'pickAt', 'pickPlace'];
const norm = x => String(x || '').trim().toLowerCase();
function presetData(a, kid) {
  return { title: a.t, cat: a.cat, icon: catIcon(a.cat), childIds: [kid.id], kind: 'dow', date: a.from, endDate: '', dow: a.dows[0], dows: a.dows, every: 1, parity: 'pair',
    school: a.hol !== 'yes', holW1: a.hol === 'w1', year: String(schoolY(a.from)), vis: 'all', matchSwap: !!a.match, time: a.time, timeEnd: a.timeEnd, endTime: a.timeEnd,
    ...orgaOf(a), alt: null, notes: '',
    repeat: 'weekly', until: `${schoolY(a.from) + 1}-08-31`, who: 'custodian' };
}
/** Cercles où créer les activités : celui-ci, et (depuis votre vrai compte) l'autre entre vrai cercle et cercle de test */
async function presetTargets() {
  const pp = parents(), out = [{ fid: S.fid, name: S.family?.name || '', kids: S.children, evs: allEvents(), cur: true, par: { A: pp.A.name, B: pp.B.name } }], t = LS.get('testAcc', null), db = S.be.db;
  if (t?.fid && t.realFid && S.acc !== 'test' && isParent()) {
    const fid = S.fid === t.fid ? t.realFid : S.fid === t.realFid ? t.fid : null;
    if (fid) {
      try { const [kids, evs, fam] = await Promise.all([db.list(`families/${fid}/children`), db.list(`families/${fid}/events`), db.get(`families/${fid}`)]); out.push({ fid, name: fam?.name || '', kids, evs, cur: false, par: { A: fam?.parents?.A?.name || 'A', B: fam?.parents?.B?.name || 'B' } }); }
      catch (e) { console.warn('autre cercle', e); }
    }
  }
  return out;
}
function presetRows(tg) {
  return ACT_PRESET.map(a => {
    const kid = tg.kids.find(c => norm(c.prenom) === norm(a.k)), data = kid ? presetData(a, kid) : null;
    const ex = data ? tg.evs.find(e => norm(e.title) === norm(a.t) && (e.childIds || []).join() === kid.id && E.evKind(e) === 'dow' && E.evDays(e).join() === a.dows.join() && e.time === a.time) : null;
    // déjà là : organisation à mettre à jour si elle diffère (qui dépose, qui récupère, lieux)
    const org = orgaOf(a), upd = ex && ORGA_KEYS.some(k => (ex[k] || '') !== (org[k] || '')) ? { id: ex.id, patch: org, mine: ex.createdBy === uid() } : null;
    return { a, kid, data, dup: !!ex, upd };
  });
}
async function presetSheet() {
  const tgs = await presetTargets();
  const who = (tg, c) => (c ? tg.par?.[c] || c : 'le parent qui a la garde');
  const sec = (tg, k) => { const rows = presetRows(tg), todo = rows.filter(r => (r.data && !r.dup) || r.upd).length;
    return `<label class="row gap mt"><input type="checkbox" name="pt" value="${k}" ${todo ? 'checked' : 'disabled'} style="width:20px;height:20px"><b class="f1">${esc(tg.name)}${tg.cur ? ' <span class="muted small">(ce cercle)</span>' : ''}</b><span class="small muted">${todo ? `${plural(todo, 'changement')}` : 'à jour'}</span></label>
    ${rows.map(r => `<div class="li"><div class="le">${catIcon(r.a.cat)}</div><div class="f1"><div class="lt">${esc(r.a.t)} · ${esc(r.a.k)}${r.upd ? ' <span class="pill warn">organisation à mettre à jour</span>' : r.dup ? ' <span class="pill ok">à jour</span>' : !r.kid ? ' <span class="pill err">enfant introuvable</span>' : ' <span class="pill">à créer</span>'}</div>
      <div class="ls">${r.data ? esc(ucf(evText(r.data).split(' · ').slice(0, 2).join(' · '))) : ''} · 📍 ${esc(r.a.place)}<br>Dépose : <b>${esc(who(tg, r.a.by))}</b> · récupération : <b>${esc(who(tg, r.a.tk))}</b>${r.a.match ? '<br>Peut être remplacé par un match de foot' : ''}</div></div></div>`).join('')}`; };
  const any = tgs.some(tg => presetRows(tg).some(r => (r.data && !r.dup) || r.upd));
  const sh = openSheet(`<h3 class="sh-title">⚽📖 Activités de l'année</h3>${tgs.map(sec).join('')}
    <div class="hint">Vous en serez le créateur : vous seul pourrez les modifier ou les supprimer. Absences et matchs : les deux parents.</div>
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">${any ? 'Annuler' : 'Fermer'}</button>${any ? `<button class="btn primary f1" data-act="preset-act-go">Créer</button>` : ''}</div>`);
  sh._tgs = tgs;
}

export function coveredYears() {
  const ys = new Set();
  for (const p of S.plannings) if (p.state === 'active' && p.start && p.days) { const a = +p.start.slice(0, 4), b = +E.addDays(p.start, p.days.length - 1).slice(0, 4); for (let y = a; y <= b; y++) ys.add(y); }
  if (!ys.size) ys.add(new Date().getFullYear());
  return [...ys].sort();
}

// ───── Feuille « jour »
export function openDay(d) {
  const eng = engine(), ids = S.children.map(c => c.id), info = eng.dayInfo(d), pr = parents();
  const kids = S.children.map(c => {
    const code = eng.code(c.id, d);
    let txt = code === '.' ? 'Aucun planning' : E.isHalf(code) ? `${pr[E.first(code)].name} jusqu'à ${E.fmtTime(settings().middayTime)}, puis ${pr[E.last(code)].name}` : `${pr[E.first(code)].name}${E.isDefault(code) ? " (semaine d'école)" : ''}`;
    const p = eng.planningAt(c.id, d);
    return `<div class="li"><div class="le" style="background:${cellBg([code])}">${esc(c.emoji || '🧒')}</div><div class="f1"><div class="lt">${esc(c.prenom)}</div><div class="ls">${esc(txt)}${eng.isOverridden(c.id, d) ? ' · <b>échange</b>' : ''}${p ? ' · ' + esc(p.title) : ''}</div></div></div>`;
  }).join('');
  const hs = eng.handovers(ids, d, d);
  const evs = occs(d, d);
  const tags = [info.ferie && `<span class="pill err">🎌 ${esc(info.ferie)}</span>`, info.eid && `<span class="pill" style="background:#E3F4EE;color:#00664F">${MOON(13)} ${esc(info.eid)}</span>`, info.comment && info.comment !== info.ferie && info.comment !== info.eid && `<span class="pill navy">${esc(info.comment)}</span>`, info.holiday && `<span class="pill warn">${info.holiday.i} ${esc(info.holiday.n)}</span>`].filter(Boolean).join(' ');
  openSheet(`<h3 class="sh-title">${E.fmtDate(d, 'wdmy')}</h3>${tags ? `<div class="row wrap gap6 mb">${tags}</div>` : ''}
    ${kids || '<p class="muted">Aucun enfant.</p>'}
    ${hs.length ? `<div class="lbl">Relais</div>${hs.map(h => `<div class="tile"><span style="font-size:24px">🔁</span><div class="f1"><b>${hoTime(h)}</b> · ${esc(pName(h.from))} → ${esc(pName(h.to))}<div class="small muted">${esc(childNames(h.childIds))}${h.kind === 'matin' ? ' · le matin' : ''}${h.custom ? ' · horaire convenu' : ''}${esc(hoPlace(h))}</div>
        ${h.alt && isParent() && !h.custom ? `<button class="btn soft sm mtx" data-act="x-alt" data-d="${d}" data-kind="${h.kind}" data-kids="${h.childIds.join(',')}">↩️ Si impossible : ${esc(altText(h.alt, h))}</button>` : ''}</div>
      ${isParent() ? `<button class="btn soft sm" data-act="x-time" data-d="${d}" data-kind="${h.kind}" data-time="${h.time}" title="Changer l'horaire de ce relais">${IC.clock}</button>` : ''}</div>`).join('')}` : ''}
    <div class="lbl">Événements</div>${evs.length ? evs.map(e => occRow(e, false)).join('') : '<p class="muted small">Aucun événement.</p>'}
    ${isParent() ? `<div class="row gap mt"><button class="btn primary f1" data-act="ev-new" data-d="${d}">${IC.plus} Événement</button><button class="btn ghost f1" data-act="x-new" data-d="${d}">🔄 Échange</button></div>` : ''}`);
}

// ───── Événements : mêmes conditions que les relais habituels (quand, heures, dépose, récupération, lieux, repli)
// en plus des siennes (titre, catégorie, enfants, plusieurs jours, chaque mois, chaque année, notes).
// Quand deux réglages se ressemblent, c'est celui des relais qui est gardé (pas de doublon).
const ucf = x => x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
const joinFr = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]);
const schoolY = iso => (+iso.slice(5, 7) >= 8 ? +iso.slice(0, 4) : +iso.slice(0, 4) - 1);
/** Anciens événements (répétition, « qui accompagne », lieu libre) lus avec les nouveaux réglages */
function evForm(ev, date) {
  if (!ev) return { kind: 'date', date, dow: E.dow(date), dows: [E.dow(date)], every: 1, parity: E.isoWeek(date).week % 2 ? 'impair' : 'pair', school: false, cat: 'activite', childIds: selIds(), from: '', to: '', dropAt: '', pickAt: '', vis: 'all' };
  const e = { ...ev };
  if (!e.kind) {
    const r = e.repeat || 'none';
    e.kind = r === 'none' ? 'date' : r === 'weekly' || r === 'biweekly' ? 'dow' : r;
    e.dow = E.dow(e.date); e.every = r === 'biweekly' ? 2 : 1; e.parity = E.isoWeek(e.date).week % 2 ? 'impair' : 'pair';
    if (e.who === 'A' || e.who === 'B') { e.from = e.who; e.to = e.who; }
    if (e.place && !e.pickAt) { e.pickAt = 'autre'; e.pickTxt = e.place; }
    e.timeEnd = e.endTime || '';
  }
  e.dows = E.evDays(e); e.vis = e.pe ? 'parents' : 'all';
  return e;
}
/** « Chaque mercredi des semaines paires en période scolaire · 14h–15h30 · déposés par Khalid (Club) · récupérés… » */
export function evText(e, withWhen = true) {
  const k = E.evKind(e);
  let when = '';
  if (withWhen) {
    if (k === 'date') when = E.fmtDate(e.date, 'wdm') + (e.endDate && e.endDate > e.date ? ' → ' + E.fmtDate(e.endDate, 'wdm') : '');
    else if (k === 'dow') { const hol = E.evHol(e); when = `${+e.every === 2 ? 'le ' : 'chaque '}${joinFr(E.evDays(e).map(i => E.JOURS[i]))}${+e.every === 2 ? ` des semaines ${e.parity === 'impair' ? 'impaires' : 'paires'}` : ''}${hol === 'no' ? ' en période scolaire' : hol === 'w1' ? ' (vacances : 1re semaine seulement)' : ''}`; }
    else if (k === 'vacStart') when = 'veille des vacances scolaires';
    else if (k === 'vacEnd') when = 'dernier jour des vacances scolaires';
    else if (k === 'monthly') when = `chaque mois le ${+e.date.slice(8)}`;
    else if (k === 'yearly') when = `chaque année le ${E.fmtDate(e.date, 'dm')}`;
    else if (k === 'weekly') when = `chaque ${E.JOURS[E.dow(e.date)]}`;
    else if (k === 'biweekly') when = `un ${E.JOURS[E.dow(e.date)]} sur deux`;
    if (e.year) when += ` (année ${e.year}-${+e.year + 1})`;
  }
  const end = e.timeEnd || e.endTime, tm = e.time ? E.fmtTime(e.time) + (end ? '–' + E.fmtTime(end) : '') : 'toute la journée';
  const legacy = !e.kind && e.place ? ` · 📍 ${e.place}` : '';
  return `${when ? ucf(when) + ' · ' : ''}${tm}${e.kind ? dpText(e, e.pickPlace ?? placeLabel(e.pickAt || '', e.pickTxt || '')) : legacy}`;
}
function eventSheet(ev = null, date = E.todayISO()) {
  const e = evForm(ev, date);
  const ro = !!ev && !canEditEv(ev);
  const k0 = e.kind === 'dow' && +e.every === 2 ? (e.parity === 'impair' ? 'dowI' : 'dowP') : e.kind;
  const today = E.todayISO(), sy = schoolY(today), wk = E.isoWeek(today).week;
  const sh = openSheet(`<h3 class="sh-title">${ev ? '✏️ Modifier' : '🗓️ Nouvel'} événement</h3>
    <label class="lbl">Titre</label><input class="in" name="title" value="${esc(e.title || '')}" placeholder="Ex. Dentiste, Foot, Réunion parents-profs" autofocus>
    <label class="lbl">Catégorie</label>${chips('cat', EV_CATS.map(c => ({ v: c.v, l: `${c.i} ${c.l}` })), [e.cat])}
    <label class="lbl">Enfants concernés</label>${chips('childIds', S.children.map(c => ({ v: c.id, l: `${c.emoji || ''} ${esc(c.prenom)}` })), e.childIds || [], { multi: true })}
    <label class="lbl">Qui voit cet événement ?</label>${chips('vis', [{ v: 'all', l: '👨‍👩‍👧 Tout le cercle' }, { v: 'parents', l: '🔒 Les parents seulement' }], [e.vis || 'all'])}
    <div class="hint" data-part="vish">🔒 Ex. accompagnement d'une sortie scolaire : seul l'autre parent est informé, les proches ne le voient pas.</div>
    <label class="lbl">Quand ?</label>${chips('kind', [{ v: 'date', l: '📌 Une date' }, { v: 'dow', l: '📅 Chaque semaine' }, { v: 'dowP', l: '2️⃣ Semaines paires' }, { v: 'dowI', l: '1️⃣ Semaines impaires' }, { v: 'vacStart', l: '🎒 Veille des vacances' }, { v: 'vacEnd', l: '🏁 Fin des vacances' }, { v: 'monthly', l: '🗓️ Chaque mois' }, { v: 'yearly', l: '🎂 Chaque année' }], [k0])}
    <div data-part="par" class="hint hide">Cette semaine : n° ${wk} (semaine ${wk % 2 ? 'impaire' : 'paire'}).</div>
    <div class="two"><div><label class="lbl" data-part="dl">Date</label><input class="in" type="date" name="date" value="${e.date}"></div><div data-part="end"><label class="lbl">Jusqu'au (option)</label><input class="in" type="date" name="endDate" value="${e.endDate || ''}"></div></div>
    <div data-part="year"><label class="lbl">Année scolaire</label>${chips('year', [{ v: '', l: 'Toutes les années' }, ...[sy, sy + 1].map(y => ({ v: String(y), l: `${y}-${y + 1}` }))], [e.year || ''])}</div>
    <div data-part="dow"><label class="lbl">Jours (un ou plusieurs)</label>${chips('dows', E.JOURS.map((j, i) => ({ v: String(i), l: ucf(j) })), e.dows.map(String), { multi: true })}
      <label class="lbl">Pendant les vacances scolaires ?</label>${chips('hol', [{ v: 'no', l: '🚫 Rien (période scolaire seulement)' }, { v: 'w1', l: '1️⃣ 1re semaine seulement' }, { v: 'yes', l: '✅ Maintenu' }], [E.evHol(e)])}
      <div class="hint">Les jours fériés ne changent rien : supprimez la séance de ce jour-là si besoin.</div></div>
    <div class="two"><div><label class="lbl">Heure</label><input class="in" type="time" name="time" value="${e.time || ''}"></div><div><label class="lbl">Jusqu'à (option)</label><input class="in" type="time" name="timeEnd" value="${e.timeEnd || ''}"></div></div>
    <div class="hint">Laissez l'heure vide pour un événement sur la journée.</div>
    <label class="lbl">Qui dépose les enfants ?</label>${whoChips('from', e.from)}
    <label class="lbl">Lieu de dépose</label>${placeSel('dropAt', e.dropAt || '', e.dropTxt || '', 'Non précisé')}
    <label class="lbl">Qui récupère les enfants ?</label>${whoChips('to', e.to)}
    <label class="lbl">Lieu de récupération</label>${placeSel('pickAt', e.pickAt || '', e.pickTxt || '', 'Non précisé')}
    <label class="row gap mt"><span class="sw"><input type="checkbox" name="altOn" ${e.alt?.on ? 'checked' : ''}><span></span></span><span class="f1">Si impossible : solution de repli</span></label>
    <div data-part="alt" class="hide">
      <label class="lbl">Quand ?</label>${chips('altWhen', [{ v: 'veille', l: 'La veille' }, { v: 'jour', l: 'Le jour même' }], [e.alt?.when || 'jour'])}
      <label class="lbl">Heure</label><input class="in" type="time" name="altTime" value="${e.alt?.time || ''}">
      <label class="lbl">Qui dépose les enfants ?</label>${chips('altBy', [{ v: 'A', l: esc(parents().A.name) }, { v: 'B', l: esc(parents().B.name) }], [e.alt?.by || e.from || 'A'])}
      <label class="lbl">Lieu</label>${placeSel('altAt', e.alt?.at || '', e.alt?.txt || '')}
    </div>
    <label class="row gap mt"><span class="sw"><input type="checkbox" name="matchSwap" ${e.matchSwap ? 'checked' : ''}><span></span></span><span class="f1">Une séance peut être remplacée par un match de foot (horaires et lieu du match)</span></label>
    <label class="lbl">Notes</label><textarea class="in" name="notes" rows="3">${esc(e.notes || '')}</textarea>
    ${ro ? '' : alertsBlock('ev', ev?.id || null)}
    <div class="sh-actions">${ro ? '<button class="btn primary f1" data-act="close-sheet">Fermer</button>' : `${ev ? `<button class="btn danger" data-act="occ-del" data-id="${ev.id}" data-d="${date}">${IC.trash}</button>` : ''}<button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="ev-save" data-id="${ev?.id || ''}">Enregistrer</button>`}</div>`);
  let cat0 = e.cat;
  const upd = () => {
    const f = readForm(sh), k = f.kind || 'date', rec = k !== 'date';
    if (f.cat !== cat0) { cat0 = f.cat; const v = sh.querySelector('[data-group="vis"] [data-val="parents"]'); if (f.cat === 'accomp' && v && !v.classList.contains('on')) v.click(); }
    sh.querySelector('[data-part="vish"]').classList.toggle('hide', f.vis !== 'parents');
    sh.querySelector('[data-part="dow"]').classList.toggle('hide', !k.startsWith('dow'));
    sh.querySelector('[data-part="par"]').classList.toggle('hide', k !== 'dowP' && k !== 'dowI');
    sh.querySelector('[data-part="end"]').classList.toggle('hide', rec);
    sh.querySelector('[data-part="year"]').classList.toggle('hide', !rec);
    sh.querySelector('[data-part="dl"]').textContent = rec ? 'À partir du' : 'Date';
    sh.querySelector('[data-part="alt"]').classList.toggle('hide', !f.altOn);
    placeToggle(sh);
  };
  sh.addEventListener('chipchange', upd); sh.addEventListener('change', upd); upd();
  if (!ro) alertsBlockBind(sh);
  return sh;
}
/** Contrôle et mise en forme des réglages de l'événement (mêmes contrôles que les horaires réguliers) */
function evFromForm(f) {
  const k = f.kind || 'date', t = x => String(x || '').trim(), rec = k !== 'date';
  if (!f.title) return "Donnez un titre à l'événement.";
  if (!f.date) return rec ? 'Choisissez la date de début.' : 'Choisissez une date.';
  if (!rec && f.endDate && f.endDate < f.date) return 'La date de fin doit suivre la date de début.';
  if (!f.time && f.timeEnd) return "Indiquez l'heure de début.";
  if (f.time && f.timeEnd && f.timeEnd <= f.time) return "L'heure de fin doit suivre l'heure de début.";
  if (f.dropAt === 'autre' && !t(f.dropAtTxt)) return 'Précisez le lieu de dépose.';
  if (f.pickAt === 'autre' && !t(f.pickAtTxt)) return 'Précisez le lieu de récupération.';
  if (f.altOn && !f.altTime) return "Indiquez l'heure de la solution de repli.";
  if (f.altOn && !f.altAt) return 'Choisissez le lieu de la solution de repli.';
  if (f.altOn && f.altAt === 'autre' && !t(f.altAtTxt)) return 'Précisez le lieu de la solution de repli.';
  if (k.startsWith('dow') && !(f.dows || []).length) return 'Choisissez au moins un jour.';
  const kind = k.startsWith('dow') ? 'dow' : k, every = k === 'dowP' || k === 'dowI' ? 2 : 1, year = rec ? f.year || '' : '';
  const dropPlace = placeLabel(f.dropAt, f.dropAtTxt), pickPlace = placeLabel(f.pickAt, f.pickAtTxt);
  return {
    title: f.title, cat: f.cat || 'autre', icon: catIcon(f.cat), childIds: f.childIds || [], kind, date: f.date, endDate: rec ? '' : f.endDate || '',
    dow: kind === 'dow' ? +(f.dows[0]) : E.dow(f.date), dows: kind === 'dow' ? f.dows.map(Number).sort((a, b) => a - b) : [], every, parity: k === 'dowI' ? 'impair' : 'pair',
    school: kind === 'dow' && f.hol !== 'yes', holW1: kind === 'dow' && f.hol === 'w1', year, vis: f.vis === 'parents' ? 'parents' : 'all', matchSwap: !!f.matchSwap,
    time: f.time || '', timeEnd: f.timeEnd || '', endTime: f.timeEnd || '',
    from: f.from || '', dropAt: f.dropAt || '', dropTxt: f.dropAt === 'autre' ? t(f.dropAtTxt) : '', dropPlace,
    to: f.to || '', pickAt: f.pickAt || '', pickTxt: f.pickAt === 'autre' ? t(f.pickAtTxt) : '', pickPlace, place: pickPlace || dropPlace,
    alt: f.altOn ? { on: true, when: f.altWhen || 'jour', time: f.altTime, by: f.altBy || '', at: f.altAt, txt: f.altAt === 'autre' ? t(f.altAtTxt) : '', place: placeLabel(f.altAt, f.altAtTxt) } : null,
    notes: f.notes || '',
    // anciennes versions de l'appli
    repeat: kind === 'dow' ? (every === 2 ? 'biweekly' : 'weekly') : kind === 'monthly' || kind === 'yearly' ? kind : 'none', until: year ? `${+year + 1}-08-31` : '', who: f.from || 'custodian',
  };
}
/** Fiche d'une séance (un jour donné) : état, absence, match, mes rappels ; modifier / supprimer pour le parent créateur */
function occSheet(ev, d) {
  const x = ev.pe ? null : evxMap()[E.evxKey(ev.id, d)] || null, par = isParent(), mine = canEditEv(ev);
  const rec = E.evKind(ev) !== 'date' || (ev.endDate && ev.endDate > ev.date), o = ev.ovr?.[d] ? { ...ev, ...ev.ovr[d], occ: d, edited: true } : { ...ev, occ: d };
  const tm = (a, b) => (a ? E.fmtTime(a) + (b ? '–' + E.fmtTime(b) : '') : '');
  const status = !x ? '' : x.type === 'absent'
    ? `<div class="alert mt"><div class="ai">❌</div><div class="f1"><div class="at">Absent${x.cause ? ' : ' + esc(x.cause) : ''}</div><div class="small">Noté par ${esc(x.byName || '')} · ${fmtStamp(x.at)}</div></div></div>`
    : `<div class="alert info mt"><div class="ai">⚽</div><div class="f1"><div class="at">Remplacé par un match de foot${x.child ? ' de ' + esc(childName(x.child)) : ''}</div><div class="small">${tm(x.time, x.timeEnd) || 'Horaire non précisé'}${x.place ? ' · 📍 ' + esc(x.place) : ''} · noté par ${esc(x.byName || '')}</div></div></div>`;
  openSheet(`<h3 class="sh-title">${ev.icon || catIcon(ev.cat)} ${esc(ev.title)}</h3>
    <div class="muted small">${E.fmtDate(d, 'wdmy')}${ev.childIds?.length ? ' · ' + esc(childNames(ev.childIds)) : ''}${ev.pe ? ' · <span class="pill">🔒 Parents seulement</span>' : ''}</div>
    <div class="card tight mt"><div class="small ${x ? 'occ-x' : ''}">${esc(ucf(evText(o, false)))}</div>${o.edited ? '<div class="tiny mtx"><span class="pill warn">✏️ modifié pour ce jour</span></div>' : ''}${rec ? `<div class="tiny muted mtx">🔁 ${esc(ucf(evText(ev).split(' · ')[0]))}</div>` : ''}${o.notes ? `<div class="small mt">📝 ${esc(o.notes)}</div>` : ''}</div>
    ${status}
    ${par && !ev.pe ? (x ? `<button class="btn soft block mt" data-act="occ-restore" data-id="${ev.id}" data-d="${d}">↩️ Rétablir la séance</button>`
      : `<div class="row gap mt"><button class="btn soft f1" data-act="occ-absent" data-id="${ev.id}" data-d="${d}">🙋 Absent</button>${ev.matchSwap ? `<button class="btn soft f1" data-act="occ-match" data-id="${ev.id}" data-d="${d}">⚽ Match de foot</button>` : ''}</div>`) : ''}
    ${par ? `<button class="btn soft block mt" data-act="occ-alerts" data-id="${ev.id}">🔔 Mes rappels</button>` : ''}
    ${mine ? `<div class="row gap mt"><button class="btn ghost f1" data-act="occ-edit" data-id="${ev.id}" data-d="${d}">✏️ Modifier</button><button class="btn danger f1" data-act="occ-del" data-id="${ev.id}" data-d="${d}">${IC.trash} Supprimer…</button></div>`
      : par ? `<div class="hint mt">Créé par ${esc(ev.createdByName || "l'autre parent")} : lui seul peut le modifier ou le supprimer.</div>` : ''}
    <div class="sh-actions"><button class="btn primary f1" data-act="close-sheet">Fermer</button></div>`);
}
const evColl = ev => (ev.pe ? 'pevents' : 'events');
/** Modifier une ou plusieurs séances seulement : heures, qui dépose / récupère et où, note (le reste de la série ne change pas) */
function occEditForm(ev, days) {
  const o = { ...ev, ...(ev.ovr?.[days[0]] || {}) }, many = days.length > 1;
  const sh = openSheet(`<h3 class="sh-title">✏️ ${many ? `Modifier ${days.length} séances` : 'Modifier le ' + E.fmtDate(days[0], 'wdm')}</h3>
    <div class="muted small">${esc(ev.title)}${ev.childIds?.length ? ' · ' + esc(childNames(ev.childIds)) : ''} : ${many ? 'ces jours-là' : 'ce jour-là'} seulement, le reste de la série ne change pas.</div>
    ${many ? `<div class="tiny muted mtx">${days.map(d => E.fmtDate(d, 'short')).join(' · ')}</div>` : ''}
    <div class="two"><div><label class="lbl">Heure</label><input class="in" type="time" name="time" value="${o.time || ''}"></div><div><label class="lbl">Jusqu'à (option)</label><input class="in" type="time" name="timeEnd" value="${o.timeEnd || o.endTime || ''}"></div></div>
    <label class="lbl">Qui dépose les enfants ?</label>${whoChips('from', o.from)}
    <label class="lbl">Lieu de dépose</label>${placeSel('dropAt', o.dropAt || '', o.dropTxt || '', 'Non précisé')}
    <label class="lbl">Qui récupère les enfants ?</label>${whoChips('to', o.to)}
    <label class="lbl">Lieu de récupération</label>${placeSel('pickAt', o.pickAt || '', o.pickTxt || '', 'Non précisé')}
    <label class="lbl">Note pour ${many ? 'ces séances' : 'cette séance'} (option)</label><input class="in" name="notes" maxlength="200" value="${esc(ev.ovr?.[days[0]]?.notes || '')}">
    ${days.some(d => ev.ovr?.[d]) ? `<button class="btn soft block mt" data-act="occ-ovr-reset" data-id="${ev.id}" data-days="${days.join(',')}">↩️ Revenir aux réglages de la série</button>` : ''}
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="occ-ovr-save" data-id="${ev.id}" data-days="${days.join(',')}">Enregistrer</button></div>`);
  sh.addEventListener('chipchange', () => placeToggle(sh)); placeToggle(sh);
}
/** Choix des séances (cases à cocher) pour supprimer ou modifier */
function pickDaysSheet(ev, d, act, label, cls) {
  const list = nextOccs(ev, d);
  openSheet(`<h3 class="sh-title">☑️ Séances à ${label}</h3><div class="muted small">${esc(ev.title)} · cochez les jours</div>
    <div class="ckl">${list.map(o => `<label><input type="checkbox" name="days" value="${o}" ${o === d ? 'checked' : ''}><span class="f1">${E.fmtDate(o, 'wdmy')}${ev.ovr?.[o] ? ' ✏️' : ''}</span></label>`).join('') || '<div class="muted small">Aucune séance à venir.</div>'}</div>
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn ${cls} f1" data-act="${act}" data-m="multi" data-id="${ev.id}">${ucf(label)}</button></div>`);
}
/** Prochaines séances d'un événement (pour en supprimer plusieurs) */
function nextOccs(ev, d) { const from = d < E.todayISO() ? d : E.todayISO(); return E.expandEvents([ev], from, E.addDays(from, 190), settings()).map(o => o.occ).slice(0, 80); }
async function delOccs(ev, days) {
  const ex = [...new Set([...(ev.exceptions || []), ...days])].sort();
  await updItem(evColl(ev), ev.id, { exceptions: ex });
  for (const d of days) if (S.evx.some(x => x.evId === ev.id && x.date === d)) await S.be.db.del(fpath('evx', E.evxKey(ev.id, d))).catch(() => { });
  await log('agenda', `${days.length > 1 ? days.length + ' séances supprimées' : 'Séance supprimée'} : ${ev.title}`, { body: days.map(d => E.fmtDate(d, 'wdm')).join(', '), link: `agenda?d=${days[0]}` });
}

export const after = {
  agenda() {
    if (S.route.params.preset === 'activites') {
      if (!isParent() || !S.loaded.events || !S.children.length) return; // attendre le chargement du cercle
      history.replaceState(null, '', '#/agenda'); S.route = { view: 'agenda', params: {} }; setTimeout(presetSheet, 300); return;
    } const d = S.ui.openDay; if (d) { S.ui.openDay = null; S.route = { view: 'agenda', params: { mode: 'mois', m: ym(d) } }; history.replaceState(null, '', `#/agenda?mode=mois&m=${ym(d)}`); setTimeout(() => openDay(d), 150); } },
};
export const actions = {
  'print-year': el => openPrint(el.dataset.y ? +el.dataset.y : null),
  'open-day': el => openDay(el.dataset.d),
  'ag-mode': el => { S.ui.agMode = el.dataset.m; go('agenda', { mode: el.dataset.m, m: S.ui.agM }); },
  'ag-shift': el => go('agenda', { mode: 'mois', m: shiftMonth(S.ui.agM || ym(E.todayISO()), +el.dataset.k) }),
  'ag-year': el => go('agenda', { mode: 'annee', y: String((+(S.route.params.y || (S.ui.agM || E.todayISO()).slice(0, 4))) + (+el.dataset.k)) }),
  'ag-month': el => go('agenda', { mode: 'mois', m: el.dataset.m }),
  'ag-today': () => go('agenda', { mode: 'mois', m: ym(E.todayISO()) }),
  'ag-tab': el => { S.ui.agTab = el.dataset.t; S.render(); },
  'ev-new': el => { if (!isParent()) return toast('Seuls les parents créent des événements.', 'warn'); eventSheet(null, el.dataset.d || E.todayISO()); },
  'ev-open': el => { const ev = findEvent(el.dataset.id); if (ev) occSheet(ev, el.dataset.d || ev.date); },
  'ev-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), data = evFromForm(f);
    if (typeof data === 'string') return toast(data, 'warn');
    const id = el.dataset.id, ev = id ? findEvent(id) : null;
    if (!isParent() || (id && !canEditEv(ev))) return toast("Seul le parent qui a créé l'événement peut le modifier.", 'warn');
    el.disabled = true;
    const coll = data.vis === 'parents' ? 'pevents' : 'events', lock = coll === 'pevents' ? ' 🔒' : '';
    const ok = await guard(async () => {
      let eid = id;
      if (id && evColl(ev) === coll) await updItem(coll, id, data);
      else if (id) { // passage « tout le cercle » ↔ « parents seulement » : même identifiant, autre collection
        await S.be.db.set(fpath(coll, id), { createdAt: ev.createdAt || Date.now(), createdBy: ev.createdBy || uid(), createdByName: ev.createdByName || myName(), exceptions: ev.exceptions || [], ...data, updatedAt: Date.now(), updatedBy: uid() });
        await S.be.db.del(fpath(evColl(ev), id));
      } else eid = await addItem(coll, data);
      await saveItemAlerts('ev', eid, f);
      await log('agenda', `${id ? 'Événement modifié' : 'Nouvel événement'} : ${f.title}${lock}`, { body: evText(data) + (lock ? ' · visible uniquement par les parents' : ''), link: `agenda?d=${data.date}` });
      queueReminders();
      return true;
    }, 'Événement enregistré');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'act-perso': el => { const f = readForm(el.closest('.card')); go('activites', { m: 'perso', from: f.from, to: f.to }); },
  'preset-act-go': async el => {
    const sh = el.closest('.sheet'), tgs = sh._tgs || [], pick = [...sh.querySelectorAll('input[name=pt]:checked')].map(i => tgs[+i.value]).filter(Boolean);
    if (!pick.length || !isParent()) return toast('Cochez au moins un cercle.', 'warn');
    el.disabled = true;
    let n = 0;
    const ok = await guard(async () => {
      for (const tg of pick) {
        const rows = presetRows(tg), todo = rows.filter(r => r.data && !r.dup);
        for (const r of todo) {
          if (tg.cur) await addItem('events', r.data);
          else await S.be.db.set(`families/${tg.fid}/events/${S.be.db.newId()}`, { ...r.data, createdAt: Date.now(), createdBy: uid(), createdByName: myName() });
          n++;
        }
        // organisation (qui dépose, qui récupère, où) des activités déjà créées
        for (const r of rows.filter(r => r.upd)) {
          if (tg.cur) await updItem('events', r.upd.id, r.upd.patch);
          else await S.be.db.update(`families/${tg.fid}/events/${r.upd.id}`, { ...r.upd.patch, updatedAt: Date.now(), updatedBy: uid() });
          n++;
        }
        if (tg.cur && rows.some(r => r.upd)) await log('agenda', 'Organisation des activités mise à jour', { body: rows.filter(r => r.upd).map(r => `${r.a.t} (${r.a.k})`).join(', ') });
        if (tg.cur && todo.length) await log('agenda', `${plural(todo.length, 'activité')} ajoutée${todo.length > 1 ? 's' : ''} à l'agenda`, { body: todo.map(r => `${r.a.t} (${r.a.k})`).join(', ') });
      }
      queueReminders(); return true;
    });
    if (ok) { closeSheet(); toast(`${plural(n, 'changement')} enregistré${n > 1 ? 's' : ''}${pick.length > 1 ? ' dans les deux cercles' : ''}`, 'ok', 3500); } else el.disabled = false;
  },
  'occ-edit': el => {
    const ev = findEvent(el.dataset.id), d = el.dataset.d || ev?.date; if (!canEditEv(ev)) return toast("Seul le parent qui a créé l'événement peut le modifier.", 'warn');
    const rec = E.evKind(ev) !== 'date' || (ev.endDate && ev.endDate > ev.date);
    if (!rec) return closeSheetsThen(() => eventSheet(ev, d));
    openSheet(`<h3 class="sh-title">✏️ Modifier</h3><div class="muted small mb">${esc(ev.title)}</div>
      <button class="btn soft block" data-act="occ-edit-go" data-m="day" data-id="${ev.id}" data-d="${d}">🗓️ Ce jour seulement · ${E.fmtDate(d, 'wdm')}</button>
      <button class="btn soft block mt" data-act="occ-edit-pick" data-id="${ev.id}" data-d="${d}">☑️ Plusieurs jours…</button>
      <button class="btn primary block mt" data-act="occ-edit-go" data-m="all" data-id="${ev.id}" data-d="${d}">🔁 Toute la série</button>
      <div class="hint">Un jour ou plusieurs : heures, qui dépose ou récupère et où. Toute la série : tous les réglages.</div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button></div>`);
  },
  'occ-edit-pick': el => { const ev = findEvent(el.dataset.id); if (canEditEv(ev)) pickDaysSheet(ev, el.dataset.d, 'occ-edit-go', 'modifier', 'primary'); },
  'occ-edit-go': el => {
    const ev = findEvent(el.dataset.id), m = el.dataset.m; if (!canEditEv(ev)) return;
    if (m === 'all') return closeSheetsThen(() => eventSheet(ev, el.dataset.d));
    const days = m === 'day' ? [el.dataset.d] : [...el.closest('.sheet').querySelectorAll('input[name=days]:checked')].map(i => i.value);
    if (!days.length) return toast('Cochez au moins un jour.', 'warn');
    closeSheetsThen(() => occEditForm(ev, days));
  },
  'occ-ovr-save': async el => {
    const ev = findEvent(el.dataset.id), days = el.dataset.days.split(','), f = readForm(el.closest('.sheet')); if (!canEditEv(ev)) return;
    const t = x => String(x || '').trim();
    if (f.timeEnd && f.time && f.timeEnd <= f.time) return toast("L'heure de fin doit suivre l'heure de début.", 'warn');
    if ((f.dropAt === 'autre' && !t(f.dropAtTxt)) || (f.pickAt === 'autre' && !t(f.pickAtTxt))) return toast('Précisez le lieu.', 'warn');
    const dropPlace = placeLabel(f.dropAt, f.dropAtTxt), pickPlace = placeLabel(f.pickAt, f.pickAtTxt);
    const o = { time: f.time || '', timeEnd: f.timeEnd || '', endTime: f.timeEnd || '', from: f.from || '', dropAt: f.dropAt || '', dropTxt: f.dropAt === 'autre' ? t(f.dropAtTxt) : '', dropPlace,
      to: f.to || '', pickAt: f.pickAt || '', pickTxt: f.pickAt === 'autre' ? t(f.pickAtTxt) : '', pickPlace, place: pickPlace || dropPlace, ...(t(f.notes) ? { notes: t(f.notes) } : {}) };
    const ovr = { ...(ev.ovr || {}) }; for (const d of days) ovr[d] = o;
    const ok = await guard(async () => {
      await updItem(evColl(ev), ev.id, { ovr });
      await log('agenda', `${days.length > 1 ? days.length + ' séances modifiées' : 'Séance modifiée'} : ${ev.title}`, { body: `${days.map(d => E.fmtDate(d, 'wdm')).join(', ')} · ${evText({ ...ev, ...o }, false)}`, link: `agenda?d=${days[0]}` });
      queueReminders(); return true;
    }, days.length > 1 ? `${days.length} séances modifiées` : 'Séance modifiée');
    if (ok) closeSheetsThen(() => occSheet(findEvent(ev.id) || ev, days[0]));
  },
  'occ-ovr-reset': async el => {
    const ev = findEvent(el.dataset.id), days = el.dataset.days.split(','); if (!canEditEv(ev)) return;
    const ovr = { ...(ev.ovr || {}) }; for (const d of days) delete ovr[d];
    const ok = await guard(async () => { await updItem(evColl(ev), ev.id, { ovr }); queueReminders(); return true; }, 'Réglages de la série rétablis');
    if (ok) closeSheetsThen(() => occSheet(findEvent(ev.id) || ev, days[0]));
  },
  'occ-alerts': el => { const ev = findEvent(el.dataset.id); if (ev) myAlertsSheet('ev', ev.id, ev.title); },
  'occ-absent': el => {
    const ev = findEvent(el.dataset.id), d = el.dataset.d; if (!ev) return;
    openSheet(`<h3 class="sh-title">🙋 Absent</h3><div class="muted small mb">${esc(ev.title)} · ${E.fmtDate(d, 'wdmy')}${ev.childIds?.length ? ' · ' + esc(childNames(ev.childIds)) : ''}</div>
      <label class="lbl">Cause (facultatif)</label><input class="in" name="cause" maxlength="120" placeholder="Ex. malade, rendez-vous, sortie en famille">
      <div class="hint">La séance reste dans l'agenda, barrée, et compte comme une absence dans le bilan.</div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="occ-x-save" data-t="absent" data-id="${ev.id}" data-d="${d}">Enregistrer</button></div>`);
  },
  'occ-match': el => {
    const ev = findEvent(el.dataset.id), d = el.dataset.d; if (!ev) return;
    openSheet(`<h3 class="sh-title">⚽ Match de foot à la place</h3><div class="muted small mb">${esc(ev.title)} · ${E.fmtDate(d, 'wdmy')} : la séance est annulée.</div>
      <label class="lbl">Match de</label>${chips('child', S.children.map(c => ({ v: c.id, l: `${c.emoji || ''} ${esc(c.prenom)}` })), [ev.childIds?.[0] || S.children[0]?.id || ''])}
      <div class="two"><div><label class="lbl">Début</label><input class="in" type="time" name="time"></div><div><label class="lbl">Fin (option)</label><input class="in" type="time" name="timeEnd"></div></div>
      <label class="lbl">Lieu</label><input class="in" name="place" maxlength="120" placeholder="Ex. Stade de Concyr, Olivet">
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="occ-x-save" data-t="match" data-id="${ev.id}" data-d="${d}">Enregistrer</button></div>`);
  },
  'occ-x-save': async el => {
    const ev = findEvent(el.dataset.id), d = el.dataset.d, t = el.dataset.t, f = readForm(el.closest('.sheet'));
    if (!ev || !isParent()) return;
    if (t === 'match' && !f.time) return toast("Indiquez l'heure du match.", 'warn');
    if (t === 'match' && f.timeEnd && f.timeEnd <= f.time) return toast("L'heure de fin doit suivre l'heure de début.", 'warn');
    if (t === 'match' && !f.place) return toast('Indiquez le lieu du match.', 'warn');
    const x = { evId: ev.id, date: d, type: t, title: ev.title, childIds: ev.childIds || [], by: uid(), byName: myName(), at: Date.now(),
      ...(t === 'absent' ? { cause: f.cause || '' } : { child: f.child || '', time: f.time, timeEnd: f.timeEnd || '', place: f.place }) };
    const ok = await guard(async () => {
      await S.be.db.set(fpath('evx', E.evxKey(ev.id, d)), x);
      await log('agenda', t === 'absent' ? `Absent : ${ev.title}${ev.childIds?.length ? ' (' + childNames(ev.childIds) + ')' : ''}` : `Match de foot à la place de : ${ev.title}`,
        { body: `${E.fmtDate(d, 'wdm')}${t === 'absent' ? (x.cause ? ' · ' + x.cause : '') : ` · ${childName(x.child)} · ${E.fmtTime(x.time)}${x.timeEnd ? '–' + E.fmtTime(x.timeEnd) : ''} · ${x.place}`}`, link: `agenda?d=${d}` });
      queueReminders();
      return true;
    }, t === 'absent' ? 'Absence notée' : 'Match noté');
    if (ok) closeSheetsThen(() => occSheet(ev, d));
  },
  'occ-restore': async el => {
    const ev = findEvent(el.dataset.id), d = el.dataset.d; if (!ev || !isParent()) return;
    const ok = await guard(async () => { await S.be.db.del(fpath('evx', E.evxKey(ev.id, d))); await log('agenda', `Séance rétablie : ${ev.title}`, { body: E.fmtDate(d, 'wdm'), link: `agenda?d=${d}` }); queueReminders(); return true; }, 'Séance rétablie');
    if (ok) closeSheetsThen(() => occSheet(ev, d));
  },
  'occ-del': async el => {
    const ev = findEvent(el.dataset.id), d = el.dataset.d || ev?.date; if (!canEditEv(ev)) return toast("Seul le parent qui a créé l'événement peut le supprimer.", 'warn');
    const rec = E.evKind(ev) !== 'date' || (ev.endDate && ev.endDate > ev.date);
    if (!rec) return actions['occ-del-go']({ dataset: { id: ev.id, m: 'all' } });
    openSheet(`<h3 class="sh-title">🗑️ Supprimer</h3><div class="muted small mb">${esc(ev.title)}</div>
      <button class="btn soft block" data-act="occ-del-go" data-m="day" data-id="${ev.id}" data-d="${d}">🗓️ Ce jour seulement · ${E.fmtDate(d, 'wdm')}</button>
      <button class="btn soft block mt" data-act="occ-del-pick" data-id="${ev.id}" data-d="${d}">☑️ Plusieurs jours…</button>
      <button class="btn danger block mt" data-act="occ-del-go" data-m="all" data-id="${ev.id}">${IC.trash} Toute la série</button>
      <div class="hint">Une séance supprimée disparaît de l'agenda et du bilan. Pour une absence, utilisez plutôt « 🙋 Absent ».</div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button></div>`);
  },
  'occ-del-pick': el => { const ev = findEvent(el.dataset.id); if (canEditEv(ev)) pickDaysSheet(ev, el.dataset.d, 'occ-del-go', 'supprimer', 'danger'); },
  'occ-del-go': async el => {
    const ev = findEvent(el.dataset.id), m = el.dataset.m; if (!canEditEv(ev)) return;
    if (m === 'all') {
      if (!(await confirmBox('Supprimer toute la série ?', `${esc(ev.title)} : toutes les séances, passées et à venir.`, 'Supprimer', true))) return;
      const ok = await guard(async () => {
        await S.be.db.del(fpath(evColl(ev), ev.id));
        for (const x of S.evx.filter(x => x.evId === ev.id)) await S.be.db.del(fpath('evx', x.id)).catch(() => { });
        await log('agenda', `Événement supprimé : ${ev.title}`); queueReminders(); return true;
      }, 'Événement supprimé');
      if (ok) closeSheetsThen(null);
      return;
    }
    const days = m === 'day' ? [el.dataset.d] : [...el.closest('.sheet').querySelectorAll('input[name=days]:checked')].map(i => i.value);
    if (!days.length) return toast('Cochez au moins un jour.', 'warn');
    const ok = await guard(async () => { await delOccs(ev, days); queueReminders(); return true; }, days.length > 1 ? `${days.length} séances supprimées` : 'Séance supprimée');
    if (ok) closeSheetsThen(null);
  },
  'ics-sheet': () => {
    const today = E.todayISO();
    let end = E.addDays(today, 365); for (const c of S.children) { const cv = engine().coverage(c.id); if (cv && cv.to > end) end = cv.to; }
    openSheet(`<h3 class="sh-title">📤 Exporter vers mon agenda</h3>
      <p class="muted small">Crée un fichier .ics à ouvrir sur le téléphone : il s'ajoute à Google Agenda, Samsung Calendar ou Calendrier (iPhone). Vous profitez ensuite des widgets agenda natifs.</p>
      <label class="lbl">Enfants</label>${chips('kids', S.children.map(c => ({ v: c.id, l: esc(c.prenom) })), selIds(), { multi: true })}
      <div class="two"><div><label class="lbl">Du</label><input class="in" type="date" name="from" value="${today}"></div><div><label class="lbl">Au</label><input class="in" type="date" name="to" value="${end}"></div></div>
      <label class="row gap mt"><span class="sw"><input type="checkbox" name="ho" checked><span></span></span><span class="f1">Relais (${E.fmtTime(settings().handoverTime)}) avec rappel 2 h avant</span></label>
      <label class="row gap mt"><span class="sw"><input type="checkbox" name="bl" checked><span></span></span><span class="f1">Périodes de garde (journées entières)</span></label>
      <label class="row gap mt"><span class="sw"><input type="checkbox" name="ev" checked><span></span></span><span class="f1">Événements de l'agenda</span></label>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="ics-go">${IC.download} Télécharger</button></div>`);
  },
  'ics-go': el => {
    const f = readForm(el.closest('.sheet'));
    if (!f.kids.length) return toast('Choisissez au moins un enfant.', 'warn');
    const ics = E.buildICS({ engine: engine(), childIds: f.kids, children: S.children, parents: parents(), from: f.from, to: f.to, events: f.ev ? allEvents() : [], withHandovers: f.ho, withBlocks: f.bl });
    download(`SJ-Family-${f.kids.map(childName).join('-')}.ics`, ics, 'text/calendar');
    toast('Fichier .ics créé'); closeSheet();
  },
};
