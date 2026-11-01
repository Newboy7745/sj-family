// ═══════════════ Échanges de garde & horaires de relais (avec validation de l'autre parent) ═══════════════
import * as E from './engine.js?v=6.8';
import { S, engine, parents, pName, pShort, uid, myName, myCode, isParent, childNames, settings, addItem, updItem, log, guard, needsValidation, selIds } from './core.js?v=6.8';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, IC, promptBox, fmtStamp } from './ui.js?v=6.8';

const ST = { pending: ['warn', 'En attente'], accepted: ['ok', 'Acceptée'], refused: ['err', 'Refusée'], cancelled: ['', 'Annulée'] };
export function pendingForMe() { return isParent() ? S.exchanges.filter(x => x.state === 'pending' && x.proposedBy !== uid()).length : 0; }

function card(x) {
  const me = uid(), [cls, lbl] = ST[x.state] || ['', x.state];
  const canDecide = isParent() && x.state === 'pending' && x.proposedBy !== me;
  const changes = (x.changes || []);
  return `<div class="card"><div class="row gap"><div class="le" style="font-size:28px">${x.type === 'time' ? '⏰' : '🔄'}</div><div class="f1"><div class="b">${esc(x.summary || 'Échange')}</div>
    <div class="small muted">${esc(childNames(x.childIds))} · demandé par ${esc(x.proposedByName)} le ${fmtStamp(x.proposedAt)}</div></div><span class="pill ${cls}">${lbl}</span></div>
    ${x.reason ? `<div class="note mt" style="margin-bottom:0"><div class="nx">${esc(x.reason)}</div></div>` : ''}
    ${changes.length ? `<details class="mt"><summary class="small b">Détail des ${changes.length} jour${changes.length > 1 ? 's' : ''}</summary><div class="row wrap gap6 mt">${changes.map(c => `<span class="pill" style="background:${c.to === 'A' ? 'var(--pa)' : 'var(--pb)'};color:#13233A">${E.fmtDate(c.d, 'wdm')} → ${esc(pShort(c.to))}</span>`).join('')}</div></details>` : ''}
    ${x.state !== 'pending' && x.decidedAt ? `<div class="small mt ${x.state === 'accepted' ? '' : 'muted'}">${x.state === 'accepted' ? '✅ Acceptée' : x.state === 'refused' ? '❌ Refusée' : '↩️ Annulée'} le ${fmtStamp(x.decidedAt)} par ${esc(x.decidedByName || '—')}${x.decisionNote ? ` — « ${esc(x.decisionNote)} »` : ''}</div>` : ''}
    <div class="row gap wrap mt">
      ${canDecide ? `<button class="btn ok sm" data-act="x-accept" data-id="${x.id}">✓ Accepter</button><button class="btn danger sm" data-act="x-refuse" data-id="${x.id}">✗ Refuser</button>` : ''}
      ${x.state === 'pending' && x.proposedBy === me ? `<button class="btn soft sm" data-act="x-cancel" data-id="${x.id}">Annuler ma demande</button>` : ''}
      ${x.state === 'accepted' && isParent() ? `<button class="btn soft sm" data-act="x-revert" data-id="${x.id}">↩️ Demander l'annulation</button>` : ''}
    </div></div>`;
}
export const views = {
  exchanges(p) {
    const me = uid(), tab = p.tab || (pendingForMe() ? 'todo' : 'mine');
    const all = [...S.exchanges].sort((a, b) => (b.proposedAt || 0) - (a.proposedAt || 0));
    const lists = {
      todo: all.filter(x => x.state === 'pending' && x.proposedBy !== me),
      mine: all.filter(x => x.state === 'pending' && x.proposedBy === me),
      hist: all.filter(x => x.state !== 'pending'),
    };
    const L = lists[tab] || [];
    return {
      title: 'Échanges',
      html: `${isParent() ? `<button class="btn coral block mb" data-act="x-new">${IC.plus} Nouvelle demande d'échange</button>` : ''}
      <div class="seg"><button class="${tab === 'todo' ? 'on' : ''}" data-go="exchanges" data-params='{"tab":"todo"}'>À traiter (${lists.todo.length})</button><button class="${tab === 'mine' ? 'on' : ''}" data-go="exchanges" data-params='{"tab":"mine"}'>Mes demandes (${lists.mine.length})</button><button class="${tab === 'hist' ? 'on' : ''}" data-go="exchanges" data-params='{"tab":"hist"}'>Historique</button></div>
      ${L.length ? L.map(card).join('') : `<div class="card empty"><div class="e-i">🔄</div>${tab === 'todo' ? 'Aucune demande à traiter.' : tab === 'mine' ? 'Aucune demande en attente.' : 'Aucun échange pour le moment.'}</div>`}
      <div class="hint center">Un échange accepté modifie le planning des jours concernés (bordure pointillée sur le calendrier).</div>`,
    };
  },
};
function previewDays(f) {
  const eng = engine(), out = [];
  const add = (from, to, who) => { if (!from || !to || to < from || !who) return; for (const d of E.eachDay(from, to)) out.push({ d, to: who }); };
  add(f.from, f.to || f.from, f.who);
  if (f.cfrom) add(f.cfrom, f.cto || f.cfrom, E.other(f.who));
  return out.map(c => ({ ...c, before: (f.kids || []).map(k => eng.code(k, c.d)) }));
}
function sheetHtml(o) {
  const p = parents(), me = myCode(), type = o.type || 'days';
  const eng = engine(), d = o.d || E.addDays(E.todayISO(), 1);
  const cur = eng.code(selIds()[0], d), who = o.who || (E.first(cur) ? E.other(E.first(cur)) : E.other(me || 'A'));
  const hos = eng.handovers(S.children.map(c => c.id), d, d);
  return `<h3 class="sh-title">🔄 Demande d'échange</h3>
    ${chips('type', [{ v: 'days', l: '📅 Échanger des jours' }, { v: 'time', l: '⏰ Horaire de relais' }], [type])}
    <label class="lbl">Enfants</label>${chips('kids', S.children.map(c => ({ v: c.id, l: `${c.emoji || ''} ${esc(c.prenom)}` })), o.kids || selIds(), { multi: true })}
    <div class="${type === 'days' ? '' : 'hide'}" data-part="days">
      <div class="two"><div><label class="lbl">Du</label><input class="in" type="date" name="from" value="${d}"></div><div><label class="lbl">Au (inclus)</label><input class="in" type="date" name="to" value="${o.to || d}"></div></div>
      <label class="lbl">Les enfants seront chez</label>${chips('who', [{ v: 'A', l: esc(p.A.name) }, { v: 'B', l: esc(p.B.name) }], [who])}
      <div class="hint">Récupération la veille du 1er jour, retour le dernier jour, aux horaires habituels (${E.fmtTime(settings().handoverTime)} ou horaire régulier), sauf horaire convenu.</div>
      <label class="lbl">En compensation (facultatif) — jours rendus à l'autre parent</label>
      <div class="two"><div><input class="in" type="date" name="cfrom" value=""></div><div><input class="in" type="date" name="cto" value=""></div></div>
      <div class="mt" data-part="preview"></div>
    </div>
    <div class="${type === 'time' ? '' : 'hide'}" data-part="time">
      <label class="lbl">Date du relais</label><input class="in" type="date" name="tdate" value="${d}">
      <div class="mt" data-part="hos">${hosHtml(hos, o.kind)}</div>
      <div class="two"><div><label class="lbl">Nouvel horaire</label><input class="in" type="time" name="time" value="${o.time || ''}"></div><div><label class="lbl">Lieu (option)</label><input class="in" name="place" placeholder="École, domicile…"></div></div>
    </div>
    <label class="lbl">Message / motif</label><textarea class="in" name="reason" rows="3" placeholder="Ex. Déplacement professionnel, mariage…"></textarea>
    ${needsValidation() ? `<div class="hint">${esc(pName(E.other(me)))} devra accepter la demande pour qu'elle s'applique.</div>` : `<div class="hint">L'autre parent n'a pas encore rejoint le cercle : l'échange s'appliquera directement.</div>`}
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn coral f1" data-act="x-save">Enregistrer</button></div>`;
}
function hosHtml(hos, kind) {
  if (!hos.length) return '<div class="hint">Aucun relais prévu ce jour selon le planning.</div>';
  return `<label class="lbl">Relais concerné</label>${chips('kind', hos.map(h => ({ v: h.kind, l: `${E.fmtTime(h.time)} · ${esc(pShort(h.from))} → ${esc(pShort(h.to))}` })), [kind || hos[0].kind])}`;
}
function refresh(sh) {
  const f = readForm(sh);
  sh.querySelector('[data-part="days"]').classList.toggle('hide', f.type !== 'days');
  sh.querySelector('[data-part="time"]').classList.toggle('hide', f.type !== 'time');
  if (f.type === 'days') {
    const pv = previewDays(f), p = parents();
    sh.querySelector('[data-part="preview"]').innerHTML = pv.length ? `<div class="lbl">Aperçu (${pv.length} jour${pv.length > 1 ? 's' : ''})</div><div class="row wrap gap6">${pv.slice(0, 40).map(c => `<span class="pill" style="background:${c.to === 'A' ? 'var(--pa)' : 'var(--pb)'};color:#13233A">${E.fmtDate(c.d, 'wdm')} → ${esc(p[c.to].short)}</span>`).join('')}</div>` : '';
  } else {
    const hos = engine().handovers(S.children.map(c => c.id), f.tdate, f.tdate);
    const box = sh.querySelector('[data-part="hos"]'); const prev = box.dataset.d;
    if (prev !== f.tdate) { box.innerHTML = hosHtml(hos, f.kind); box.dataset.d = f.tdate; }
  }
}
export function openExchange(o = {}) {
  if (!isParent()) return toast('Seuls les parents peuvent proposer un échange.', 'warn');
  const sh = openSheet(sheetHtml(o));
  sh.addEventListener('chipchange', () => refresh(sh));
  sh.addEventListener('input', () => refresh(sh));
  sh.addEventListener('change', () => refresh(sh));
  refresh(sh);
}
async function decide(x, state, note = '') {
  await updItem('exchanges', x.id, { state, decidedBy: uid(), decidedByName: myName(), decidedAt: Date.now(), decisionNote: note });
  await log('echange', `Échange ${state === 'accepted' ? 'accepté' : state === 'refused' ? 'refusé' : 'annulé'} : ${x.summary}`, { body: note });
}
export const actions = {
  'x-new': el => openExchange({ d: el.dataset.d }),
  'x-time': el => openExchange({ type: 'time', d: el.dataset.d, kind: el.dataset.kind, time: '' }),
  'x-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), p = parents();
    if (!f.kids.length) return toast('Choisissez au moins un enfant.', 'warn');
    let data;
    if (f.type === 'days') {
      if (!f.from || !f.who) return toast('Indiquez les dates et le parent.', 'warn');
      if (f.to && f.to < f.from) return toast('La date de fin précède la date de début.', 'warn');
      const ch = previewDays(f).map(c => ({ d: c.d, to: c.to }));
      if (ch.length > 120) return toast('Maximum 120 jours par demande.', 'warn');
      const to = f.to || f.from;
      let summary = `Garde ${f.from === to ? 'du ' + E.fmtDate(f.from, 'wdm') : `du ${E.fmtDate(f.from, 'wdm')} au ${E.fmtDate(to, 'wdm')}`} chez ${p[f.who].name}`;
      if (f.cfrom) summary += ` · en échange ${f.cfrom === (f.cto || f.cfrom) ? 'du ' + E.fmtDate(f.cfrom, 'wdm') : `du ${E.fmtDate(f.cfrom, 'wdm')} au ${E.fmtDate(f.cto, 'wdm')}`}`;
      data = { type: 'days', childIds: f.kids, changes: ch, summary };
    } else {
      if (!f.tdate || !f.time) return toast('Indiquez la date et le nouvel horaire.', 'warn');
      const kind = f.kind || 'soir';
      data = { type: 'time', childIds: f.kids, changes: [], timeChange: { d: f.tdate, time: f.time, place: f.place || '', midday: kind === 'midi' }, summary: `Relais du ${E.fmtDate(f.tdate, 'wdm')} à ${E.fmtTime(f.time)}${f.place ? ' (' + f.place + ')' : ''}` };
    }
    const nv = needsValidation();
    Object.assign(data, { reason: f.reason, proposedBy: uid(), proposedByName: myName(), proposedAt: Date.now(), state: nv ? 'pending' : 'accepted' });
    if (!nv) Object.assign(data, { decidedBy: uid(), decidedByName: myName() + ' (auto)', decidedAt: Date.now() });
    el.disabled = true;
    const ok = await guard(async () => { await addItem('exchanges', data); await log('echange', nv ? `Demande d'échange : ${data.summary}` : `Échange appliqué : ${data.summary}`, { body: f.reason }); return true; }, nv ? 'Demande envoyée' : 'Échange appliqué');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'x-accept': async el => {
    const x = S.exchanges.find(y => y.id === el.dataset.id); if (!x) return;
    if (!(await confirmBox('Accepter cet échange ?', esc(x.summary), 'Accepter'))) return;
    await guard(() => decide(x, 'accepted'), 'Échange accepté');
  },
  'x-refuse': async el => {
    const x = S.exchanges.find(y => y.id === el.dataset.id); if (!x) return;
    const note = await promptBox('Refuser la demande', { label: 'Message (facultatif)', textarea: true, ok: 'Refuser' }); if (note === null) return;
    await guard(() => decide(x, 'refused', note), 'Demande refusée');
  },
  'x-cancel': async el => {
    const x = S.exchanges.find(y => y.id === el.dataset.id); if (!x) return;
    if (!(await confirmBox('Annuler votre demande ?', esc(x.summary), 'Annuler la demande', true))) return;
    await guard(() => decide(x, 'cancelled'), 'Demande annulée');
  },
  'x-revert': async el => {
    const x = S.exchanges.find(y => y.id === el.dataset.id); if (!x) return;
    // une annulation d'échange accepté = nouvelle demande qui rétablit le planning d'origine
    const eng = engine(), ch = [];
    for (const c of x.changes || []) { const b = eng.baseCode(x.childIds[0], c.d); if (E.first(b)) ch.push({ d: c.d, to: b }); }
    if (!ch.length && !x.timeChange) return toast('Rien à rétablir.', 'warn');
    const nv = needsValidation();
    const data = { type: x.type, childIds: x.childIds, changes: ch, timeChange: x.timeChange ? { d: x.timeChange.d, midday: !!x.timeChange.midday, reset: true, time: '', place: '' } : null,
      summary: `Annulation : ${x.summary}`, reason: 'Retour au planning initial', proposedBy: uid(), proposedByName: myName(), proposedAt: Date.now(), state: nv ? 'pending' : 'accepted' };
    if (!nv) Object.assign(data, { decidedBy: uid(), decidedByName: myName() + ' (auto)', decidedAt: Date.now() });
    await guard(async () => { await addItem('exchanges', data); await log('echange', data.summary); }, nv ? 'Demande envoyée' : 'Planning rétabli');
  },
};
