// ═══════════════ Agenda : calendrier de garde + événements, jour, bilan, vacances, export ═══════════════
import * as E from './engine.js';
import { S, engine, parents, pName, pShort, selChildren, selIds, uid, myName, isParent, childName, childNames, settings, addItem, updItem, log, guard, fpath, go, LS } from './core.js';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, download, IC, closeSheetsThen } from './ui.js';
import { kidChips, cellBg } from './views-home.js';

export const EV_CATS = [
  { v: 'ecole', i: '🏫', l: 'École' }, { v: 'sante', i: '🩺', l: 'Santé' }, { v: 'activite', i: '⚽', l: 'Activité' },
  { v: 'anniv', i: '🎂', l: 'Anniversaire' }, { v: 'famille', i: '👨‍👩‍👧', l: 'Famille' }, { v: 'vacances', i: '🏖️', l: 'Sortie / vacances' }, { v: 'autre', i: '📌', l: 'Autre' },
];
const catIcon = c => EV_CATS.find(x => x.v === c)?.i || '📌';
const ym = iso => iso.slice(0, 7);
function shiftMonth(m, k) { let [y, mo] = m.split('-').map(Number); mo += k; while (mo > 12) { mo -= 12; y++; } while (mo < 1) { mo += 12; y--; } return `${y}-${String(mo).padStart(2, '0')}`; }
function legend() {
  const p = parents();
  return `<div class="legend"><span><i style="background:var(--pa)"></i>${esc(p.A.name)}</span><span><i style="background:var(--pb)"></i>${esc(p.B.name)}</span>
    <span><i style="background:var(--pb-l)"></i>École (${esc(p.B.short)})</span><span><i style="background:var(--pa-l)"></i>École (${esc(p.A.short)})</span>
    <span><i style="background:linear-gradient(90deg,var(--pa) 50%,var(--pb) 50%)"></i>Demi-journée</span>
    <span><i style="background:var(--gold);height:5px;vertical-align:2px"></i>Vacances scolaires</span><span><i style="background:var(--err);border-radius:50%;width:9px;height:9px"></i>Férié</span><span>🔁 Relais du soir</span><span><i style="border:2px dashed var(--navy);background:#fff"></i>Échange accepté</span></div>`;
}
function monthGrid(m) {
  const eng = engine(), ids = selIds(), today = E.todayISO();
  const first = `${m}-01`, start = E.mondayOf(first);
  const [y, mo] = m.split('-').map(Number), last = `${m}-${String(E.monthDays(y, mo)).padStart(2, '0')}`;
  const end = E.addDays(E.mondayOf(last), 6);
  const evs = E.expandEvents(S.events, start, end).filter(e => !e.childIds?.length || e.childIds.some(i => ids.includes(i)));
  const byDay = {}; for (const e of evs) (byDay[e.occ] ||= []).push(e);
  for (const c of S.children) if (c.birth && ids.includes(c.id)) for (const yy of [y - 1, y, y + 1]) { const d = `${yy}${c.birth.slice(4)}`; if (d >= start && d <= end) (byDay[d] ||= []).push({ icon: '🎂', title: `Anniversaire ${c.prenom}` }); }
  const hoDays = new Set(eng.handovers(ids, start, end).filter(h => h.kind === 'soir').map(h => h.date));
  let cells = E.JOURS_L.map(j => `<div class="dh">${j}</div>`).join('');
  for (const d of E.eachDay(start, end)) {
    const codes = ids.map(id => eng.code(id, d)), info = eng.dayInfo(d);
    const lbl = info.comment || info.ferie;
    const ovr = ids.some(id => eng.isOverridden(id, d));
    const dots = (byDay[d] || []).slice(0, 4).map(e => `<span class="dot" title="${esc(e.title)}" style="background:${e.icon === '🎂' ? 'var(--coral)' : 'var(--navy)'}"></span>`).join('');
    cells += `<button class="cday ${ym(d) !== m ? 'out' : ''} ${d === today ? 'today' : ''} ${d < today ? 'past' : ''} ${ovr ? 'ovr' : ''}" style="background:${cellBg(codes)}" data-act="open-day" data-d="${d}">
      ${info.ferie ? '<span class="fer"></span>' : ''}${hoDays.has(d) ? '<span class="rel">🔁</span>' : ''}<span class="dn">${+d.slice(8)}</span>
      ${lbl ? `<span class="cm">${esc(lbl.length > 16 ? lbl.slice(0, 15) + '…' : lbl)}</span>` : ''}<span class="dots">${dots}</span>${info.holiday ? '<span class="hol"></span>' : ''}</button>`;
  }
  return `<div class="cal">${cells}</div>`;
}
function monthLists(m) {
  const eng = engine(), ids = selIds(), [y, mo] = m.split('-').map(Number);
  const from = `${m}-01`, to = `${m}-${String(E.monthDays(y, mo)).padStart(2, '0')}`;
  const hs = eng.handovers(ids, E.addDays(from, -1), to);
  const evs = E.expandEvents(S.events, from, to).filter(e => !e.childIds?.length || e.childIds.some(i => ids.includes(i)));
  const tab = S.ui.agTab || 'relais';
  const body = tab === 'relais'
    ? (hs.length ? hs.map(h => `<button class="li" style="width:100%;text-align:left" data-act="open-day" data-d="${h.date}"><div class="le">🔁</div><div class="f1"><div class="lt">${E.fmtDate(h.date, 'wdm')} · ${E.fmtTime(h.time)}${h.custom ? ' <span class="pill warn">convenu</span>' : ''}</div>
        <div class="ls">${esc(pName(h.from))} → ${esc(pName(h.to))} · ${esc(childNames(h.childIds))}${h.kind === 'midi' ? ' · mi-journée' : ''}${h.place ? ' · ' + esc(h.place) : ''}</div></div></button>`).join('') : '<div class="empty">Aucun relais ce mois-ci.</div>')
    : (evs.length ? evs.map(e => `<button class="li" style="width:100%;text-align:left" data-act="ev-open" data-id="${e.id}" data-d="${e.occ}"><div class="le">${e.icon || catIcon(e.cat)}</div><div class="f1"><div class="lt">${esc(e.title)}</div>
        <div class="ls">${E.fmtDate(e.occ, 'wdm')}${e.time ? ' · ' + E.fmtTime(e.time) + (e.endTime ? '–' + E.fmtTime(e.endTime) : '') : ''}${e.childIds?.length ? ' · ' + esc(childNames(e.childIds)) : ''}${e.repeat && e.repeat !== 'none' ? ' · 🔁' : ''}</div></div></button>`).join('') : '<div class="empty">Aucun événement ce mois-ci.</div>');
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
      g += `<div class="c ${info.ferie ? 'fe' : ''}" style="background:${cellBg(ids.map(id => eng.code(id, iso)))}" title="${esc(info.comment || info.ferie || '')}">${d}</div>`;
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
    const mode = p.mode || S.ui.agMode || 'mois';
    const m = p.m || S.ui.agM || ym(E.todayISO()); S.ui.agM = m; S.ui.agMode = mode;
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
        <div class="row gap mb"><button class="btn primary f1" data-act="ev-new">${IC.plus} Événement</button><button class="btn soft" data-act="ag-today">Aujourd'hui</button><button class="btn soft" data-act="ics-sheet" title="Exporter">${IC.download}</button></div>
        ${monthLists(m)}` : ''}
      ${mode === 'annee' ? yearView(y) : ''}
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
        <div class="stat"><span></span><span class="small b">${esc(pr.A.short)}</span><span class="small b">${esc(pr.B.short)}</span>
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
    const list = E.schoolHolidays(zone, st.customHolidays || []).filter(h => h.e >= E.addDays(today, -200));
    const rows = list.map(h => {
      const parts = eng.blocks(ids[0], h.s, h.e).filter(b => b.key !== '.');
      const desc = parts.length ? parts.map(b => `<span class="pill" style="background:${b.code === 'A' || b.code === 'a' ? 'var(--pa)' : b.code === 'B' || b.code === 'b' ? 'var(--pb)' : '#eee'};color:#13233A">${esc(E.isHalf(b.code) ? '½ / ½' : pShort(E.first(b.code)))} · ${E.fmtDate(b.start, 'short')}${b.end !== b.start ? '→' + E.fmtDate(b.end, 'short') : ''}</span>`).join(' ') : '<span class="muted small">Pas de planning</span>';
      const ho = eng.handovers(ids, E.addDays(h.s, -1), h.e).filter(x => x.kind === 'soir');
      return `<div class="per" style="align-items:flex-start"><div class="pi">${h.i}</div><div class="f1"><div class="pn">${esc(h.n)} ${h.e < today ? '<span class="pill">passées</span>' : ''}</div>
        <div class="pd">Du ${E.fmtDate(h.s)} au ${E.fmtDate(h.e)}</div><div class="row wrap gap6 mt" style="margin-top:6px">${desc}</div>
        ${ho.length ? `<div class="tiny muted" style="margin-top:6px">🔁 ${ho.map(x => `${E.fmtDate(x.date, 'wdm')} ${E.fmtTime(x.time)} → ${esc(pShort(x.to))}`).join(' · ')}</div>` : ''}</div></div>`;
    }).join('');
    return {
      title: 'Vacances', back: 'home',
      html: `${kidChips()}<div class="card"><div class="row between"><b>Zone</b><div class="zone" style="margin:0">${['A', 'B', 'C'].map(z => `<button class="${z === zone ? 'on' : ''}" data-go="vacances" data-params='{"zone":"${z}"}'>${z}</button>`).join('')}</div></div>
        <div class="hint">${esc(E.ACADEMIES[zone])}</div>${ids.length > 1 ? `<div class="hint">Répartition affichée pour ${esc(childNames(ids.slice(0, 1)))} (touchez un prénom pour changer).</div>` : ''}</div>${rows}`,
    };
  },
};
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
  const evs = E.expandEvents(S.events, d, d);
  const tags = [info.ferie && `<span class="pill err">🎌 ${esc(info.ferie)}</span>`, info.comment && info.comment !== info.ferie && `<span class="pill navy">${esc(info.comment)}</span>`, info.holiday && `<span class="pill warn">${info.holiday.i} ${esc(info.holiday.n)}</span>`].filter(Boolean).join(' ');
  openSheet(`<h3 class="sh-title">${E.fmtDate(d, 'wdmy')}</h3>${tags ? `<div class="row wrap gap6 mb">${tags}</div>` : ''}
    ${kids || '<p class="muted">Aucun enfant.</p>'}
    ${hs.length ? `<div class="lbl">Relais</div>${hs.map(h => `<div class="tile"><span style="font-size:24px">🔁</span><div class="f1"><b>${E.fmtTime(h.time)}</b> · ${esc(pName(h.from))} → ${esc(pName(h.to))}<div class="small muted">${esc(childNames(h.childIds))}${h.custom ? ' · horaire convenu' : ''}${h.place ? ' · ' + esc(h.place) : ''}</div></div>
      ${isParent() ? `<button class="btn soft sm" data-act="x-time" data-d="${d}" data-kind="${h.kind}" data-time="${h.time}">${IC.clock}</button>` : ''}</div>`).join('')}` : ''}
    <div class="lbl">Événements</div>${evs.length ? evs.map(e => `<button class="li" style="width:100%;text-align:left" data-act="ev-open" data-id="${e.id}" data-d="${d}"><div class="le">${e.icon || catIcon(e.cat)}</div><div class="f1"><div class="lt">${esc(e.title)}</div><div class="ls">${e.time ? E.fmtTime(e.time) + (e.endTime ? '–' + E.fmtTime(e.endTime) : '') : 'Journée'}${e.childIds?.length ? ' · ' + esc(childNames(e.childIds)) : ''}${e.place ? ' · ' + esc(e.place) : ''}</div></div></button>`).join('') : '<p class="muted small">Aucun événement.</p>'}
    <div class="row gap mt"><button class="btn primary f1" data-act="ev-new" data-d="${d}">${IC.plus} Événement</button>${isParent() ? `<button class="btn ghost f1" data-act="x-new" data-d="${d}">🔄 Échange</button>` : ''}</div>`);
}

// ───── Événements
function eventSheet(ev = null, date = E.todayISO()) {
  const e = ev || { date, cat: 'activite', childIds: selIds(), repeat: 'none', who: 'custodian' };
  const p = parents();
  const sh = openSheet(`<h3 class="sh-title">${ev ? '✏️ Modifier' : '🗓️ Nouvel'} événement</h3>
    <label class="lbl">Titre</label><input class="in" name="title" value="${esc(e.title || '')}" placeholder="Ex. Dentiste, Foot, Réunion parents-profs" autofocus>
    <label class="lbl">Catégorie</label>${chips('cat', EV_CATS.map(c => ({ v: c.v, l: `${c.i} ${c.l}` })), [e.cat])}
    <label class="lbl">Enfants concernés</label>${chips('childIds', S.children.map(c => ({ v: c.id, l: `${c.emoji || ''} ${esc(c.prenom)}` })), e.childIds || [], { multi: true })}
    <div class="two"><div><label class="lbl">Date</label><input class="in" type="date" name="date" value="${e.date}"></div><div><label class="lbl">Jusqu'au (option)</label><input class="in" type="date" name="endDate" value="${e.endDate || ''}"></div></div>
    <div class="two"><div><label class="lbl">Début</label><input class="in" type="time" name="time" value="${e.time || ''}"></div><div><label class="lbl">Fin</label><input class="in" type="time" name="endTime" value="${e.endTime || ''}"></div></div>
    <div class="hint">Laissez l'heure vide pour un événement sur la journée.</div>
    <label class="lbl">Répétition</label><select class="in" name="repeat">${[['none', 'Aucune'], ['weekly', 'Chaque semaine'], ['biweekly', 'Toutes les 2 semaines'], ['monthly', 'Chaque mois'], ['yearly', 'Chaque année']].map(([v, l]) => `<option value="${v}" ${e.repeat === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <label class="lbl">Répéter jusqu'au</label><input class="in" type="date" name="until" value="${e.until || ''}">
    <label class="lbl">Qui accompagne / s'en occupe ?</label>${chips('who', [{ v: 'custodian', l: '👪 Parent de garde' }, { v: 'A', l: esc(p.A.name) }, { v: 'B', l: esc(p.B.name) }, { v: 'both', l: 'Les deux' }], [e.who || 'custodian'])}
    <label class="lbl">Lieu</label><input class="in" name="place" value="${esc(e.place || '')}" placeholder="Adresse, salle…">
    <label class="lbl">Notes</label><textarea class="in" name="notes" rows="3">${esc(e.notes || '')}</textarea>
    <div class="sh-actions">${ev ? `<button class="btn danger" data-act="ev-del" data-id="${ev.id}">${IC.trash}</button>` : ''}<button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="ev-save" data-id="${ev?.id || ''}">Enregistrer</button></div>`);
  return sh;
}
export const actions = {
  'open-day': el => openDay(el.dataset.d),
  'ag-mode': el => { S.ui.agMode = el.dataset.m; go('agenda', { mode: el.dataset.m, m: S.ui.agM }); },
  'ag-shift': el => go('agenda', { mode: 'mois', m: shiftMonth(S.ui.agM || ym(E.todayISO()), +el.dataset.k) }),
  'ag-year': el => go('agenda', { mode: 'annee', y: String((+(S.route.params.y || (S.ui.agM || E.todayISO()).slice(0, 4))) + (+el.dataset.k)) }),
  'ag-month': el => go('agenda', { mode: 'mois', m: el.dataset.m }),
  'ag-today': () => go('agenda', { mode: 'mois', m: ym(E.todayISO()) }),
  'ag-tab': el => { S.ui.agTab = el.dataset.t; S.render(); },
  'ev-new': el => eventSheet(null, el.dataset.d || E.todayISO()),
  'ev-open': el => { const ev = S.events.find(x => x.id === el.dataset.id); if (ev) eventSheet(ev); },
  'ev-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh);
    if (!f.title) return toast('Donnez un titre à l\'événement.', 'warn');
    if (!f.date) return toast('Choisissez une date.', 'warn');
    const data = { title: f.title, cat: f.cat || 'autre', icon: catIcon(f.cat), childIds: f.childIds, date: f.date, endDate: f.endDate || '', time: f.time || '', endTime: f.endTime || '', repeat: f.repeat, until: f.until || '', who: f.who || 'custodian', place: f.place, notes: f.notes };
    el.disabled = true;
    const id = el.dataset.id;
    const ok = await guard(async () => {
      if (id) { await updItem('events', id, data); await log('agenda', `Événement modifié : ${f.title}`, { body: E.fmtDate(f.date, 'wdm') }); }
      else { await addItem('events', data); await log('agenda', `Nouvel événement : ${f.title}`, { body: `${E.fmtDate(f.date, 'wdm')}${f.time ? ' à ' + E.fmtTime(f.time) : ''}` }); }
      return true;
    }, 'Événement enregistré');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'ev-del': async el => {
    const ev = S.events.find(x => x.id === el.dataset.id); if (!ev) return;
    if (!(await confirmBox('Supprimer cet événement ?', esc(ev.title), 'Supprimer', true))) return;
    await guard(async () => { await S.be.db.del(fpath('events', ev.id)); await log('agenda', `Événement supprimé : ${ev.title}`); }, 'Événement supprimé');
    closeSheet();
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
    const ics = E.buildICS({ engine: engine(), childIds: f.kids, children: S.children, parents: parents(), from: f.from, to: f.to, events: f.ev ? S.events : [], withHandovers: f.ho, withBlocks: f.bl });
    download(`SJ-Family-${f.kids.map(childName).join('-')}.ics`, ics, 'text/calendar');
    toast('Fichier .ics créé'); closeSheet();
  },
};
