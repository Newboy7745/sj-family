// ═══════════════ Sac du relais : ce qui suit les enfants à chaque relais (photo, description), préparé puis reçu ═══════════════
import * as E from './engine.js?v=6.4';
import { S, engine, parents, pName, pShort, uid, myName, myCode, isParent, childNames, selIds, fpath, log, guard, can, kidAvatar, countdown, updItem } from './core.js?v=6.4';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, IC, compressImage, fmtAgo } from './ui.js?v=6.4';
import { kidChips } from './views-home.js?v=6.4';

const runKey = h => `${h.date}_${h.time.replace(':', '')}_${h.to}`;
/** Relais proposés : le dernier (pour confirmer la réception) et les 3 prochains */
function relaisList(ids) {
  const eng = engine(), today = E.todayISO(), min = E.nowMin();
  const past = eng.handovers(ids, E.addDays(today, -3), today).filter(h => h.date < today || E.t2m(h.time) <= min);
  const next = eng.nextHandovers(ids, today, min, 3);
  return { last: past[past.length - 1] || null, next };
}
function itemsFor(h) {
  const key = runKey(h);
  return S.sac.filter(i => (i.perm ? true : i.runKey === key) && (!i.childIds?.length || i.childIds.some(id => h.childIds.includes(id))))
    .sort((a, b) => (a.perm === b.perm ? 0 : a.perm ? -1 : 1) || (a.createdAt || 0) - (b.createdAt || 0));
}
const runOf = h => S.sacRuns.find(r => r.id === runKey(h)) || { packed: {}, got: {}, missing: {} };
/** Badge : objets pas encore dans le sac pour un relais où je donne les enfants dans moins de 36 h */
export function pendingCount() {
  if (!S.sac.length || !S.children.length || !isParent()) return 0;
  const h = relaisList(S.children.map(c => c.id)).next[0]; if (!h || h.from !== myCode()) return 0;
  const [Y, M, D] = h.date.split('-').map(Number), [hh, mm] = h.time.split(':').map(Number);
  if (new Date(Y, M - 1, D, hh, mm) - Date.now() > 36 * 3600000) return 0;
  const run = runOf(h); return itemsFor(h).filter(i => !run.packed?.[i.id]).length;
}
function itemRow(i, run, h) {
  const p = run.packed?.[i.id], g = run.got?.[i.id], miss = run.missing?.[i.id];
  return `<div class="sac-it ${g ? 'got' : ''} ${miss ? 'miss' : ''}">
    <button class="sac-ph" data-act="sac-item" data-id="${i.id}">${i.photo ? `<img src="${i.photo}" alt="">` : '<span>🎒</span>'}</button>
    <button class="f1" style="text-align:left;min-width:0" data-act="sac-item" data-id="${i.id}"><div class="b">${esc(i.name)}${i.qty > 1 ? ` <span class="muted">×${i.qty}</span>` : ''}</div>
      ${i.desc ? `<div class="small muted">${esc(i.desc)}</div>` : ''}
      <div class="tiny muted">${i.childIds?.length ? esc(childNames(i.childIds)) + ' · ' : ''}${i.perm ? 'à chaque relais' : 'ce relais uniquement'}${miss ? ' · <b style="color:var(--err)">⚠️ manquant</b>' : ''}</div></button>
    <div class="sac-ck"><button class="ck2 ${p ? 'on' : ''}" data-act="sac-pack" data-id="${i.id}" data-k="${runKey(h)}" title="Dans le sac">🎒<span>${p ? '✓' : ''}</span></button>
      <button class="ck2 ${g ? 'on' : ''}" data-act="sac-got" data-id="${i.id}" data-k="${runKey(h)}" title="Reçu">📥<span>${g ? '✓' : ''}</span></button></div></div>`;
}
export const views = {
  sac(p) {
    const ids = selIds();
    if (!can('sac')) return { title: 'Sac du relais', back: 'home', html: '<div class="card empty">Rubrique réservée aux parents.</div>' };
    const tab = p.tab || 'relais';
    const { last, next } = relaisList(ids);
    const opts = [...(last ? [last] : []), ...next];
    const pick = opts.find(h => runKey(h) === S.ui.sacKey) || (last && itemsFor(last).some(i => !runOf(last).got?.[i.id]) && Date.now() - new Date(...last.date.split('-').map((x, k) => k === 1 ? x - 1 : +x)).getTime() < 2 * 86400000 ? last : next[0] || last);
    let body = '';
    if (tab === 'liste') {
      const perm = S.sac.filter(i => i.perm && (!i.childIds?.length || i.childIds.some(id => ids.includes(id))));
      body = `<div class="card"><h3>📋 Liste type <a class="act" data-act="sac-new" data-perm="1">${IC.plus} Ajouter</a></h3>
        <p class="small muted" style="margin-top:0">Ces affaires sont proposées à chaque relais.</p>
        ${perm.length ? perm.map(i => `<button class="li" style="width:100%;text-align:left" data-act="sac-item" data-id="${i.id}"><span class="sac-ph sm">${i.photo ? `<img src="${i.photo}" alt="">` : '<span>🎒</span>'}</span><div class="f1"><div class="lt">${esc(i.name)}</div><div class="ls">${esc(i.desc || '')}${i.childIds?.length ? ' · ' + esc(childNames(i.childIds)) : ''}</div></div><span class="lnk">›</span></button>`).join('') : '<div class="empty"><div class="e-i">🎒</div>Ajoutez cartable, doudou, médicaments, tenue de sport…</div>'}</div>`;
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
        ${items.length ? `<div class="card tight">${items.map(i => itemRow(i, run, pick)).join('')}</div>` : '<div class="card empty"><div class="e-i">🎒</div>Rien dans le sac pour ce relais. Ajoutez des affaires ou une liste type.</div>'}
        <button class="btn soft block mb" data-act="sac-new" data-k="${runKey(pick)}">${IC.camera} Ajouter une affaire (photo + description)</button>
        <div class="row gap wrap">${me === pick.from || !me ? `<button class="btn primary f1" data-act="sac-ready" data-k="${runKey(pick)}">✅ Sac prêt</button>` : ''}
          ${me === pick.to || !me ? `<button class="btn ok f1" data-act="sac-done" data-k="${runKey(pick)}">📥 Tout est arrivé</button><button class="btn danger f1" data-act="sac-miss" data-k="${runKey(pick)}">⚠️ Signaler un oubli</button>` : ''}</div>`;
      S.ui.sacPick = pick;
    }
    return {
      title: 'Sac du relais', back: isParent() ? null : 'home',
      html: `${kidChips()}<div class="seg mt"><button class="${tab === 'relais' ? 'on' : ''}" data-go="sac" data-params='{"tab":"relais"}'>🔁 Prochain relais</button><button class="${tab === 'liste' ? 'on' : ''}" data-go="sac" data-params='{"tab":"liste"}'>📋 Liste type</button></div>${body}`,
    };
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
    <div class="sh-actions">${i ? `<button class="btn danger" data-act="sac-del" data-id="${i.id}">${IC.trash}</button>` : ''}<button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="sac-save" data-id="${i?.id || ''}" data-k="${o.k || i?.runKey || ''}">Enregistrer</button></div>`);
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
export const actions = {
  'sac-pick': el => { S.ui.sacKey = el.dataset.k; S.render(); },
  'sac-new': el => itemSheet(null, { perm: el.dataset.perm === '1', k: el.dataset.k || '' }),
  'sac-item': el => { const i = S.sac.find(x => x.id === el.dataset.id); if (i) itemSheet(i); },
  'sac-ph-del': el => { const sh = el.closest('.sheet'); sh._photo = null; sh.querySelector('[data-part="ph"]').innerHTML = '<span>🎒</span>'; },
  'sac-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), id = el.dataset.id;
    if (!f.name) return toast("Donnez un nom à l'affaire.", 'warn');
    const data = { name: f.name, desc: f.desc || '', qty: Math.max(1, +f.qty || 1), childIds: f.childIds, perm: !!f.perm, runKey: f.perm ? '' : (el.dataset.k || ''), photo: sh._photo || null };
    if (!data.perm && !data.runKey) { const h = S.ui.sacPick; if (h) data.runKey = runKey(h); else data.perm = true; }
    el.disabled = true;
    const ok = await guard(async () => {
      if (id) await S.be.db.update(fpath('sac', id), { ...data, updatedAt: Date.now() });
      else { const nid = S.be.db.newId(); await S.be.db.set(fpath('sac', nid), { ...data, createdAt: Date.now(), createdBy: uid(), createdByName: myName() }); await log('sac', `Sac : ${f.name} ajouté${data.perm ? ' à la liste type' : ''}`, { body: f.desc || '', icon: '🎒' }); }
      return true;
    }, 'Enregistré');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'sac-del': async el => {
    const i = S.sac.find(x => x.id === el.dataset.id); if (!i) return;
    if (!(await confirmBox(`Retirer « ${i.name} » ?`, '', 'Retirer', true))) return;
    await guard(() => S.be.db.del(fpath('sac', i.id)), 'Retiré'); closeSheet();
  },
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
};
