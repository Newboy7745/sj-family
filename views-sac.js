// ═══════════════ Sac : affaires de chaque relais + listes des vacances (demandées ou envoyées, aller / retour) ═══════════════
import * as E from './engine.js?v=6.7';
import { S, engine, parents, pName, pShort, uid, myName, myCode, isParent, childNames, selIds, fpath, log, guard, can, kidAvatar, countdown, settings, go } from './core.js?v=6.7';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, IC, compressImage, fmtAgo, closeSheetsThen } from './ui.js?v=6.7';
import { kidChips } from './views-home.js?v=6.7';

const runKey = h => `${h.date}_${h.time.replace(':', '')}_${h.to}`;
const relaisItems = () => S.sac.filter(i => !i.kind);
const vlists = () => S.sac.filter(i => i.kind === 'vlist');
const other = c => (c === 'A' ? 'B' : 'A');
const nid = () => S.be.db.newId().slice(0, 12);
/** Relais proposés : le dernier (pour confirmer la réception) et les 3 prochains */
function relaisList(ids) {
  const eng = engine(), today = E.todayISO(), min = E.nowMin();
  const past = eng.handovers(ids, E.addDays(today, -3), today).filter(h => h.date < today || E.t2m(h.time) <= min);
  const next = eng.nextHandovers(ids, today, min, 3);
  return { last: past[past.length - 1] || null, next };
}
const runOf = h => S.sacRuns.find(r => r.id === runKey(h)) || { packed: {}, got: {}, missing: {}, excluded: {} };
function itemsFor(h) {
  const key = runKey(h), run = runOf(h);
  return relaisItems().filter(i => (i.perm ? !run.excluded?.[i.id] : i.runKey === key) && (!i.childIds?.length || i.childIds.some(id => h.childIds.includes(id))))
    .sort((a, b) => (a.perm === b.perm ? 0 : a.perm ? -1 : 1) || (a.createdAt || 0) - (b.createdAt || 0));
}
/** Badge : objets pas encore dans le sac pour un relais où je donne les enfants dans moins de 36 h */
export function pendingCount() {
  if (!S.sac.length || !S.children.length || !isParent()) return 0;
  const h = relaisList(S.children.map(c => c.id)).next[0]; if (!h || h.from !== myCode()) return 0;
  const [Y, M, D] = h.date.split('-').map(Number), [hh, mm] = h.time.split(':').map(Number);
  if (new Date(Y, M - 1, D, hh, mm) - Date.now() > 36 * 3600000) return 0;
  const run = runOf(h); return itemsFor(h).filter(i => !run.packed?.[i.id]).length;
}
// ───── sélection multiple (suppression d'un, plusieurs ou tous les éléments)
const sel = () => (S.ui.sacSel ||= new Set());
const selBar = (ids, delAct, label) => S.ui.sacSelOn ? `<div class="selbar"><button class="btn soft sm" data-act="sac-sel-all" data-ids="${ids.join(',')}">${ids.length && ids.every(id => sel().has(id)) ? 'Aucun' : 'Tout'}</button>
  <span class="f1 small b">${sel().size} choisi${sel().size > 1 ? 's' : ''}</span><button class="btn danger sm" data-act="${delAct}" ${sel().size ? '' : 'disabled'}>${IC.trash} ${label}</button><button class="btn ghost sm" data-act="sac-sel">OK</button></div>`
  : `<button class="btn soft sm" data-act="sac-sel">☑️ Sélectionner</button>`;
const selBox = id => S.ui.sacSelOn ? `<button class="ck ${sel().has(id) ? 'on' : ''}" data-act="sac-sel-one" data-id="${id}">${sel().has(id) ? '✓' : ''}</button>` : '';

function itemRow(i, run, h) {
  const p = run.packed?.[i.id], g = run.got?.[i.id], miss = run.missing?.[i.id];
  return `<div class="sac-it ${g ? 'got' : ''} ${miss ? 'miss' : ''}">${selBox(i.id)}
    <button class="sac-ph" data-act="sac-item" data-id="${i.id}">${i.photo ? `<img src="${i.photo}" alt="">` : '<span>🎒</span>'}</button>
    <button class="f1" style="text-align:left;min-width:0" data-act="sac-item" data-id="${i.id}"><div class="b">${esc(i.name)}${i.qty > 1 ? ` <span class="muted">×${i.qty}</span>` : ''}</div>
      ${i.desc ? `<div class="small muted">${esc(i.desc)}</div>` : ''}
      <div class="tiny muted">${i.childIds?.length ? esc(childNames(i.childIds)) + ' · ' : ''}${i.perm ? 'à chaque relais' : 'ce relais uniquement'}${miss ? ' · <b style="color:var(--err)">⚠️ manquant</b>' : ''}</div></button>
    ${S.ui.sacSelOn ? '' : `<div class="sac-ck"><button class="ck2 ${p ? 'on' : ''}" data-act="sac-pack" data-id="${i.id}" data-k="${runKey(h)}" title="Dans le sac">🎒<span>${p ? '✓' : ''}</span></button>
      <button class="ck2 ${g ? 'on' : ''}" data-act="sac-got" data-id="${i.id}" data-k="${runKey(h)}" title="Reçu">📥<span>${g ? '✓' : ''}</span></button></div>`}</div>`;
}

// ───── Listes des vacances
function periods() {
  const st = settings(), today = E.todayISO();
  return E.schoolHolidays(st.zone || 'B', st.customHolidays || []).filter(p => p.e >= E.addDays(today, -21) && p.s <= E.addDays(today, 400)).slice(0, 8);
}
const pLabel = p => `${p.i || '🏖️'} ${p.n.replace('Vacances de la ', '').replace('Vacances d\'', '').replace('Vacances de ', '')} ${p.s.slice(0, 4)}`;
function phaseInfo(l, ph) { const g = ph === 'retour' ? other(l.giver) : l.giver; return { giver: g, receiver: other(g) }; }
function listStats(l, ph) {
  const ids = Object.keys(l.items || {}), st = l.st?.[ph] || {};
  return { n: ids.length, done: ids.filter(id => st[id]?.done).length, got: ids.filter(id => st[id]?.got).length };
}
function vlistCard(l) {
  const a = listStats(l, 'aller'), r = listStats(l, 'retour'), p = parents();
  return `<button class="card vl" style="width:100%;text-align:left" data-go="sacl" data-params='${JSON.stringify({ id: l.id })}'>
    <div class="row gap"><div style="font-size:28px">${l.dir === 'request' ? '📥' : '📤'}</div><div class="f1"><div class="b">${esc(l.title)}</div>
    <div class="small muted">${l.dir === 'request' ? `${esc(p[l.ownerCode]?.name || '')} demande à ${esc(p[l.giver].name)} de fournir` : `${esc(p[l.giver].name)} fournit`} · ${a.n} élément${a.n > 1 ? 's' : ''}${l.childIds?.length ? ' · ' + esc(childNames(l.childIds)) : ''}</div>
    <div class="tiny muted mt6">➡️ Aller : ${a.done}/${a.n} mis · ${a.got}/${a.n} reçus &nbsp; ⬅️ Retour : ${r.done}/${r.n} mis · ${r.got}/${r.n} reçus</div></div><span class="lnk">›</span></div></button>`;
}
function vacTab(ids) {
  const ps = periods(); if (!ps.length) return '<div class="card empty">Aucune période de vacances à venir.</div>';
  const pid = S.ui.sacPer && ps.some(p => p.id === S.ui.sacPer) ? S.ui.sacPer : ps.find(p => p.e >= E.todayISO())?.id || ps[0].id;
  const per = ps.find(p => p.id === pid), eng = engine();
  const blocks = ids.length ? eng.blocks(ids[0], per.s, per.e).filter(b => b.key !== '.') : [];
  const ls = vlists().filter(l => l.period?.id === pid).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return `<div class="chips scroll mb">${ps.map(p => `<button class="chip sm ${p.id === pid ? 'on' : ''}" data-act="sac-per" data-id="${p.id}">${esc(pLabel(p))}</button>`).join('')}</div>
    <div class="card"><div class="b">${per.i || '🏖️'} ${esc(per.n)}</div><div class="small muted">Du ${E.fmtDate(per.s)} au ${E.fmtDate(per.e)}</div>
      ${blocks.length ? `<div class="row wrap gap6 mt6">${blocks.map(b => `<span class="pill" style="background:${E.first(b.code) === 'A' ? 'var(--pa)' : 'var(--pb)'};color:#13233A">${esc(E.isHalf(b.code) ? '½ / ½' : pShort(E.first(b.code)))} · ${E.fmtDate(b.start, 'short')}${b.end !== b.start ? '→' + E.fmtDate(b.end, 'short') : ''}</span>`).join('')}</div>` : ''}</div>
    ${ls.length ? ls.map(vlistCard).join('') : '<div class="card empty"><div class="e-i">🧳</div>Aucune liste pour ces vacances.<br>Exemple : la liste des vêtements que vous attendez de l\'autre parent.</div>'}
    ${isParent() ? `<button class="btn primary block" data-act="vl-new" data-p="${pid}">${IC.plus} Nouvelle liste pour ces vacances</button>` : ''}`;
}
function vlistItem(l, iid, it, ph, me) {
  const st = l.st?.[ph]?.[iid] || {}, { giver, receiver } = phaseInfo(l, ph), photos = it.photos || [];
  const exp = +it.qty || 1, given = st.qty ?? '', got = st.gotQty ?? '';
  const gap = st.got && st.gotQty != null && +st.gotQty !== +(st.qty ?? exp);
  const canG = me === giver || !me, canR = me === receiver || !me;
  return `<div class="vi ${st.done ? 'done' : ''} ${st.got ? 'got' : ''}">
    <div class="row gap">${selBox(iid)}<div class="f1" style="min-width:0"><div class="b">${esc(it.name)} <span class="muted">· ${exp} attendu${exp > 1 ? 's' : ''}</span></div>${it.desc ? `<div class="small muted">${esc(it.desc)}</div>` : ''}</div>
      ${S.ui.sacSelOn ? '' : `<button class="ib" data-act="vl-item" data-id="${l.id}" data-i="${iid}">${IC.edit}</button>`}</div>
    <div class="vph">${photos.map(p => { const on = !!st.ph?.[p.id]; return `<div class="vp ${on ? 'on' : ''}"><button class="vp-i" data-act="vl-ph" data-id="${l.id}" data-i="${iid}" data-p="${p.id}" data-ph="${ph}" title="Cocher cette photo"><img src="${p.thumb}" alt=""><span>${on ? '✓' : ''}</span></button>
      <button class="vp-z" data-act="vl-zoom" data-b="${p.blobId || ''}" data-t="${p.thumb}">🔍</button></div>`; }).join('')}
      <label class="vp add">📷<input type="file" accept="image/*" multiple class="hide" data-vlph="1" data-id="${l.id}" data-i="${iid}"></label></div>
    <div class="vrow"><span class="vlab">${esc(pShort(giver))} met</span>
      <input class="in sm" type="number" min="0" inputmode="numeric" value="${esc(String(given))}" placeholder="${exp}" ${canG ? '' : 'disabled'} data-change="vl-qty" data-id="${l.id}" data-i="${iid}" data-ph="${ph}">
      <button class="ck2 ${st.done ? 'on' : ''}" ${canG ? '' : 'disabled'} data-act="vl-done" data-id="${l.id}" data-i="${iid}" data-ph="${ph}" title="Mis dans le sac">🎒<span>${st.done ? '✓' : ''}</span></button></div>
    <input class="in sm" ${canG ? '' : 'disabled'} placeholder="Ce que je mets exactement (taille, couleur, marque…)" value="${esc(st.note || '')}" data-change="vl-note" data-id="${l.id}" data-i="${iid}" data-ph="${ph}">
    <div class="vrow"><span class="vlab">${esc(pShort(receiver))} reçoit</span>
      <input class="in sm" type="number" min="0" inputmode="numeric" value="${esc(String(got))}" placeholder="${given || exp}" ${canR ? '' : 'disabled'} data-change="vl-gotqty" data-id="${l.id}" data-i="${iid}" data-ph="${ph}">
      <button class="ck2 ${st.got ? 'on' : ''}" ${canR ? '' : 'disabled'} data-act="vl-got" data-id="${l.id}" data-i="${iid}" data-ph="${ph}" title="Reçu">📥<span>${st.got ? '✓' : ''}</span></button></div>
    ${gap ? `<div class="small b" style="color:var(--err)">⚠️ Écart : ${st.qty ?? exp} mis, ${st.gotQty} reçu${+st.gotQty > 1 ? 's' : ''}</div>` : ''}
    ${st.done ? `<div class="tiny muted">🎒 ${esc(st.byName || '')} ${st.at ? fmtAgo(st.at) : ''}${st.got ? ` · 📥 ${esc(st.gotByName || '')} ${st.gotAt ? fmtAgo(st.gotAt) : ''}` : ''}</div>` : ''}</div>`;
}

export const views = {
  sac(p) {
    const ids = selIds();
    if (!can('sac')) return { title: 'Sac du relais', back: 'home', html: '<div class="card empty">Rubrique réservée aux parents.</div>' };
    const tab = p.tab || S.ui.sacTab || 'relais'; S.ui.sacTab = tab;
    if (S.ui.sacSelTab !== tab) { S.ui.sacSelOn = false; sel().clear(); S.ui.sacSelTab = tab; }
    const { last, next } = relaisList(ids);
    const opts = [...(last ? [last] : []), ...next];
    const recent = last && Date.now() - new Date(...last.date.split('-').map((x, k) => (k === 1 ? x - 1 : +x))).getTime() < 2 * 86400000;
    const pick = opts.find(h => runKey(h) === S.ui.sacKey) || (recent && itemsFor(last).some(i => !runOf(last).got?.[i.id]) ? last : next[0] || last);
    let body = '';
    if (tab === 'vac') body = vacTab(ids);
    else if (tab === 'liste') {
      const perm = relaisItems().filter(i => i.perm && (!i.childIds?.length || i.childIds.some(id => ids.includes(id))));
      body = `<div class="card"><h3>📋 Liste type <a class="act" data-act="sac-new" data-perm="1">${IC.plus} Ajouter</a></h3>
        <p class="small muted" style="margin-top:0">Ces affaires sont proposées à chaque relais.</p>
        ${perm.length ? `<div class="row gap mb">${selBar(perm.map(i => i.id), 'sac-del-sel', 'Supprimer')}</div>` : ''}
        ${perm.length ? perm.map(i => `<div class="li">${selBox(i.id)}<button class="row gap f1" style="text-align:left" data-act="sac-item" data-id="${i.id}"><span class="sac-ph sm">${i.photo ? `<img src="${i.photo}" alt="">` : '<span>🎒</span>'}</span><div class="f1"><div class="lt">${esc(i.name)}</div><div class="ls">${esc(i.desc || '')}${i.childIds?.length ? ' · ' + esc(childNames(i.childIds)) : ''}</div></div><span class="lnk">›</span></button></div>`).join('') : '<div class="empty"><div class="e-i">🎒</div>Ajoutez cartable, doudou, médicaments, tenue de sport…</div>'}</div>`;
    } else if (!pick) body = '<div class="card empty"><div class="e-i">🔁</div>Aucun relais prévu pour le moment.</div>';
    else {
      const run = runOf(pick), items = itemsFor(pick), me = myCode();
      const nP = items.filter(i => run.packed?.[i.id]).length, nG = items.filter(i => run.got?.[i.id]).length;
      const past = pick === last;
      body = `${opts.length > 1 ? `<div class="chips scroll mb">${opts.map(h => `<button class="chip sm ${h === pick ? 'on' : ''}" data-act="sac-pick" data-k="${runKey(h)}">${h === last ? '⏮ ' : ''}${esc(E.relDay(h.date))} ${E.fmtTime(h.time)}</button>`).join('')}</div>` : ''}
        <div class="card"><div class="row gap"><div style="font-size:30px">🔁</div><div class="f1"><div class="b">Relais ${esc(E.relDay(pick.date))} à ${E.fmtTime(pick.time)}</div>
          <div class="small muted">${esc(pName(pick.from))} → ${esc(pName(pick.to))} · ${esc(childNames(pick.childIds))}${pick.place ? ' · 📍 ' + esc(pick.place) : ''}</div>
          ${past ? '<div class="small b" style="color:var(--coral)">Relais passé : confirmez la réception</div>' : `<div class="count mt6">⏱ ${countdown(pick.date, pick.time)}</div>`}</div></div>
          <div class="row gap mt"><div class="f1"><div class="tiny b">🎒 DANS LE SAC</div><div class="bar"><span style="width:${items.length ? nP / items.length * 100 : 0}%;background:var(--navy2)"></span></div><div class="tiny muted">${nP}/${items.length} · ${esc(pShort(pick.from))}</div></div>
            <div class="f1"><div class="tiny b">📥 REÇU</div><div class="bar"><span style="width:${items.length ? nG / items.length * 100 : 0}%;background:var(--ok)"></span></div><div class="tiny muted">${nG}/${items.length} · ${esc(pShort(pick.to))}</div></div></div>
          ${run.readyAt ? `<div class="tiny muted mt">✅ Sac prêt (${esc(run.readyByName || '')}, ${fmtAgo(run.readyAt)})</div>` : ''}${run.doneAt ? `<div class="tiny muted">📥 Tout reçu (${esc(run.doneByName || '')}, ${fmtAgo(run.doneAt)})</div>` : ''}</div>
        ${items.length ? `<div class="row gap mb">${selBar(items.map(i => i.id), 'sac-out-sel', 'Retirer')}</div><div class="card tight">${items.map(i => itemRow(i, run, pick)).join('')}</div>` : '<div class="card empty"><div class="e-i">🎒</div>Rien dans le sac pour ce relais. Ajoutez des affaires ou une liste type.</div>'}
        ${Object.keys(run.excluded || {}).some(k => run.excluded[k]) ? `<button class="btn ghost sm block mb" data-act="sac-restore" data-k="${runKey(pick)}">↩️ Remettre les affaires retirées de ce relais</button>` : ''}
        <button class="btn soft block mb" data-act="sac-new" data-k="${runKey(pick)}">${IC.camera} Ajouter une affaire (photo + description)</button>
        <div class="row gap wrap">${me === pick.from || !me ? `<button class="btn primary f1" data-act="sac-ready" data-k="${runKey(pick)}">✅ Sac prêt</button>` : ''}
          ${me === pick.to || !me ? `<button class="btn ok f1" data-act="sac-done" data-k="${runKey(pick)}">📥 Tout est arrivé</button><button class="btn danger f1" data-act="sac-miss" data-k="${runKey(pick)}">⚠️ Signaler un oubli</button>` : ''}</div>`;
      S.ui.sacPick = pick;
    }
    return {
      title: 'Sac', back: isParent() ? null : 'home',
      html: `${kidChips()}<div class="seg mt"><button class="${tab === 'relais' ? 'on' : ''}" data-act="sac-tab" data-t="relais">🔁 Relais</button><button class="${tab === 'vac' ? 'on' : ''}" data-act="sac-tab" data-t="vac">🏖️ Vacances</button><button class="${tab === 'liste' ? 'on' : ''}" data-act="sac-tab" data-t="liste">📋 Liste type</button></div>${body}`,
    };
  },
  /** Une liste des vacances : aller (début) / retour (fin), quantités, notes et photos à cocher une à une */
  sacl(p) {
    const l = S.sac.find(x => x.id === p.id);
    if (!l) return { title: 'Liste', back: 'sac', html: '<div class="card empty">Liste introuvable (supprimée ?).</div>' };
    const ph = p.ph === 'retour' ? 'retour' : 'aller', me = myCode(), pr = parents();
    if (S.ui.sacSelTab !== 'l' + l.id + ph) { S.ui.sacSelOn = false; sel().clear(); S.ui.sacSelTab = 'l' + l.id + ph; }
    const { giver, receiver } = phaseInfo(l, ph), stt = listStats(l, ph), phs = l.phase?.[ph] || {};
    const items = Object.entries(l.items || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
    return {
      title: l.title, back: 'sac',
      html: `<div class="card"><div class="row gap"><div style="font-size:30px">${l.dir === 'request' ? '📥' : '📤'}</div><div class="f1"><div class="b">${esc(l.title)} · ${esc(l.period?.n || '')}</div>
        <div class="small muted">${l.dir === 'request' ? `Liste demandée par ${esc(pr[l.ownerCode]?.name || '')} : ${esc(pr[l.giver].name)} fournit` : `${esc(pr[l.giver].name)} envoie cette liste`}${l.childIds?.length ? ' · ' + esc(childNames(l.childIds)) : ''}</div>
        ${l.period ? `<div class="tiny muted">Du ${E.fmtDate(l.period.s)} au ${E.fmtDate(l.period.e)}</div>` : ''}</div></div></div>
      <div class="seg"><button class="${ph === 'aller' ? 'on' : ''}" data-go="sacl" data-params='${JSON.stringify({ id: l.id, ph: 'aller' })}'>➡️ Aller · ${esc(pShort(l.giver))} → ${esc(pShort(other(l.giver)))}</button>
        <button class="${ph === 'retour' ? 'on' : ''}" data-go="sacl" data-params='${JSON.stringify({ id: l.id, ph: 'retour' })}'>⬅️ Retour · ${esc(pShort(other(l.giver)))} → ${esc(pShort(l.giver))}</button></div>
      <div class="card tight"><div class="row gap"><div class="f1"><div class="tiny b">🎒 MIS PAR ${esc(pShort(giver).toUpperCase())}</div><div class="bar"><span style="width:${stt.n ? stt.done / stt.n * 100 : 0}%;background:var(--navy2)"></span></div><div class="tiny muted">${stt.done}/${stt.n}</div></div>
        <div class="f1"><div class="tiny b">📥 REÇU PAR ${esc(pShort(receiver).toUpperCase())}</div><div class="bar"><span style="width:${stt.n ? stt.got / stt.n * 100 : 0}%;background:var(--ok)"></span></div><div class="tiny muted">${stt.got}/${stt.n}</div></div></div>
        ${phs.sentAt ? `<div class="tiny muted mt6">✅ Préparé par ${esc(phs.sentByName || '')} ${fmtAgo(phs.sentAt)}</div>` : ''}${phs.gotAt ? `<div class="tiny muted">📥 Réception confirmée par ${esc(phs.gotByName || '')} ${fmtAgo(phs.gotAt)}</div>` : ''}</div>
      <div class="hint mb">${ph === 'aller' ? `${esc(pName(giver))} coche chaque élément, indique le nombre exact et ce qu'il met ; ${esc(pName(receiver))} confirme à la réception.` : `Au retour, ${esc(pName(giver))} rend les affaires et ${esc(pName(receiver))} confirme.`} Touchez une photo pour la cocher.</div>
      ${items.length ? `<div class="row gap mb">${selBar(items.map(([id]) => id), 'vl-del-sel', 'Supprimer')}</div>${items.map(([iid, it]) => vlistItem(l, iid, it, ph, me)).join('')}` : '<div class="card empty"><div class="e-i">🧳</div>Liste vide : ajoutez les éléments attendus.</div>'}
      <button class="btn soft block mb mt" data-act="vl-item" data-id="${l.id}">${IC.plus} Ajouter un élément (photos, nombre)</button>
      <div class="row gap wrap mb">${me === giver || !me ? `<button class="btn primary f1" data-act="vl-sent" data-id="${l.id}" data-ph="${ph}">✅ J'ai tout préparé</button>` : ''}${me === receiver || !me ? `<button class="btn ok f1" data-act="vl-recv" data-id="${l.id}" data-ph="${ph}">📥 Réception confirmée</button>` : ''}</div>
      <div class="row gap"><button class="btn soft f1" data-act="vl-edit" data-id="${l.id}">${IC.edit} Modifier la liste</button><button class="btn soft f1" style="color:var(--err)" data-act="vl-del" data-id="${l.id}">${IC.trash} Supprimer la liste</button></div>`,
    };
  },
};
export const after = {
  sacl(v) {
    v.querySelectorAll('[data-vlph]').forEach(inp => inp.addEventListener('change', async () => {
      const files = [...inp.files]; if (!files.length) return;
      toast(`Ajout de ${files.length} photo${files.length > 1 ? 's' : ''}…`, 'ok', 1500);
      await guard(async () => {
        const db = S.be.db, add = [];
        for (const f of files.slice(0, 20)) {
          const full = await compressImage(f, 1280, 0.72), thumb = await compressImage(f, 220, 0.6);
          const bid = db.newId(); await db.set(fpath('blobs', bid), { data: full, mime: 'image/jpeg', name: 'photo.jpg', kind: 'sac', at: Date.now(), by: uid() });
          add.push({ id: nid(), thumb, blobId: bid, by: uid() });
        }
        await db.update(fpath('sac', inp.dataset.id), { [`items.${inp.dataset.i}.photos`]: db.arrayUnion(...add), updatedAt: Date.now() });
      }, 'Photos ajoutées');
    }));
  },
};

function itemSheet(i = null, o = {}) {
  const x = i || { childIds: selIds(), perm: !!o.perm, qty: 1 };
  const sh = openSheet(`<h3 class="sh-title">${i ? '✏️ Affaire' : '🎒 Nouvelle affaire'}</h3>
    <div class="row gap"><span class="sac-ph lg" data-part="ph">${x.photo ? `<img src="${x.photo}" alt="">` : '<span>🎒</span>'}</span><div class="f1 row gap wrap">
      <label class="btn soft sm">📷 Photo<input type="file" accept="image/*" capture="environment" class="hide" data-ph="1"></label><label class="btn soft sm">🖼️ Galerie<input type="file" accept="image/*" class="hide" data-ph="1"></label>
      ${x.photo ? '<button type="button" class="btn soft sm" data-act="sac-ph-del">Retirer</button>' : ''}</div></div>
    <label class="lbl">Nom</label><input class="in" name="name" value="${esc(x.name || '')}" placeholder="Ex. Doudou lapin, cartable, Ventoline">
    <label class="lbl">Description</label><textarea class="in" name="desc" rows="3" placeholder="Couleur, taille, posologie, où il est rangé…">${esc(x.desc || '')}</textarea>
    <div class="two"><div><label class="lbl">Quantité</label><input class="in" type="number" min="1" name="qty" value="${x.qty || 1}"></div><div></div></div>
    <label class="lbl">Enfants</label>${chips('childIds', S.children.map(c => ({ v: c.id, l: `${kidAvatar(c, 20)} ${esc(c.prenom)}` })), x.childIds || [], { multi: true })}
    <label class="row gap mt"><span class="sw"><input type="checkbox" name="perm" ${x.perm ? 'checked' : ''}><span></span></span><span class="f1">À chaque relais (liste type)</span></label>
    ${i && o.relais && i.perm ? '<div class="hint">Cette affaire vient de la liste type : la retirer de ce relais ne la supprime ni de la liste type, ni des listes des vacances.</div>' : ''}
    <div class="sh-actions">${i ? (o.relais && i.perm ? `<button class="btn danger" data-act="sac-out-one" data-id="${i.id}" title="Retirer de ce relais">${IC.trash}</button>` : `<button class="btn danger" data-act="sac-del" data-id="${i.id}">${IC.trash}</button>`) : ''}<button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="sac-save" data-id="${i?.id || ''}" data-k="${o.k || i?.runKey || ''}">Enregistrer</button></div>`);
  sh._photo = x.photo || null;
  sh.querySelectorAll('[data-ph]').forEach(inp => inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) return;
    try { sh._photo = await compressImage(f, 520, 0.7); sh.querySelector('[data-part="ph"]').innerHTML = `<img src="${sh._photo}" alt="">`; } catch (e) { toast('Photo illisible', 'err'); }
  }));
}
async function setRun(key, data) {
  const h = [...(S.ui.sacPick ? [S.ui.sacPick] : [])].find(x => runKey(x) === key);
  await S.be.db.set(fpath('sacRuns', key), { ...(h ? { date: h.date, time: h.time, from: h.from, to: h.to, childIds: h.childIds } : {}), ...data, updatedAt: Date.now(), updatedBy: uid() }, true);
}
function listSheet(l = null, pid = null) {
  const p = parents(), me = myCode() || 'A', ps = periods(), cur = l?.period?.id || pid;
  const others = vlists().filter(x => x.id !== l?.id);
  openSheet(`<h3 class="sh-title">${l ? '✏️ Modifier la liste' : '🧳 Nouvelle liste des vacances'}</h3>
    <label class="lbl">Titre</label><input class="in" name="title" value="${esc(l?.title || 'Vêtements')}" placeholder="Vêtements, affaires de toilette, médicaments…">
    <label class="lbl">Vacances</label>${chips('per', ps.map(x => ({ v: x.id, l: esc(pLabel(x)) })), [cur || ps[0]?.id])}
    <label class="lbl">Qui fournit ?</label>${chips('dir', [{ v: 'request', l: `📥 Je demande à ${esc(p[other(me)].name)} de fournir` }, { v: 'send', l: '📤 Je fournis moi-même' }], [l?.dir || 'request'])}
    <div class="hint">Aller : au début des vacances, celui qui fournit coche chaque élément et le nombre exact. Retour : à la fin, l'autre parent rend les affaires et coche à son tour.</div>
    <label class="lbl">Enfants</label>${chips('childIds', S.children.map(c => ({ v: c.id, l: `${kidAvatar(c, 20)} ${esc(c.prenom)}` })), l?.childIds || selIds(), { multi: true })}
    ${!l && others.length ? `<label class="lbl">Partir d'une liste existante (facultatif)</label><select class="in" name="from"><option value="">— Liste vide —</option>${others.map(x => `<option value="${x.id}">${esc(x.title)} · ${esc(x.period ? pLabel(x.period) : '')}</option>`).join('')}</select>` : ''}
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="vl-save" data-id="${l?.id || ''}">${l ? 'Enregistrer' : 'Créer la liste'}</button></div>`);
}
function vItemSheet(l, iid = null) {
  const it = iid ? l.items?.[iid] || {} : {};
  openSheet(`<h3 class="sh-title">${iid ? '✏️ Élément' : '➕ Nouvel élément'}</h3>
    <label class="lbl">Nom</label><input class="in" name="name" value="${esc(it.name || '')}" placeholder="Ex. T-shirts manches courtes">
    <div class="two"><div><label class="lbl">Nombre attendu</label><input class="in" type="number" min="1" name="qty" value="${it.qty || 1}"></div><div></div></div>
    <label class="lbl">Précisions</label><textarea class="in" name="desc" rows="2" placeholder="Taille 8 ans, couleur, marque…">${esc(it.desc || '')}</textarea>
    ${!iid ? `<label class="lbl">Photos (autant que vous voulez)</label><label class="btn soft block">📷 Choisir ou prendre des photos<input type="file" accept="image/*" multiple class="hide" name="ph" data-vi="1"></label><div class="hint" data-part="n"></div>` : '<div class="hint">Ajoutez des photos depuis la liste avec le bouton 📷 de l\'élément.</div>'}
    <div class="sh-actions">${iid ? `<button class="btn danger" data-act="vl-item-del" data-id="${l.id}" data-i="${iid}">${IC.trash}</button>` : ''}<button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="vl-item-save" data-id="${l.id}" data-i="${iid || ''}">Enregistrer</button></div>`,
  { onMount: sh => sh.querySelector('[data-vi]')?.addEventListener('change', e => { sh.querySelector('[data-part="n"]').textContent = `${e.target.files.length} photo(s) sélectionnée(s)`; }) });
}
const L = id => S.sac.find(x => x.id === id);
async function vupd(id, data) { await S.be.db.update(fpath('sac', id), { ...data, updatedAt: Date.now() }); }

export const actions = {
  'sac-tab': el => { S.ui.sacTab = el.dataset.t; S.ui.sacSelOn = false; sel().clear(); S.render(); },
  'sac-pick': el => { S.ui.sacKey = el.dataset.k; S.ui.sacSelOn = false; sel().clear(); S.render(); },
  'sac-per': el => { S.ui.sacPer = el.dataset.id; S.render(); },
  'sac-sel': () => { S.ui.sacSelOn = !S.ui.sacSelOn; sel().clear(); S.render(); },
  'sac-sel-one': el => { const s = sel(); s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.add(el.dataset.id); S.render(); },
  'sac-sel-all': el => { const ids = el.dataset.ids.split(',').filter(Boolean), s = sel(), all = ids.every(id => s.has(id)); s.clear(); if (!all) ids.forEach(id => s.add(id)); S.render(); },
  'sac-new': el => itemSheet(null, { perm: el.dataset.perm === '1', k: el.dataset.k || '' }),
  'sac-item': el => { if (S.ui.sacSelOn) { actions['sac-sel-one'](el); return; } const i = S.sac.find(x => x.id === el.dataset.id); if (i) itemSheet(i, { relais: (S.ui.sacTab || 'relais') === 'relais' }); },
  'sac-out-one': async el => {
    const h = S.ui.sacPick, i = S.sac.find(x => x.id === el.dataset.id); if (!h || !i) return;
    await guard(() => setRun(runKey(h), { excluded: { [i.id]: true } }), 'Retiré de ce relais'); closeSheet();
  },
  'sac-ph-del': el => { const sh = el.closest('.sheet'); sh._photo = null; sh.querySelector('[data-part="ph"]').innerHTML = '<span>🎒</span>'; },
  'sac-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), id = el.dataset.id;
    if (!f.name) return toast("Donnez un nom à l'affaire.", 'warn');
    const data = { name: f.name, desc: f.desc || '', qty: Math.max(1, +f.qty || 1), childIds: f.childIds, perm: !!f.perm, runKey: f.perm ? '' : (el.dataset.k || ''), photo: sh._photo || null };
    if (!data.perm && !data.runKey) { const h = S.ui.sacPick; if (h) data.runKey = runKey(h); else data.perm = true; }
    el.disabled = true;
    const ok = await guard(async () => {
      if (id) await S.be.db.update(fpath('sac', id), { ...data, updatedAt: Date.now() });
      else { const nid2 = S.be.db.newId(); await S.be.db.set(fpath('sac', nid2), { ...data, createdAt: Date.now(), createdBy: uid(), createdByName: myName() }); await log('sac', `Sac : ${f.name} ajouté${data.perm ? ' à la liste type' : ''}`, { body: f.desc || '', icon: '🎒' }); }
      return true;
    }, 'Enregistré');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'sac-del': async el => {
    const i = S.sac.find(x => x.id === el.dataset.id); if (!i) return;
    if (!(await confirmBox(`Supprimer « ${i.name} » ?`, i.perm ? 'Elle disparaît de la liste type et de tous les relais.' : '', 'Supprimer', true))) return;
    await guard(() => S.be.db.del(fpath('sac', i.id)), 'Supprimé'); closeSheet();
  },
  // suppression de plusieurs affaires de la liste type
  'sac-del-sel': async () => {
    const ids = [...sel()].filter(id => S.sac.some(x => x.id === id)); if (!ids.length) return;
    if (!(await confirmBox(`Supprimer ${ids.length} affaire${ids.length > 1 ? 's' : ''} ?`, 'Elles disparaissent de la liste type et de tous les relais.', 'Supprimer', true))) return;
    await guard(async () => { for (const id of ids) await S.be.db.del(fpath('sac', id)); await log('sac', `Sac : ${ids.length} affaire${ids.length > 1 ? 's' : ''} supprimée${ids.length > 1 ? 's' : ''} de la liste type`, { icon: '🗑️' }); }, 'Supprimé');
    S.ui.sacSelOn = false; sel().clear(); S.render();
  },
  // retrait de ce relais seulement (la liste type est conservée) ; les affaires « ce relais uniquement » sont supprimées
  'sac-out-sel': async () => {
    const h = S.ui.sacPick, ids = [...sel()]; if (!h || !ids.length) return;
    if (!(await confirmBox(`Retirer ${ids.length} affaire${ids.length > 1 ? 's' : ''} de ce relais ?`, 'La liste type n\'est pas modifiée.', 'Retirer', true))) return;
    await guard(async () => {
      const ex = {};
      for (const id of ids) { const i = S.sac.find(x => x.id === id); if (!i) continue; if (i.perm) ex[id] = true; else await S.be.db.del(fpath('sac', id)); }
      if (Object.keys(ex).length) await setRun(runKey(h), { excluded: ex });
    }, 'Retiré de ce relais');
    S.ui.sacSelOn = false; sel().clear(); S.render();
  },
  'sac-restore': async el => { const run = S.sacRuns.find(r => r.id === el.dataset.k); if (!run) return; const ex = {}; for (const k of Object.keys(run.excluded || {})) ex[k] = null; await guard(() => setRun(el.dataset.k, { excluded: ex }), 'Affaires remises'); },
  'sac-pack': async el => { const run = S.sacRuns.find(r => r.id === el.dataset.k) || {}, on = !run.packed?.[el.dataset.id]; await guard(() => setRun(el.dataset.k, { packed: { [el.dataset.id]: on ? { by: uid(), byName: myName(), at: Date.now() } : null } })); },
  'sac-got': async el => { const run = S.sacRuns.find(r => r.id === el.dataset.k) || {}, on = !run.got?.[el.dataset.id]; await guard(() => setRun(el.dataset.k, { got: { [el.dataset.id]: on ? { by: uid(), byName: myName(), at: Date.now() } : null }, missing: { [el.dataset.id]: null } })); },
  'sac-ready': async el => {
    const h = S.ui.sacPick; if (!h) return; const items = itemsFor(h), run = runOf(h);
    const left = items.filter(i => !run.packed?.[i.id]);
    if (left.length && !(await confirmBox('Sac prêt ?', `Pas encore cochés : ${esc(left.map(i => i.name).join(', '))}`, 'Oui, c\'est prêt'))) return;
    await guard(async () => { await setRun(el.dataset.k, { readyAt: Date.now(), readyBy: uid(), readyByName: myName() }); await log('sac', `🎒 Sac prêt pour le relais ${E.relDay(h.date)} ${E.fmtTime(h.time)}`, { body: `${items.length - left.length}/${items.length} affaires : ${items.filter(i => run.packed?.[i.id]).map(i => i.name).join(', ')}`.slice(0, 160), icon: '🎒' }); }, 'Sac prêt ✓');
  },
  'sac-done': async el => {
    const h = S.ui.sacPick; if (!h) return; const items = itemsFor(h), all = {};
    for (const i of items) all[i.id] = { by: uid(), byName: myName(), at: Date.now() };
    await guard(async () => { await setRun(el.dataset.k, { got: all, doneAt: Date.now(), doneBy: uid(), doneByName: myName() }); await log('sac', `📥 Tout est bien arrivé (relais ${E.relDay(h.date)})`, { icon: '📥' }); }, 'Réception confirmée ✓');
  },
  'sac-miss': el => {
    const h = S.ui.sacPick; if (!h) return; const items = itemsFor(h), run = runOf(h);
    openSheet(`<h3 class="sh-title">⚠️ Signaler un oubli</h3><p class="small muted">Cochez ce qui manque : ${esc(pName(h.from))} sera prévenu(e).</p>
      ${chips('miss', items.filter(i => !run.got?.[i.id]).map(i => ({ v: i.id, l: esc(i.name) })), [], { multi: true })}
      <label class="lbl">Message (facultatif)</label><textarea class="in" name="msg" rows="2" placeholder="Ex. Le doudou est resté dans la voiture ?"></textarea>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn danger f1" data-act="sac-miss-go" data-k="${el.dataset.k}">Signaler</button></div>`);
  },
  'sac-miss-go': async el => {
    const f = readForm(el.closest('.sheet')), h = S.ui.sacPick; if (!f.miss?.length) return toast('Cochez au moins une affaire.', 'warn');
    const names = f.miss.map(id => S.sac.find(i => i.id === id)?.name).filter(Boolean);
    const miss = {}; for (const id of f.miss) miss[id] = { by: uid(), byName: myName(), at: Date.now() };
    await guard(async () => { await setRun(el.dataset.k, { missing: miss }); await log('sac', `⚠️ Oubli signalé : ${names.join(', ')}`, { body: f.msg || (h ? `relais ${E.relDay(h.date)} ${E.fmtTime(h.time)}` : ''), icon: '⚠️' }); }, 'Oubli signalé');
    closeSheet();
  },
  // ───── listes des vacances
  'vl-new': el => listSheet(null, el.dataset.p),
  'vl-edit': el => { const l = L(el.dataset.id); if (l) listSheet(l); },
  'vl-save': async el => {
    const f = readForm(el.closest('.sheet')), id = el.dataset.id, me = myCode() || 'A';
    if (!f.title) return toast('Donnez un titre à la liste.', 'warn');
    const per = periods().find(x => x.id === f.per) || L(id)?.period; if (!per) return toast('Choisissez les vacances.', 'warn');
    const dir = f.dir || 'request', giver = dir === 'request' ? other(me) : me;
    const base = { title: f.title, period: { id: per.id, n: per.n, i: per.i || '🏖️', s: per.s, e: per.e }, dir, ownerCode: me, giver, childIds: f.childIds };
    el.disabled = true;
    const ok = await guard(async () => {
      if (id) { await vupd(id, base); return id; }
      const src = f.from ? L(f.from) : null, items = {};
      if (src) Object.entries(src.items || {}).forEach(([k, v], n) => { items[nid()] = { name: v.name, desc: v.desc || '', qty: v.qty || 1, order: n, photos: v.photos || [] }; });
      const nid2 = S.be.db.newId();
      await S.be.db.set(fpath('sac', nid2), { kind: 'vlist', ...base, items, st: { aller: {}, retour: {} }, phase: {}, createdAt: Date.now(), createdBy: uid(), createdByName: myName() });
      await log('sac', dir === 'request' ? `🧳 ${myName()} demande une liste : ${f.title}` : `🧳 Nouvelle liste : ${f.title}`, { body: `${per.n} · ${dir === 'request' ? 'à fournir par ' + pName(giver) : 'fournie par ' + pName(giver)}`, icon: '🧳' });
      return nid2;
    }, id ? 'Liste modifiée' : 'Liste créée');
    if (ok) { if (id) closeSheet(); else closeSheetsThen(() => go('sacl', { id: ok })); } else el.disabled = false;
  },
  'vl-del': async el => {
    const l = L(el.dataset.id); if (!l) return;
    if (!(await confirmBox(`Supprimer la liste « ${l.title} » ?`, 'Tous ses éléments et les coches aller / retour sont supprimés.', 'Supprimer', true))) return;
    await guard(async () => { await S.be.db.del(fpath('sac', l.id)); await log('sac', `Liste supprimée : ${l.title}`, { icon: '🗑️' }); }, 'Liste supprimée');
    go('sac');
  },
  'vl-item': el => { if (S.ui.sacSelOn) return; const l = L(el.dataset.id); if (l) vItemSheet(l, el.dataset.i || null); },
  'vl-item-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), l = L(el.dataset.id); if (!l) return;
    if (!f.name) return toast("Donnez un nom à l'élément.", 'warn');
    let iid = el.dataset.i; const isNew = !iid; if (!iid) iid = nid();
    el.disabled = true;
    const ok = await guard(async () => {
      const db = S.be.db, photos = [];
      const files = [...(sh.querySelector('[data-vi]')?.files || [])].slice(0, 20);
      for (const file of files) {
        const full = await compressImage(file, 1280, 0.72), thumb = await compressImage(file, 220, 0.6);
        const bid = db.newId(); await db.set(fpath('blobs', bid), { data: full, mime: 'image/jpeg', name: 'photo.jpg', kind: 'sac', at: Date.now(), by: uid() });
        photos.push({ id: nid(), thumb, blobId: bid, by: uid() });
      }
      const cur = l.items?.[iid] || {};
      await vupd(l.id, { [`items.${iid}`]: { name: f.name, desc: f.desc || '', qty: Math.max(1, +f.qty || 1), order: cur.order ?? Object.keys(l.items || {}).length, photos: [...(cur.photos || []), ...photos] } });
      if (isNew) await log('sac', `🧳 ${l.title} : ${f.name} ×${Math.max(1, +f.qty || 1)} ajouté`, { icon: '🧳' });
      return true;
    }, 'Élément enregistré');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'vl-item-del': async el => {
    const l = L(el.dataset.id), iid = el.dataset.i; if (!l?.items?.[iid]) return;
    if (!(await confirmBox(`Supprimer « ${l.items[iid].name} » ?`, '', 'Supprimer', true))) return;
    const db = S.be.db;
    await guard(() => vupd(l.id, { [`items.${iid}`]: db.deleteField(), [`st.aller.${iid}`]: db.deleteField(), [`st.retour.${iid}`]: db.deleteField() }), 'Supprimé');
    closeSheet();
  },
  'vl-del-sel': async () => {
    const id = S.route.params.id, l = L(id), ids = [...sel()].filter(i => l?.items?.[i]); if (!ids.length) return;
    if (!(await confirmBox(`Supprimer ${ids.length} élément${ids.length > 1 ? 's' : ''} ?`, ids.length === Object.keys(l.items).length ? 'La liste sera vide.' : '', 'Supprimer', true))) return;
    const db = S.be.db, data = {};
    for (const i of ids) { data[`items.${i}`] = db.deleteField(); data[`st.aller.${i}`] = db.deleteField(); data[`st.retour.${i}`] = db.deleteField(); }
    await guard(async () => { await vupd(id, data); await log('sac', `🧳 ${l.title} : ${ids.length} élément${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}`, { icon: '🗑️' }); }, 'Supprimé');
    S.ui.sacSelOn = false; sel().clear(); S.render();
  },
  'vl-done': async el => {
    const l = L(el.dataset.id), { i, ph } = el.dataset; if (!l) return;
    const st = l.st?.[ph]?.[i] || {}, on = !st.done;
    const card = el.closest('.vi'), qIn = card?.querySelector('[data-change="vl-qty"]'), q = qIn && qIn.value !== '' ? +qIn.value : (st.qty ?? (+l.items[i].qty || 1));
    await guard(() => vupd(l.id, { [`st.${ph}.${i}.done`]: on, [`st.${ph}.${i}.qty`]: on ? q : st.qty ?? null, [`st.${ph}.${i}.by`]: uid(), [`st.${ph}.${i}.byName`]: myName(), [`st.${ph}.${i}.at`]: Date.now() }));
  },
  'vl-got': async el => {
    const l = L(el.dataset.id), { i, ph } = el.dataset; if (!l) return;
    const st = l.st?.[ph]?.[i] || {}, on = !st.got;
    const card = el.closest('.vi'), qIn = card?.querySelector('[data-change="vl-gotqty"]'), q = qIn && qIn.value !== '' ? +qIn.value : (st.gotQty ?? st.qty ?? (+l.items[i].qty || 1));
    await guard(() => vupd(l.id, { [`st.${ph}.${i}.got`]: on, [`st.${ph}.${i}.gotQty`]: on ? q : st.gotQty ?? null, [`st.${ph}.${i}.gotBy`]: uid(), [`st.${ph}.${i}.gotByName`]: myName(), [`st.${ph}.${i}.gotAt`]: Date.now() }));
  },
  'vl-qty': async el => { const { id, i, ph } = el.dataset; await guard(() => vupd(id, { [`st.${ph}.${i}.qty`]: el.value === '' ? null : Math.max(0, +el.value) })); },
  'vl-gotqty': async el => { const { id, i, ph } = el.dataset; await guard(() => vupd(id, { [`st.${ph}.${i}.gotQty`]: el.value === '' ? null : Math.max(0, +el.value) })); },
  'vl-note': async el => { const { id, i, ph } = el.dataset; await guard(() => vupd(id, { [`st.${ph}.${i}.note`]: el.value.trim() })); },
  'vl-ph': async el => {
    const l = L(el.dataset.id), { i, p, ph } = el.dataset; if (!l) return;
    const on = !l.st?.[ph]?.[i]?.ph?.[p];
    await guard(() => vupd(l.id, { [`st.${ph}.${i}.ph.${p}`]: on ? { by: uid(), at: Date.now() } : null }));
  },
  'vl-zoom': async el => {
    const sh = openSheet(`<div data-part="b"><img class="receipt" style="max-height:72vh" src="${el.dataset.t}"></div><button class="btn primary block mt" data-act="close-sheet">Fermer</button>`);
    if (el.dataset.b) { const b = await S.be.db.get(fpath('blobs', el.dataset.b)).catch(() => null); if (b) sh.querySelector('[data-part="b"]').innerHTML = `<img class="receipt" style="max-height:72vh" src="${b.data}">`; }
  },
  'vl-sent': async el => {
    const l = L(el.dataset.id), ph = el.dataset.ph; if (!l) return;
    const ids = Object.keys(l.items || {}), st = l.st?.[ph] || {}, left = ids.filter(i => !st[i]?.done);
    if (left.length && !(await confirmBox('Tout est préparé ?', `Pas encore cochés : ${esc(left.map(i => l.items[i].name).join(', '))}`, 'Oui, envoyer'))) return;
    const lines = ids.filter(i => st[i]?.done).map(i => `${l.items[i].name} ×${st[i].qty ?? l.items[i].qty ?? 1}`).join(', ');
    await guard(async () => { await vupd(l.id, { [`phase.${ph}.sentAt`]: Date.now(), [`phase.${ph}.sentByName`]: myName() }); await log('sac', `🧳 ${l.title} (${ph}) : ${ids.length - left.length}/${ids.length} préparés`, { body: lines.slice(0, 180), icon: '🎒' }); }, 'Préparation envoyée ✓');
  },
  'vl-recv': async el => {
    const l = L(el.dataset.id), ph = el.dataset.ph; if (!l) return;
    const ids = Object.keys(l.items || {}), st = l.st?.[ph] || {};
    const gaps = ids.filter(i => st[i]?.got && st[i]?.gotQty != null && +st[i].gotQty !== +(st[i].qty ?? l.items[i].qty ?? 1)).map(i => `${l.items[i].name} : ${st[i].qty ?? l.items[i].qty} mis / ${st[i].gotQty} reçus`);
    const miss = ids.filter(i => !st[i]?.got).map(i => l.items[i].name);
    await guard(async () => { await vupd(l.id, { [`phase.${ph}.gotAt`]: Date.now(), [`phase.${ph}.gotByName`]: myName() }); await log('sac', `📥 ${l.title} (${ph}) : réception ${gaps.length || miss.length ? 'avec écarts' : 'complète ✓'}`, { body: [...gaps, ...(miss.length ? ['non reçus : ' + miss.join(', ')] : [])].join(' · ').slice(0, 180), icon: gaps.length || miss.length ? '⚠️' : '📥' }); }, 'Réception confirmée');
  },
};

// ───── Import de listes préparées (lien #/import?k=…) : crée les listes des vacances dans le cercle ouvert
function readImport(k) {
  try { let b = String(k).replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0)))); }
  catch (e) { return null; }
}
function findPeriod(id) { const st = settings(); return E.schoolHolidays(st.zone || 'B', st.customHolidays || []).find(p => p.id === id) || null; }
views.import = p => {
  const d = p.k ? readImport(p.k) : S.ui.importData;
  if (p.k && d) { S.ui.importData = d; history.replaceState(null, '', '#/import'); S.route = { view: 'import', params: {} }; }
  if (!d?.lists?.length) return { title: 'Importer', back: 'sac', html: '<div class="card empty">Lien d\'import invalide ou déjà utilisé.</div>' };
  if (!isParent()) return { title: 'Importer', back: 'home', html: '<div class="card empty">Réservé aux parents.</div>' };
  const pr = parents(), me = myCode() || 'A';
  return {
    title: 'Importer des listes', back: 'sac',
    html: `<div class="card"><h3>🧳 ${d.lists.length} listes des vacances</h3><p class="small muted" style="margin-top:0">Elles seront ajoutées au cercle <b>${esc(S.family?.name || '')}</b>, pour ${esc(childNames(S.children.map(c => c.id)))}.</p>
      ${d.lists.map(l => { const per = findPeriod(l.per); return `<div class="per" style="align-items:flex-start"><div class="pi">${per?.i || '🏖️'}</div><div class="f1"><div class="pn">${esc(l.title)} · ${esc(per ? pLabel(per) : l.per)}</div>
        <div class="pd">${l.dir === 'request' ? `${esc(pr[other(me)].name)} fournit` : `${esc(pr[me].name)} fournit`} · ${l.items.length} éléments</div>
        <div class="tiny muted mt6">${l.items.map(i => `${esc(i[0])}${i[1] > 1 ? ' ×' + i[1] : ''}`).join(' · ')}</div></div></div>`; }).join('')}
      <button class="btn primary block mt" data-act="import-go">✅ Ajouter ces listes</button></div>
      ${S.ui.testHint ? '' : '<div class="hint center">Astuce : ouvrez d\'abord le cercle de test (Réglages › Mode test) pour essayer sans toucher au vrai cercle.</div>'}`,
  };
};
actions['import-go'] = async el => {
  const d = S.ui.importData; if (!d) return; el.disabled = true;
  const me = myCode() || 'A', kids = S.children.map(c => c.id);
  const ok = await guard(async () => {
    let n = 0;
    for (const l of d.lists) {
      const per = findPeriod(l.per); if (!per) continue;
      const items = {}; l.items.forEach((it, k) => { items[nid()] = { name: it[0], qty: Math.max(1, +it[1] || 1), desc: it[2] || '', order: k, photos: [] }; });
      await S.be.db.set(fpath('sac', S.be.db.newId()), { kind: 'vlist', title: l.title, period: { id: per.id, n: per.n, i: per.i || '🏖️', s: per.s, e: per.e }, dir: l.dir || 'request', ownerCode: me, giver: (l.dir || 'request') === 'request' ? other(me) : me, childIds: kids, items, st: { aller: {}, retour: {} }, phase: {}, createdAt: Date.now(), createdBy: uid(), createdByName: myName() });
      n++;
    }
    await log('sac', `🧳 ${n} listes des vacances ajoutées`, { body: d.lists.map(l => l.title).join(' · ').slice(0, 160), icon: '🧳' });
    return n;
  }, 'Listes ajoutées ✓');
  if (ok) {
    const first = d.lists.map(l => findPeriod(l.per)).filter(p => p && p.e >= E.todayISO()).sort((a, b) => a.s.localeCompare(b.s))[0];
    S.ui.importData = null; S.ui.sacTab = 'vac'; if (first) S.ui.sacPer = first.id; go('sac');
  } else el.disabled = false;
};
