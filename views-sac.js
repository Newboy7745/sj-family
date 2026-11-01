// ═══════════════ Sac : affaires de chaque relais, listes des vacances (demande / envoi, aller / retour) et listes type ═══════════════
import * as E from './engine.js?v=6.9';
import { S, engine, parents, uid, myName, myCode, isParent, childNames, selIds, fpath, log, guard, can, kidAvatar, countdown, settings, go, LS } from './core.js?v=6.9';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, IC, compressImage, fmtAgo, closeSheetsThen } from './ui.js?v=6.9';
import { kidChips } from './views-home.js?v=6.9';
import { buildFile, shareFile, saveFile } from './sac-export.js?v=6.9';

const runKey = h => `${h.date}_${h.time.replace(':', '')}_${h.to}`;
const relaisItems = () => S.sac.filter(i => !i.kind);
const vlists = () => S.sac.filter(i => i.kind === 'vlist');
const other = c => (c === 'A' ? 'B' : 'A');
const nid = () => S.be.db.newId().slice(0, 12);
const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Prénom affiché dans le Sac (jamais « Papa » ni « Maman » ; dans le cercle de test : « Maman TEST ») */
export function nm(code) {
  if (!code) return '—';
  if (S.family?.testCircle && code === 'B') return 'Maman TEST';
  return parents()[code]?.name || '—';
}
const codeOfUid = u => { const p = parents(); return p.A.uid === u ? 'A' : p.B.uid === u ? 'B' : null; };
const nmU = u => nm(codeOfUid(u));
/** Date sans l'heure */
const dd = t => (t ? E.fmtDate(typeof t === 'number' ? E.todayISO(new Date(t)) : String(t).slice(0, 10), 'num') : '');
const today = () => E.todayISO();

// ───── Vacances : nom court + année (« Toussaint 27 »)
const VAC = { tou: ['Toussaint', '🎃', 'Affaires de la Toussaint'], noel: ['Noël', '🎄', 'Affaires de Noël'], hiv: ['Hiver', '⛄', "Affaires d'hiver"], pri: ['Pâques', '🌼', 'Affaires de Pâques'], ete: ['Été', '☀️', "Affaires d'été"] };
const VKEYS = Object.keys(VAC);
const vacOf = id => (String(id || '').match(/^(tou|noel|hiv|pri|ete)\d/) || [])[1] || null;
const yy = p => String(p?.s || '').slice(2, 4);
const vShort = p => VAC[vacOf(p?.id)]?.[0] || String(p?.n || '').replace(/^Vacances (de la |de |d')/, '').replace(/^./, c => c.toUpperCase());
const vacName = p => `${vShort(p)} ${yy(p)}`;
const pLabel = p => `${p.i || '🏖️'} ${vacName(p)}`;
/** Titre d'une liste avec ses vacances et l'année : « Affaires de la Toussaint 27 », « Vêtements · Noël 26 » */
function ltitle(l) {
  const p = l?.period; if (!p) return l?.title || '';
  const s = vShort(p); return norm(l.title).includes(norm(s)) ? `${l.title} ${yy(p)}` : `${l.title} · ${s} ${yy(p)}`;
}
const tplAll = () => S.profile?.sacTpl || {};
const tpl = v => tplAll()[v] || { dir: 'request', items: {} };
const tplItems = v => Object.entries(tpl(v).items || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
async function tplUpd(data) { await S.be.db.update(`users/${uid()}`, data); }
function vacPeriods(v) {
  const st = settings();
  return E.schoolHolidays(st.zone || 'B', st.customHolidays || []).filter(p => vacOf(p.id) === v && p.e > today()).slice(0, 3);
}

// ───── Relais
/** Relais proposés : le dernier (pour confirmer la réception) et les 3 prochains */
function relaisList(ids) {
  const eng = engine(), t = today(), min = E.nowMin();
  const past = eng.handovers(ids, E.addDays(t, -3), t).filter(h => h.date < t || E.t2m(h.time) <= min);
  const next = eng.nextHandovers(ids, t, min, 3);
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
// ───── sélection multiple
const sel = () => (S.ui.sacSel ||= new Set());
const selBar = (ids, delAct, label) => S.ui.sacSelOn ? `<div class="selbar"><button class="btn soft sm" data-act="sac-sel-all" data-ids="${ids.join(',')}">${ids.length && ids.every(id => sel().has(id)) ? 'Aucun' : 'Tout'}</button>
  <span class="f1 small b">${sel().size} choisi${sel().size > 1 ? 's' : ''}</span><button class="btn danger sm" data-act="${delAct}" ${sel().size ? '' : 'disabled'}>${IC.trash} ${label}</button><button class="btn ghost sm" data-act="sac-sel">OK</button></div>`
  : `<button class="btn soft sm" data-act="sac-sel">☑️ Sélectionner</button>`;
const selBox = id => S.ui.sacSelOn ? `<button class="ck ${sel().has(id) ? 'on' : ''}" data-act="sac-sel-one" data-id="${id}">${sel().has(id) ? '✓' : ''}</button>` : '';
/** Case de validation lisible : ☐ Envoyé / ☑ Envoyé */
const vbox = (on, label, attrs, dis = false) => `<button class="vbox ${on ? 'on' : ''}" ${dis ? 'disabled' : ''} ${attrs}><span class="bx">${on ? '✓' : ''}</span>${label}</button>`;

function itemRow(i, run, h) {
  const p = run.packed?.[i.id], g = run.got?.[i.id], miss = run.missing?.[i.id], me = myCode();
  return `<div class="sac-it ${g ? 'got' : ''} ${miss ? 'miss' : ''}">${selBox(i.id)}
    <button class="sac-ph" data-act="sac-item" data-id="${i.id}">${i.photo ? `<img src="${i.photo}" alt="">` : '<span>🎒</span>'}</button>
    <div class="f1" style="min-width:0"><button style="text-align:left;width:100%" data-act="sac-item" data-id="${i.id}"><div class="b">${esc(i.name)}${i.qty > 1 ? ` <span class="muted">×${i.qty}</span>` : ''}</div>
      ${i.desc ? `<div class="small muted">${esc(i.desc)}</div>` : ''}
      <div class="tiny muted">${i.childIds?.length ? esc(childNames(i.childIds)) + ' · ' : ''}${i.perm ? 'à chaque relais' : 'ce relais uniquement'}${miss ? ' · <b style="color:var(--err)">⚠️ manquant</b>' : ''}</div></button>
    ${S.ui.sacSelOn ? '' : `<div class="row gap6 wrap mtx">${vbox(p, 'Dans le sac', `data-act="sac-pack" data-id="${i.id}" data-k="${runKey(h)}"`, me && me !== h.from)}${vbox(g, 'Reçu', `data-act="sac-got" data-id="${i.id}" data-k="${runKey(h)}"`, me && me !== h.to)}</div>`}</div></div>`;
}

// ───── Listes des vacances : rôles, quantités, droits, étapes, alertes
function periods() {
  const st = settings(), t = today(), withLists = new Set(vlists().map(l => l.period?.id));
  return E.schoolHolidays(st.zone || 'B', st.customHolidays || []).filter(p => withLists.has(p.id) || (p.e >= E.addDays(t, -21) && p.s <= E.addDays(t, 400))).slice(-14);
}
const ownerOf = l => l.giver; // propriétaire des affaires : il les fournit à l'aller et les récupère au retour
const creatorCode = l => l.ownerCode || codeOfUid(l.createdBy);
const isCreator = l => l.createdBy === uid();
function phaseInfo(l, ph) { const g = ph === 'retour' ? other(l.giver) : l.giver; return { giver: g, receiver: other(g) }; }
const stOf = (l, ph, iid) => l.st?.[ph]?.[iid] || {};
const authorOf = (l, it) => it?.by || l.createdBy;
/** Quantité envoyée à l'aller (sinon celle demandée / prévue) */
const sentQty = (l, iid) => stOf(l, 'aller', iid).qty ?? (+l.items?.[iid]?.qty || 1);
/** Quantité à rendre = quantité reçue à l'aller (non modifiable) */
const retQty = (l, iid) => { const a = stOf(l, 'aller', iid); return a.got ? (a.gotQty ?? sentQty(l, iid)) : sentQty(l, iid); };
const started = l => !!l.period && today() >= l.period.s;
/** Un ajout est daté (et signalé) dès que la période a commencé ou que l'autre parent a commencé à agir */
const datedAdd = l => started(l) || !!l.phase?.aller?.sentAt || !!l.phase?.aller?.gotAt || otherActed(l);
/** Une action de l'autre parent sur cet élément (envoi, réception, retour…) */
function otherActedItem(l, iid) {
  const a = authorOf(l, l.items?.[iid]);
  return ['aller', 'retour'].some(ph => { const s = stOf(l, ph, iid); return (s.done && s.by && s.by !== a) || (s.got && s.gotBy && s.gotBy !== a); });
}
const otherActed = l => Object.keys(l.items || {}).some(i => otherActedItem(l, i)) || Object.values(l.items || {}).some(it => it.by && it.by !== l.createdBy);
function dirText(l) {
  const c = creatorCode(l);
  return l.dir === 'request' ? `Demande de ${nm(c)} à ${nm(l.giver)}` : `Envoi de ${nm(l.giver)} à ${nm(other(l.giver))}`;
}
/** Éléments affichés dans une étape */
function phaseItems(l, ph, me) {
  const all = Object.entries(l.items || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  if (ph === 'aller') return all.filter(([, it]) => it.src !== 'extraR');
  const own = me === ownerOf(l);
  return all.filter(([iid, it]) => it.src === 'extraR' || (own ? stOf(l, 'retour', iid).done : stOf(l, 'aller', iid).got));
}
/** Alertes de l'étape, avec les actions possibles selon mon rôle */
function alertsOf(l, ph, me) {
  const out = [], own = me === ownerOf(l), ph0 = l.phase || {};
  for (const [iid, it] of Object.entries(l.items || {})) {
    const a = stOf(l, 'aller', iid), r = stOf(l, 'retour', iid), A = (lab, act, cls = 'soft') => ({ lab, act, cls, iid });
    if (ph === 'aller') {
      if (it.src === 'req' && !a.done && !it.refused) out.push({ iid, i: '📝', t: `${nmU(it.by)} demande : ${it.name} ×${it.qty || 1} (${dd(it.at)})`, acts: own ? [A('📤 Envoyer', 'send', 'primary'), A('✗ Refuser', 'refuse', 'danger')] : [] });
      else if (it.src === 'extra' && !a.done && !it.disputed && !it.okA) out.push({ iid, i: '📥', t: `${nmU(it.by)} a reçu en plus (non déclaré) : ${it.name} ×${a.gotQty ?? it.qty} (${dd(it.at)})`, acts: own ? [A('✓ Oui, envoyé', 'confirm', 'ok'), A('✗ Non', 'dispute', 'danger')] : [] });
      else if (!it.src && it.late && !a.done && !it.refused) out.push({ iid, i: '➕', t: `Ajouté le ${dd(it.late)} : ${it.name} ×${it.qty || 1}`, acts: own ? [A('📤 Envoyer', 'send', 'primary')] : [] });
      else if (ph0.aller?.sentAt && !a.done && !it.refused && it.src !== 'extra' && !it.okA) out.push({ iid, i: '⚠️', t: `Non envoyé : ${it.name} ×${it.qty || 1}`, acts: own ? [A('📤 Envoyer', 'send', 'primary')] : [A('🔔 Relancer', 'ping'), A('✓ Accepter sans', 'okA')] });
      else if (ph0.aller?.gotAt && a.done && !it.okA && (!a.got || +(a.gotQty ?? sentQty(l, iid)) < +sentQty(l, iid))) out.push({ iid, i: '⚠️', t: a.got ? `Reçu en moins : ${it.name} (${a.gotQty} sur ${sentQty(l, iid)})` : a.at > ph0.aller.gotAt ? `Envoyé le ${dd(a.at)}, en attente de réception : ${it.name} ×${sentQty(l, iid)}` : `Non reçu : ${it.name} ×${sentQty(l, iid)}`, acts: own ? [A('🔔 Relancer', 'ping'), A('✓ Accepter l\'écart', 'okA')] : [A('📥 Reçu finalement', 'gotA', 'ok')] });
    } else {
      if (it.src === 'extraR' && !r.got && !it.disputed) out.push({ iid, i: '↩️', t: `${nmU(it.by)} rend en plus : ${it.name} ×${r.qty ?? it.qty} (${dd(it.at)})`, acts: own ? [A('✓ Reçu', 'gotR', 'ok'), A('✗ Pas reçu', 'dispute', 'danger')] : [] });
      else if (it.src !== 'extraR' && a.got && !r.done && ph0.retour?.sentAt && !it.okR) out.push({ iid, i: '⚠️', t: `Non rendu : ${it.name} ×${retQty(l, iid)}`, acts: own ? [A('🔔 Demander le retour', 'ping'), A('✓ Accepter', 'okR')] : [A('↩️ Rendre', 'retNow', 'primary')] });
      else if (r.done && !r.got && ph0.retour?.gotAt && !it.okR) out.push({ iid, i: '⚠️', t: `Rendu mais pas récupéré : ${it.name} ×${r.qty ?? retQty(l, iid)}`, acts: own ? [A('📥 Récupéré finalement', 'gotR', 'ok'), A('✓ Accepter', 'okR')] : [A('🔔 Relancer', 'ping')] });
      else if (r.got && !it.okR && +(r.gotQty ?? r.qty) < +(r.qty ?? retQty(l, iid))) out.push({ iid, i: '⚠️', t: `Récupéré en moins : ${it.name} (${r.gotQty} sur ${r.qty ?? retQty(l, iid)})`, acts: own ? [A('✓ Accepter l\'écart', 'okR'), A('🔔 Signaler', 'ping')] : [] });
    }
  }
  return out;
}
/** Transfert clos : retour confirmé par le propriétaire et plus aucune alerte */
const closed = l => !!l.phase?.retour?.gotAt && !alertsOf(l, 'retour', ownerOf(l)).length;
/** Toutes les étapes d'un élément (demande, envoi, réception, retour), datées sans l'heure */
function stepsOf(l, iid) {
  const it = l.items[iid], a = stOf(l, 'aller', iid), r = stOf(l, 'retour', iid), g = l.giver, rc = other(g), out = [];
  if (it.src === 'extra') out.push({ i: '📥', t: `Reçu en plus (non déclaré) ×${a.gotQty ?? it.qty} — indiqué par ${nmU(it.by)} le ${dd(it.at)}` });
  else if (it.src === 'extraR') out.push({ i: '↩️', t: `Rendu en plus ×${r.qty ?? it.qty} — indiqué par ${nmU(it.by)} le ${dd(it.at)}` });
  else if (it.src === 'req') out.push({ i: '📝', t: `Demandé à la réception ×${it.qty || 1} par ${nmU(it.by)} le ${dd(it.at)}` });
  else out.push({ i: '📝', t: `${l.dir === 'request' ? 'Demandé' : 'Prévu'} ×${it.qty || 1} par ${nmU(authorOf(l, it))} le ${dd(it.at || l.createdAt)}` });
  if (it.of) out.push({ i: '➕', t: `Complément de « ${l.items[it.of]?.name || ''} »` });
  if (it.late) out.push({ i: '📅', t: `Ajouté pendant la période le ${dd(it.late)}` });
  for (const h of it.hist || []) out.push({ i: '✏️', t: `${h.txt} (${dd(h.at)})` });
  if (it.refused) out.push({ i: '✗', t: `Refusé par ${nmU(it.refused.by)} le ${dd(it.refused.at)}`, w: 1 });
  if (it.disputed) out.push({ i: '✗', t: `Contesté par ${nmU(it.disputed.by)} le ${dd(it.disputed.at)}`, w: 1 });
  if (a.done) out.push({ i: '📤', t: `Envoyé ×${sentQty(l, iid)} par ${nm(g)} le ${dd(a.at)}${a.note ? ' — ' + a.note : ''}`, w: !it.src && +sentQty(l, iid) !== +(it.qty || 1) });
  if (a.got && it.src !== 'extra') out.push({ i: '📥', t: `Reçu ×${a.gotQty ?? sentQty(l, iid)} par ${nm(rc)} le ${dd(a.gotAt)}${a.lock ? ' 🔒' : ''}`, w: a.gotQty != null && +a.gotQty !== +sentQty(l, iid) });
  if (it.okA) out.push({ i: '✓', t: `Écart accepté par ${nmU(it.okA.by)} le ${dd(it.okA.at)}` });
  if (r.done && it.src !== 'extraR') out.push({ i: '↩️', t: `Rendu ×${r.qty ?? retQty(l, iid)} par ${nm(rc)} le ${dd(r.at)}` });
  if (r.got) out.push({ i: '✅', t: `Récupéré ×${r.gotQty ?? r.qty ?? retQty(l, iid)} par ${nm(g)} le ${dd(r.gotAt)}${r.lock ? ' 🔒' : ''}`, w: r.gotQty != null && +r.gotQty !== +(r.qty ?? retQty(l, iid)) });
  if (it.okR) out.push({ i: '✓', t: `Retour accepté par ${nmU(it.okR.by)} le ${dd(it.okR.at)}` });
  return out;
}
function listStats(l, ph) {
  const ids = Object.keys(l.items || {}), st = l.st?.[ph] || {};
  return { n: ids.length, done: ids.filter(id => st[id]?.done).length, got: ids.filter(id => st[id]?.got).length };
}
function vlistCard(l) {
  const a = listStats(l, 'aller'), r = listStats(l, 'retour'), nal = alertsOf(l, 'aller', myCode()).length + alertsOf(l, 'retour', myCode()).length, cl = closed(l);
  return `<button class="card vl" style="width:100%;text-align:left" data-go="sacl" data-params='${JSON.stringify({ id: l.id })}'>
    <div class="row gap"><div style="font-size:28px">${cl ? '🔒' : l.dir === 'request' ? '📥' : '📤'}</div><div class="f1"><div class="b">${esc(ltitle(l))}</div>
    <div class="small muted">${esc(dirText(l))} · ${a.n} élément${a.n > 1 ? 's' : ''}${l.childIds?.length ? ' · ' + esc(childNames(l.childIds)) : ''}</div>
    <div class="tiny muted mtx">➡️ Aller : ${a.done}/${a.n} envoyés · ${a.got}/${a.n} reçus &nbsp; ⬅️ Retour : ${r.done} rendus · ${r.got} récupérés</div>
    ${cl ? `<div class="tiny b mtx" style="color:var(--ok)">🔒 Transfert clos le ${dd(l.phase.retour.gotAt)}</div>` : nal ? `<div class="tiny b mtx" style="color:var(--err)">⚠️ ${nal} alerte${nal > 1 ? 's' : ''}</div>` : ''}</div><span class="lnk">›</span></div></button>`;
}
function vacTab(ids) {
  const ps = periods(); if (!ps.length) return { top: '', body: '<div class="card empty">Aucune période de vacances.</div>', bottom: '' };
  const pid = S.ui.sacPer && ps.some(p => p.id === S.ui.sacPer) ? S.ui.sacPer : ps.find(p => p.e >= today())?.id || ps[ps.length - 1].id;
  const per = ps.find(p => p.id === pid), eng = engine();
  const blocks = ids.length ? eng.blocks(ids[0], per.s, per.e).filter(b => b.key !== '.') : [];
  const ls = vlists().filter(l => l.period?.id === pid).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return {
    top: `<div class="chips scroll mtx">${ps.map(p => `<button class="chip sm ${p.id === pid ? 'on' : ''}" data-act="sac-per" data-id="${p.id}">${esc(pLabel(p))}</button>`).join('')}</div>`,
    body: `<div class="card"><div class="b">${per.i || '🏖️'} ${esc(vacName(per))} <span class="muted small">(${esc(per.n)})</span></div><div class="small muted">Du ${E.fmtDate(per.s)} au ${E.fmtDate(per.e)}</div>
      ${blocks.length ? `<div class="row wrap gap6 mtx">${blocks.map(b => `<span class="pill" style="background:${E.first(b.code) === 'A' ? 'var(--pa)' : 'var(--pb)'};color:#13233A">${esc(E.isHalf(b.code) ? '½ / ½' : nm(E.first(b.code)))} · ${E.fmtDate(b.start, 'short')}${b.end !== b.start ? '→' + E.fmtDate(b.end, 'short') : ''}</span>`).join('')}</div>` : ''}</div>
      ${ls.length ? ls.map(vlistCard).join('') : `<div class="card empty"><div class="e-i">🧳</div>Aucune liste pour ${esc(vacName(per))}.${isParent() && per.e >= today() ? '<br>Créez-la ici, ou depuis vos listes type (onglet 📋).' : ''}</div>`}`,
    bottom: isParent() && per.e >= today() ? `<button class="btn primary block" data-act="vl-new" data-p="${pid}">${IC.plus} Nouvelle liste pour ${esc(vacName(per))}</button>` : '',
  };
}
/** Listes type : privées (profil de la personne qui les crée), une par vacances, envoyables élément par élément */
function tplTab() {
  const v = VKEYS.includes(S.ui.tplVac) ? S.ui.tplVac : 'tou', t = tpl(v), items = tplItems(v), me = myCode() || 'A', o = other(me), dir = t.dir || 'request';
  const ps = vacPeriods(v), pid = ps.some(p => p.id === S.ui.tplPer) ? S.ui.tplPer : ps[0]?.id, per = ps.find(p => p.id === pid);
  const target = per ? vlists().find(l => l.period?.id === per.id && l.dir === dir && l.createdBy === uid() && l.tplVac === v) : null;
  const inL = new Set(Object.values(target?.items || {}).map(x => norm(x.name)));
  const todo = items.filter(([, it]) => !inL.has(norm(it.name)));
  const yl = p => `${VAC[v][1]} ${vacName(p)}`, locked = target && closed(target);
  return {
    top: `<div class="chips scroll mtx">${VKEYS.map(k => `<button class="chip sm ${k === v ? 'on' : ''}" data-act="tpl-vac" data-v="${k}">${VAC[k][1]} ${VAC[k][0]} <span class="muted">${tplItems(k).length || ''}</span></button>`).join('')}</div>`,
    body: `<div class="card"><h3>${VAC[v][1]} Liste type · ${VAC[v][0]} <a class="act" data-act="tpl-item" data-v="${v}">${IC.plus} Élément</a></h3>
        <div class="seg" style="margin:6px 0 10px"><button class="${dir === 'request' ? 'on' : ''}" data-act="tpl-dir" data-v="${v}" data-d="request">📥 Demande à ${esc(nm(o))}</button><button class="${dir === 'send' ? 'on' : ''}" data-act="tpl-dir" data-v="${v}" data-d="send">📤 Envoi à ${esc(nm(o))}</button></div>
        <div class="small b">Pour les vacances :</div>
        ${ps.length ? `<div class="chips scroll mtx">${ps.map(p => `<button class="chip sm ${p.id === pid ? 'on' : ''}" data-act="tpl-per" data-id="${p.id}">${esc(yl(p))}</button>`).join('')}</div>` : '<div class="small muted">Aucune période à venir pour ces vacances.</div>'}
        ${per ? `<div class="small muted mtx">${target ? `Liste « ${esc(ltitle(target))} » : ${Object.keys(target.items || {}).length} élément(s)${started(target) ? ' · période commencée (les ajouts seront datés)' : ''}. <a class="lnk" data-go="sacl" data-params='${JSON.stringify({ id: target.id })}'>Ouvrir ›</a>` : `La liste « ${esc(VAC[v][2])} ${yy(per)} » sera créée automatiquement au premier envoi.`}</div>` : ''}
        <div class="hint">🔒 Visible uniquement par vous. ${dir === 'request' ? `${esc(nm(o))} devra fournir les éléments demandés.` : `Vous fournissez les éléments, ${esc(nm(o))} confirme la réception.`}</div></div>
      ${items.length ? `<div class="card tight">${items.map(([iid, it]) => { const has = inL.has(norm(it.name)); return `<div class="li"><button class="f1" style="text-align:left" data-act="tpl-item" data-v="${v}" data-i="${iid}"><div class="lt">${esc(it.name)} <span class="muted">×${it.qty || 1}</span></div>${it.desc ? `<div class="ls">${esc(it.desc)}</div>` : ''}</button>
          ${per && !locked ? (has ? `<span class="pill ok">✓ ${dir === 'request' ? 'demandé' : 'envoyé'}</span>` : `<button class="btn soft sm" data-act="tpl-send" data-v="${v}" data-i="${iid}">${dir === 'request' ? '📥 Demander' : '📤 Envoyer'}</button>`) : ''}</div>`; }).join('')}</div>`
        : `<div class="card empty"><div class="e-i">📋</div>Liste type vide.<br>Ajoutez vos affaires habituelles pour les vacances de ${esc(VAC[v][0])}.</div>`}`,
    bottom: per && todo.length && !locked ? `<button class="btn primary block" data-act="tpl-send" data-v="${v}" data-all="1">${dir === 'request' ? '📥 Demander' : '📤 Envoyer'} les ${todo.length} élément${todo.length > 1 ? 's' : ''} · ${esc(yl(per))}</button>` : '',
  };
}
const photoBtns = (l, iid) => `<label class="vp add" title="Prendre une photo">📷<input type="file" accept="image/*" capture="environment" class="hide" data-vlph="1" data-id="${l.id}" data-i="${iid}"></label>
  <label class="vp add" title="Galerie ou fichiers">🖼️<input type="file" accept="image/*" multiple class="hide" data-vlph="1" data-id="${l.id}" data-i="${iid}"></label>`;
function vlistItem(l, iid, it, ph, me, cl) {
  const st = stOf(l, ph, iid), { giver, receiver } = phaseInfo(l, ph), photos = it.photos || [], lock = !!st.lock || cl;
  const isG = me === giver, isR = me === receiver, au = authorOf(l, it) === uid();
  let act = '';
  if (cl || it.refused || it.disputed) act = '';
  else if (st.lock) act = `<div class="small b" style="color:var(--ok)">🔒 Validé : plus modifiable</div>`;
  else if (ph === 'aller') {
    const q = sentQty(l, iid), gq = st.gotQty ?? q;
    if (isG && it.src !== 'extra') act += `<div class="vrow"><span class="vlab">Nombre envoyé</span><input class="in sm" type="number" min="0" inputmode="numeric" value="${q}" ${st.got ? 'disabled' : ''} data-change="vl-qty" data-id="${l.id}" data-i="${iid}" data-ph="${ph}">
        ${vbox(st.done, 'Envoyé', `data-act="vl-done" data-id="${l.id}" data-i="${iid}" data-ph="${ph}"`, st.got)}</div>
      <input class="in sm" ${st.got ? 'disabled' : ''} placeholder="Ce que je mets exactement (taille, couleur, marque…)" value="${esc(st.note || '')}" data-change="vl-note" data-id="${l.id}" data-i="${iid}" data-ph="${ph}">`;
    if (isR) act += `<div class="vrow"><span class="vlab">Nombre reçu</span><input class="in sm" type="number" min="0" inputmode="numeric" value="${gq}" data-change="vl-gotqty" data-id="${l.id}" data-i="${iid}" data-ph="${ph}">
        ${vbox(st.got, 'Reçu', `data-act="vl-got" data-id="${l.id}" data-i="${iid}" data-ph="${ph}"`)}</div>`;
  } else {
    const q = it.src === 'extraR' ? (st.qty ?? it.qty) : retQty(l, iid), gq = st.gotQty ?? st.qty ?? q;
    if (isG && it.src !== 'extraR') act += `<div class="vrow"><span class="vlab">À rendre <b>×${q}</b> <span class="tiny muted">(reçu à l'aller, non modifiable)</span></span>
        ${vbox(st.done, 'Rendu', `data-act="vl-done" data-id="${l.id}" data-i="${iid}" data-ph="${ph}"`, st.got)}</div>`;
    if (isR) act += `<div class="vrow"><span class="vlab">Rendu ×${st.qty ?? q} · récupéré</span><input class="in sm" type="number" min="0" inputmode="numeric" value="${gq}" data-change="vl-gotqty" data-id="${l.id}" data-i="${iid}" data-ph="${ph}">
        ${vbox(st.got, 'Récupéré', `data-act="vl-got" data-id="${l.id}" data-i="${iid}" data-ph="${ph}"`)}</div>`;
  }
  const canEdit = au && !cl && !S.ui.sacSelOn && !it.refused;
  return `<div class="vi ${st.done ? 'done' : ''} ${st.got ? 'got' : ''}" id="vi-${iid}">
    <div class="row gap">${au && !cl ? selBox(iid) : ''}<div class="f1" style="min-width:0"><div class="b">${esc(it.name)} <span class="pill">${it.src === 'extra' ? 'reçu en plus' : it.src === 'extraR' ? 'rendu en plus' : it.src === 'req' ? 'demandé' : l.dir === 'request' ? 'demandé' : 'prévu'} ×${it.qty || 1}</span>${it.late ? ` <span class="pill warn">📅 ${dd(it.late)}</span>` : ''}</div>${it.desc ? `<div class="small muted">${esc(it.desc)}</div>` : ''}</div>
      ${canEdit ? `<button class="ib" data-act="vl-item" data-id="${l.id}" data-i="${iid}" title="${fullEdit(l, iid) ? 'Modifier' : 'Ajouter une quantité'}">${fullEdit(l, iid) ? IC.edit : '➕'}</button>` : ''}</div>
    <div class="steps-l">${stepsOf(l, iid).map(s => `<div class="tiny ${s.w ? 'b' : 'muted'}" ${s.w ? 'style="color:var(--err)"' : ''}>${s.i} ${esc(s.t)}${s.w ? ' ⚠️' : ''}</div>`).join('')}</div>
    <div class="vph">${photos.map(p => { const on = !!st.ph?.[p.id]; return `<div class="vp ${on ? 'on' : ''}"><button class="vp-i" ${lock ? 'disabled' : ''} data-act="vl-ph" data-id="${l.id}" data-i="${iid}" data-p="${p.id}" data-ph="${ph}" title="Cocher cette photo"><img src="${p.thumb}" alt=""><span>${on ? '✓' : ''}</span></button>
      <button class="vp-z" data-act="vl-zoom" data-b="${p.blobId || ''}" data-t="${p.thumb}">🔍</button></div>`; }).join('')}
      ${isParent() && !cl ? photoBtns(l, iid) : ''}</div>
    ${act}</div>`;
}
/** Modification complète (nom, quantité à la baisse, suppression) : par l'auteur, avant la période et avant toute action de l'autre parent */
function fullEdit(l, iid) { const it = l.items?.[iid]; return !!it && authorOf(l, it) === uid() && !closed(l) && !started(l) && !otherActedItem(l, iid); }
const canDelList = l => isCreator(l) && !otherActed(l) && !closed(l) && !l.phase?.aller?.sentAt;
const page = (top, body, bottom) => `<div class="stick">${top}</div>${body}${bottom ? `<div class="stick-b">${bottom}</div>` : ''}`;

export const views = {
  sac(p) {
    const ids = selIds();
    if (!can('sac')) return { title: 'Sac du relais', back: 'home', html: '<div class="card empty">Rubrique réservée aux parents.</div>' };
    let tab = p.tab || S.ui.sacTab || 'relais'; if (tab === 'liste' && !isParent()) tab = 'relais'; S.ui.sacTab = tab;
    if (S.ui.sacSelTab !== tab) { S.ui.sacSelOn = false; sel().clear(); S.ui.sacSelTab = tab; }
    const seg = `${kidChips()}<div class="seg mtx" style="margin-bottom:0"><button class="${tab === 'relais' ? 'on' : ''}" data-act="sac-tab" data-t="relais">🔁 Relais</button><button class="${tab === 'vac' ? 'on' : ''}" data-act="sac-tab" data-t="vac">🏖️ Vacances</button>${isParent() ? `<button class="${tab === 'liste' ? 'on' : ''}" data-act="sac-tab" data-t="liste">📋 Listes type</button>` : ''}</div>`;
    const back = isParent() ? null : 'home';
    if (tab === 'vac') { const x = vacTab(ids); return { title: 'Sac', back, html: page(seg + x.top, x.body, x.bottom) }; }
    if (tab === 'liste') { const x = tplTab(); return { title: 'Sac', back, html: page(seg + x.top, x.body, x.bottom) }; }
    const { last, next } = relaisList(ids);
    const opts = [...(last ? [last] : []), ...next];
    const recent = last && Date.now() - new Date(...last.date.split('-').map((x, k) => (k === 1 ? x - 1 : +x))).getTime() < 2 * 86400000;
    const pick = opts.find(h => runKey(h) === S.ui.sacKey) || (recent && itemsFor(last).some(i => !runOf(last).got?.[i.id]) ? last : next[0] || last);
    const nPerm = relaisItems().filter(i => i.perm).length;
    const permBtn = `<button class="btn ghost block mb" data-go="sacperm">📋 Affaires de chaque relais (${nPerm})</button>`;
    if (!pick) return { title: 'Sac', back, html: page(seg, `<div class="card empty"><div class="e-i">🔁</div>Aucun relais prévu pour le moment.</div>${permBtn}`, '') };
    const run = runOf(pick), items = itemsFor(pick), me = myCode();
    const nP = items.filter(i => run.packed?.[i.id]).length, nG = items.filter(i => run.got?.[i.id]).length, past = pick === last;
    S.ui.sacPick = pick;
    const top = opts.length > 1 ? `<div class="chips scroll mtx">${opts.map(h => `<button class="chip sm ${h === pick ? 'on' : ''}" data-act="sac-pick" data-k="${runKey(h)}">${h === last ? '⏮ ' : ''}${esc(E.relDay(h.date))} ${E.fmtTime(h.time)}</button>`).join('')}</div>` : '';
    const body = `<div class="card"><div class="row gap"><div style="font-size:30px">🔁</div><div class="f1"><div class="b">Relais ${esc(E.relDay(pick.date))} à ${E.fmtTime(pick.time)}</div>
        <div class="small muted">${esc(nm(pick.from))} → ${esc(nm(pick.to))} · ${esc(childNames(pick.childIds))}${pick.place ? ' · 📍 ' + esc(pick.place) : ''}</div>
        ${past ? '<div class="small b" style="color:var(--coral)">Relais passé : confirmez la réception</div>' : `<div class="count mtx">⏱ ${countdown(pick.date, pick.time)}</div>`}</div></div>
        <div class="row gap mt"><div class="f1"><div class="tiny b">🎒 DANS LE SAC</div><div class="bar"><span style="width:${items.length ? nP / items.length * 100 : 0}%;background:var(--navy2)"></span></div><div class="tiny muted">${nP}/${items.length} · ${esc(nm(pick.from))}</div></div>
          <div class="f1"><div class="tiny b">📥 REÇU</div><div class="bar"><span style="width:${items.length ? nG / items.length * 100 : 0}%;background:var(--ok)"></span></div><div class="tiny muted">${nG}/${items.length} · ${esc(nm(pick.to))}</div></div></div>
        ${run.readyAt ? `<div class="tiny muted mt">✅ Sac prêt (${esc(run.readyByName || '')}, ${fmtAgo(run.readyAt)})</div>` : ''}${run.doneAt ? `<div class="tiny muted">📥 Tout reçu (${esc(run.doneByName || '')}, ${fmtAgo(run.doneAt)})</div>` : ''}</div>
      ${items.length ? `<div class="row gap mb">${selBar(items.map(i => i.id), 'sac-out-sel', 'Retirer')}</div><div class="card tight">${items.map(i => itemRow(i, run, pick)).join('')}</div>` : '<div class="card empty"><div class="e-i">🎒</div>Rien dans le sac pour ce relais. Ajoutez des affaires.</div>'}
      ${Object.keys(run.excluded || {}).some(k => run.excluded[k]) ? `<button class="btn ghost sm block mb" data-act="sac-restore" data-k="${runKey(pick)}">↩️ Remettre les affaires retirées de ce relais</button>` : ''}
      <button class="btn soft block mb" data-act="sac-new" data-k="${runKey(pick)}">${IC.camera} Ajouter une affaire (photo + description)</button>${permBtn}`;
    const giverMe = me === pick.from || !me, recvMe = me === pick.to || !me;
    const bottom = `<div class="row gap">${items.length ? `<button class="btn soft" data-act="sac-all" data-k="${runKey(pick)}">☑️ Tout valider</button>` : ''}${giverMe ? `<button class="btn primary f1" data-act="sac-ready" data-k="${runKey(pick)}">✅ Sac prêt</button>` : ''}
        ${recvMe ? `<button class="btn ok f1" data-act="sac-done" data-k="${runKey(pick)}">📥 Tout est arrivé</button><button class="btn danger" data-act="sac-miss" data-k="${runKey(pick)}" title="Signaler un oubli">⚠️</button>` : ''}</div>`;
    return { title: 'Sac', back, html: page(seg + top, body, bottom) };
  },
  /** Affaires proposées à chaque relais (liste partagée par les deux parents) */
  sacperm() {
    const ids = selIds(), perm = relaisItems().filter(i => i.perm && (!i.childIds?.length || i.childIds.some(id => ids.includes(id))));
    if (S.ui.sacSelTab !== 'perm') { S.ui.sacSelOn = false; sel().clear(); S.ui.sacSelTab = 'perm'; }
    return {
      title: 'Chaque relais', back: 'sac',
      html: page(kidChips(), `<div class="card"><h3>📋 Affaires de chaque relais</h3><p class="small muted" style="margin-top:0">Proposées automatiquement à chaque relais, pour les deux parents.</p>
        ${perm.length ? `<div class="row gap mb">${selBar(perm.map(i => i.id), 'sac-del-sel', 'Supprimer')}</div>` : ''}
        ${perm.length ? perm.map(i => `<div class="li">${selBox(i.id)}<button class="row gap f1" style="text-align:left" data-act="sac-item" data-id="${i.id}"><span class="sac-ph sm">${i.photo ? `<img src="${i.photo}" alt="">` : '<span>🎒</span>'}</span><div class="f1"><div class="lt">${esc(i.name)}</div><div class="ls">${esc(i.desc || '')}${i.childIds?.length ? ' · ' + esc(childNames(i.childIds)) : ''}</div></div><span class="lnk">›</span></button></div>`).join('') : '<div class="empty"><div class="e-i">🎒</div>Ajoutez cartable, doudou, médicaments, tenue de sport…</div>'}</div>`,
      `<button class="btn primary block" data-act="sac-new" data-perm="1">${IC.plus} Ajouter une affaire</button>`),
    };
  },
  /** Une liste des vacances : aller (début) / retour (fin), toutes les étapes de chaque élément, alertes */
  sacl(p) {
    const l = S.sac.find(x => x.id === p.id);
    if (!l) return { title: 'Liste', back: 'sac', html: '<div class="card empty">Liste introuvable (supprimée ?).</div>' };
    const ph = p.ph === 'retour' || p.ph === 'aller' ? p.ph : l.phase?.aller?.gotAt ? 'retour' : 'aller', me = myCode(), cr = isCreator(l), cl = closed(l);
    if (S.ui.sacSelTab !== 'l' + l.id + ph) { S.ui.sacSelOn = false; sel().clear(); S.ui.sacSelTab = 'l' + l.id + ph; }
    const { giver, receiver } = phaseInfo(l, ph), phs = l.phase?.[ph] || {}, own = me === ownerOf(l);
    const items = phaseItems(l, ph, me), alerts = alertsOf(l, ph, me);
    const nG = items.filter(([i]) => stOf(l, ph, i).done).length, nR = items.filter(([i]) => stOf(l, ph, i).got).length;
    const waitR = ph === 'retour' && own && !phs.sentAt ? Object.keys(l.items || {}).filter(i => stOf(l, 'aller', i).got && !stOf(l, 'retour', i).done).length : 0;
    const top = `<div class="seg" style="margin-bottom:0"><button class="${ph === 'aller' ? 'on' : ''}" data-go="sacl" data-params='${JSON.stringify({ id: l.id, ph: 'aller' })}'>➡️ Aller · ${esc(nm(l.giver))} → ${esc(nm(other(l.giver)))}</button>
      <button class="${ph === 'retour' ? 'on' : ''}" data-go="sacl" data-params='${JSON.stringify({ id: l.id, ph: 'retour' })}'>⬅️ Retour · ${esc(nm(other(l.giver)))} → ${esc(nm(l.giver))}</button></div>`;
    const adds = cl || !me ? '' : ph === 'aller'
      ? `${me === receiver ? `<button class="btn soft f1" data-act="vl-add" data-id="${l.id}" data-m="${cr ? 'add' : 'req'}">📝 Demander un élément</button><button class="btn soft f1" data-act="vl-add" data-id="${l.id}" data-m="extra">📥 Reçu en plus (non déclaré)</button>` : ''}${me === giver && cr ? `<button class="btn soft f1" data-act="vl-add" data-id="${l.id}" data-m="add">${IC.plus} Ajouter un élément</button>` : ''}`
      : (me === giver ? `<button class="btn soft f1" data-act="vl-add" data-id="${l.id}" data-m="extraR">↩️ Rendu en plus (non listé)</button>` : '');
    const body = `<div class="card"><div class="row gap"><div style="font-size:30px">${cl ? '🔒' : l.dir === 'request' ? '📥' : '📤'}</div><div class="f1"><div class="b">${esc(ltitle(l))}</div>
        <div class="small muted">${esc(dirText(l))}${l.childIds?.length ? ' · ' + esc(childNames(l.childIds)) : ''}</div>
        ${l.period ? `<div class="tiny muted">${esc(vacName(l.period))} : du ${E.fmtDate(l.period.s)} au ${E.fmtDate(l.period.e)}</div>` : ''}
        ${cl ? `<div class="tiny b mtx" style="color:var(--ok)">🔒 Transfert clos le ${dd(l.phase.retour.gotAt)} : liste en lecture seule.</div>` : cr ? '' : `<div class="tiny b mtx">🔒 Liste créée par ${esc(nm(creatorCode(l)))} : seule cette personne peut la modifier ou la supprimer.</div>`}</div></div></div>
      <div class="card tight"><div class="row gap"><div class="f1"><div class="tiny b">${ph === 'aller' ? '📤 ENVOYÉ' : '↩️ RENDU'} PAR ${esc(nm(giver).toUpperCase())}</div><div class="bar"><span style="width:${items.length ? nG / items.length * 100 : 0}%;background:var(--navy2)"></span></div><div class="tiny muted">${nG}/${items.length}</div></div>
        <div class="f1"><div class="tiny b">${ph === 'aller' ? '📥 REÇU' : '✅ RÉCUPÉRÉ'} PAR ${esc(nm(receiver).toUpperCase())}</div><div class="bar"><span style="width:${items.length ? nR / items.length * 100 : 0}%;background:var(--ok)"></span></div><div class="tiny muted">${nR}/${items.length}</div></div></div>
        ${phs.sentAt ? `<div class="tiny muted mtx">✅ ${ph === 'aller' ? 'Préparé' : 'Rendu'} par ${esc(nm(giver))} le ${dd(phs.sentAt)}</div>` : ''}${phs.gotAt ? `<div class="tiny muted">📥 Réception confirmée par ${esc(nm(receiver))} le ${dd(phs.gotAt)} 🔒</div>` : ''}</div>
      ${alerts.length ? `<button class="alert-jump" data-act="vl-jump">⚠️ ${alerts.length} alerte${alerts.length > 1 ? 's' : ''} : voir en bas ↓</button>` : ''}
      ${cl ? '' : `<div class="hint mb">${ph === 'aller' ? `${esc(nm(giver))} coche « Envoyé » avec le nombre exact ; ${esc(nm(receiver))} coche « Reçu ». À la confirmation de réception, les éléments reçus sont figés.` : `${esc(nm(giver))} coche « Rendu » (quantité reçue à l'aller) ; ${esc(nm(receiver))} coche « Récupéré » et peut corriger le nombre. La confirmation fige tout.`}</div>`}
      ${waitR ? `<div class="alert info"><div class="ai">⏳</div><div class="f1 small">En attente du retour de ${esc(nm(giver))} : ${waitR} élément${waitR > 1 ? 's' : ''} reçu${waitR > 1 ? 's' : ''} à l'aller. Ils apparaissent ici dès qu'ils sont rendus.</div></div>` : ''}
      ${items.length ? `${cr && !cl && items.some(([i]) => fullEdit(l, i)) ? `<div class="row gap mb">${selBar(items.filter(([i]) => fullEdit(l, i)).map(([id]) => id), 'vl-del-sel', 'Supprimer')}</div>` : ''}${items.map(([iid, it]) => vlistItem(l, iid, it, ph, me, cl)).join('')}` : `<div class="card empty"><div class="e-i">🧳</div>${ph === 'retour' ? 'Rien à afficher pour le retour pour le moment.' : 'Liste vide.'}</div>`}
      ${adds ? `<div class="row gap wrap mb mt">${adds}</div>` : ''}
      ${alerts.length ? `<div class="card alertbox" id="vl-alerts"><h3>⚠️ Alertes · ${ph}</h3>${alerts.map(a => `<div class="al-it"><div class="small"><b>${a.i}</b> ${esc(a.t)}</div>${a.acts.length && !cl ? `<div class="row gap6 wrap mtx">${a.acts.map(x => `<button class="btn ${x.cls} sm" data-act="vl-al" data-id="${l.id}" data-i="${x.iid}" data-a="${x.act}" data-ph="${ph}">${x.lab}</button>`).join('')}</div>` : `<div class="tiny muted">En attente de ${esc(nm(ownerOf(l)))}.</div>`}</div>`).join('')}</div>` : ''}
      ${canDelList(l) ? `<button class="btn ghost block mb" style="color:var(--err)" data-act="vl-del" data-id="${l.id}">${IC.trash} Supprimer la liste</button>` : ''}`;
    const canAll = !cl && (me === giver || me === receiver) && items.some(([i, it]) => !stOf(l, ph, i).lock && !it.refused && !it.disputed && (me === giver ? !stOf(l, ph, i).done && !(ph === 'aller' && it.src === 'extra') && it.src !== 'extraR' : !stOf(l, ph, i).got));
    const bottom = cl ? `<button class="btn soft block" data-act="vl-export" data-id="${l.id}">📄 Exporter (JPG / PDF)</button>`
      : `<div class="row gap">${canAll ? `<button class="btn soft f1" data-act="vl-all" data-id="${l.id}" data-ph="${ph}">☑️ Tout valider</button>` : ''}<button class="btn soft ${canAll ? '' : 'f1'}" data-act="vl-export" data-id="${l.id}" title="Exporter en JPG ou PDF">📄 Exporter</button></div>
        ${me === giver ? `<button class="btn primary block mtx" data-act="vl-sent" data-id="${l.id}" data-ph="${ph}">✅ ${ph === 'aller' ? "J'ai tout préparé" : "J'ai tout rendu"}</button>` : ''}${me === receiver ? `<button class="btn ok block mtx" data-act="vl-recv" data-id="${l.id}" data-ph="${ph}">📥 Réception confirmée</button>` : ''}`;
    return { title: ltitle(l), back: 'sac', html: page(top, body, bottom) };
  },
};
async function uploadPhotos(files) {
  const db = S.be.db, out = [];
  for (const f of [...files].slice(0, 20)) {
    const full = await compressImage(f, 1280, 0.72), thumb = await compressImage(f, 220, 0.6);
    const bid = db.newId(); await db.set(fpath('blobs', bid), { data: full, mime: 'image/jpeg', name: 'photo.jpg', kind: 'sac', at: Date.now(), by: uid() });
    out.push({ id: nid(), thumb, blobId: bid, by: uid() });
  }
  return out;
}
export const after = {
  sacl(v) {
    v.querySelectorAll('[data-vlph]').forEach(inp => inp.addEventListener('change', async () => {
      const files = [...inp.files]; if (!files.length) return;
      toast(`Ajout de ${files.length} photo${files.length > 1 ? 's' : ''}…`, 'ok', 1500);
      await guard(async () => {
        const add = await uploadPhotos(files);
        await S.be.db.update(fpath('sac', inp.dataset.id), { [`items.${inp.dataset.i}.photos`]: S.be.db.arrayUnion(...add), updatedAt: Date.now() });
      }, 'Photos ajoutées');
    }));
  },
};

function itemSheet(i = null, o = {}) {
  const x = i || { childIds: selIds(), perm: !!o.perm, qty: 1 };
  const sh = openSheet(`<h3 class="sh-title">${i ? '✏️ Affaire' : '🎒 Nouvelle affaire'}</h3>
    <div class="row gap"><span class="sac-ph lg" data-part="ph">${x.photo ? `<img src="${x.photo}" alt="">` : '<span>🎒</span>'}</span><div class="f1 row gap wrap">
      <label class="btn soft sm">📷 Photo<input type="file" accept="image/*" capture="environment" class="hide" data-ph="1"></label><label class="btn soft sm">🖼️ Galerie / fichiers<input type="file" accept="image/*" class="hide" data-ph="1"></label>
      ${x.photo ? '<button type="button" class="btn soft sm" data-act="sac-ph-del">Retirer</button>' : ''}</div></div>
    <label class="lbl">Nom</label><input class="in" name="name" value="${esc(x.name || '')}" placeholder="Ex. Doudou lapin, cartable, Ventoline">
    <label class="lbl">Description</label><textarea class="in" name="desc" rows="3" placeholder="Couleur, taille, posologie, où il est rangé…">${esc(x.desc || '')}</textarea>
    <div class="two"><div><label class="lbl">Quantité</label><input class="in" type="number" min="1" name="qty" value="${x.qty || 1}"></div><div></div></div>
    <label class="lbl">Enfants</label>${chips('childIds', S.children.map(c => ({ v: c.id, l: `${kidAvatar(c, 20)} ${esc(c.prenom)}` })), x.childIds || [], { multi: true })}
    <label class="row gap mt"><span class="sw"><input type="checkbox" name="perm" ${x.perm ? 'checked' : ''}><span></span></span><span class="f1">À chaque relais</span></label>
    ${i && o.relais && i.perm ? '<div class="hint">Cette affaire est proposée à chaque relais : la retirer de ce relais ne la supprime ni des autres relais, ni des listes des vacances.</div>' : ''}
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
function listSheet(pid = null) {
  const me = myCode() || 'A', ps = periods().filter(p => p.e >= today()), others = vlists();
  openSheet(`<h3 class="sh-title">🧳 Nouvelle liste des vacances</h3>
    <label class="lbl">Titre</label><input class="in" name="title" value="Vêtements" placeholder="Vêtements, affaires de toilette, médicaments…">
    <label class="lbl">Vacances</label>${chips('per', ps.map(x => ({ v: x.id, l: esc(pLabel(x)) })), [pid || ps[0]?.id])}
    <label class="lbl">Demande ou envoi ?</label>${chips('dir', [{ v: 'request', l: `📥 Demande à ${esc(nm(other(me)))}` }, { v: 'send', l: `📤 Envoi à ${esc(nm(other(me)))}` }], ['request'])}
    <div class="hint">Demande : ${esc(nm(other(me)))} fournit les éléments. Envoi : vous les fournissez. Vous seul(e) pourrez modifier ou supprimer cette liste.</div>
    <label class="lbl">Enfants</label>${chips('childIds', S.children.map(c => ({ v: c.id, l: `${kidAvatar(c, 20)} ${esc(c.prenom)}` })), selIds(), { multi: true })}
    ${others.length ? `<label class="lbl">Partir d'une liste existante (facultatif)</label><select class="in" name="from"><option value="">— Liste vide —</option>${others.map(x => `<option value="${x.id}">${esc(ltitle(x))}</option>`).join('')}</select>` : ''}
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="vl-save">Créer la liste</button></div>`);
}
const ADD_T = { add: '➕ Nouvel élément', req: '📝 Demander un élément', extra: '📥 Reçu en plus (non déclaré)', extraR: '↩️ Rendu en plus (non listé)' };
/** Ajout d'un élément : par l'auteur de la liste (add), demande à la réception (req), reçu non déclaré (extra), rendu en plus (extraR) */
function addSheet(l, mode) {
  const dated = mode !== 'add' || datedAdd(l);
  openSheet(`<h3 class="sh-title">${ADD_T[mode]}</h3>
    ${dated ? `<div class="alert info"><div class="ai">📅</div><div class="small">L'élément sera daté du ${dd(Date.now())} et ${esc(nm(other(myCode() || 'A')))} sera prévenu(e).</div></div>` : ''}
    <label class="lbl">Nom</label><input class="in" name="name" placeholder="Ex. T-shirts manches courtes">
    <div class="two"><div><label class="lbl">${mode === 'extra' ? 'Nombre reçu' : mode === 'extraR' ? 'Nombre rendu' : 'Nombre'}</label><input class="in" type="number" min="1" name="qty" value="1"></div><div></div></div>
    <label class="lbl">Précisions</label><textarea class="in" name="desc" rows="2" placeholder="Taille, couleur, marque…"></textarea>
    <label class="lbl">Photos</label><div class="row gap"><label class="btn soft f1">📷 Photo<input type="file" accept="image/*" capture="environment" class="hide" data-vi="1"></label><label class="btn soft f1">🖼️ Galerie / fichiers<input type="file" accept="image/*" multiple class="hide" data-vi="1"></label></div><div class="hint" data-part="n"></div>
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="vl-add-save" data-id="${l.id}" data-m="${mode}">Enregistrer</button></div>`,
  { onMount: sh => sh.querySelectorAll('[data-vi]').forEach(i => i.addEventListener('change', () => { const n = [...sh.querySelectorAll('[data-vi]')].reduce((s, x) => s + x.files.length, 0); sh.querySelector('[data-part="n"]').textContent = `${n} photo(s) sélectionnée(s)`; })) });
}
/** Modification : complète avant la période et avant toute action de l'autre parent ; sinon, uniquement ajouter une quantité */
function editSheet(l, iid) {
  const it = l.items[iid], full = fullEdit(l, iid);
  openSheet(full ? `<h3 class="sh-title">✏️ ${esc(it.name)}</h3>
    <label class="lbl">Nom</label><input class="in" name="name" value="${esc(it.name || '')}">
    <div class="two"><div><label class="lbl">${l.dir === 'request' ? 'Nombre demandé' : 'Nombre prévu'}</label><input class="in" type="number" min="1" name="qty" value="${it.qty || 1}"></div><div></div></div>
    <label class="lbl">Précisions</label><textarea class="in" name="desc" rows="2">${esc(it.desc || '')}</textarea>
    <div class="hint">Chaque modification est datée et l'autre parent est prévenu.</div>
    <div class="sh-actions"><button class="btn danger" data-act="vl-item-del" data-id="${l.id}" data-i="${iid}">${IC.trash}</button><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="vl-item-save" data-id="${l.id}" data-i="${iid}">Enregistrer</button></div>`
    : `<h3 class="sh-title">➕ ${esc(it.name)} (×${it.qty || 1})</h3>
    <p class="small muted">La période est commencée ou l'autre parent a déjà agi : vous pouvez seulement <b>ajouter une quantité</b> (sans modifier l'élément, le supprimer ni réduire le nombre). L'ajout est daté et l'autre parent est prévenu.</p>
    <label class="lbl">Quantité à ajouter</label><input class="in" type="number" min="1" name="plus" value="1">
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="vl-item-plus" data-id="${l.id}" data-i="${iid}">Ajouter</button></div>`);
}
function tplSheet(v, iid = null) {
  const it = iid ? tpl(v).items?.[iid] || {} : {};
  openSheet(`<h3 class="sh-title">${VAC[v][1]} ${iid ? 'Élément de la liste type' : 'Nouvel élément'} · ${VAC[v][0]}</h3>
    <label class="lbl">Nom</label><input class="in" name="name" value="${esc(it.name || '')}" placeholder="Ex. Tee-shirts">
    <div class="two"><div><label class="lbl">Nombre</label><input class="in" type="number" min="1" name="qty" value="${it.qty || 1}"></div><div></div></div>
    <label class="lbl">Précisions</label><textarea class="in" name="desc" rows="2">${esc(it.desc || '')}</textarea>
    <div class="hint">🔒 Votre liste type n'est visible que par vous.</div>
    <div class="sh-actions">${iid ? `<button class="btn danger" data-act="tpl-item-del" data-v="${v}" data-i="${iid}">${IC.trash}</button>` : ''}<button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="tpl-item-save" data-v="${v}" data-i="${iid || ''}">Enregistrer</button></div>`);
}
const L = id => S.sac.find(x => x.id === id);
async function vupd(id, data) { await S.be.db.update(fpath('sac', id), { ...data, updatedAt: Date.now() }); }
const lk = (l, ph) => `sacl?id=${l.id}${ph ? '&ph=' + ph : ''}`;
const slog = (l, title, o = {}) => log('sac', title, { link: lk(l, o.ph), icon: o.icon || '🧳', body: o.body || '' });
/** Peut agir sur l'étape ph de l'élément (rôle + élément non figé + liste ouverte) */
function canAct(l, iid, ph, role) { const r = phaseInfo(l, ph); return myCode() === r[role] && !stOf(l, ph, iid).lock && !closed(l); }
/** Envoi depuis une liste type vers la liste des vacances du même nom (créée automatiquement) */
async function sendFromTpl(v, iids) {
  const t = tpl(v), dir = t.dir || 'request', me = myCode() || 'A';
  const ps = vacPeriods(v), per = ps.find(p => p.id === S.ui.tplPer) || ps[0]; if (!per) return 0;
  const db = S.be.db;
  let l = vlists().find(x => x.period?.id === per.id && x.dir === dir && x.createdBy === uid() && x.tplVac === v);
  if (l && closed(l)) return 0;
  if (!l) {
    const id = db.newId();
    l = { id, kind: 'vlist', v: 2, tplVac: v, title: VAC[v][2], period: { id: per.id, n: per.n, i: per.i || VAC[v][1], s: per.s, e: per.e }, dir, ownerCode: me, giver: dir === 'request' ? other(me) : me, childIds: S.children.map(c => c.id), items: {}, st: { aller: {}, retour: {} }, phase: {}, createdAt: Date.now(), createdBy: uid(), createdByName: myName() };
    const { id: _x, ...data } = l; await db.set(fpath('sac', id), data);
  }
  const have = new Set(Object.values(l.items || {}).map(x => norm(x.name))), late = datedAdd(l) ? today() : null;
  let order = Object.keys(l.items || {}).length; const upd = {}, names = [];
  for (const iid of iids) {
    const it = t.items?.[iid]; if (!it || have.has(norm(it.name))) continue;
    upd[`items.${nid()}`] = { name: it.name, qty: Math.max(1, +it.qty || 1), desc: it.desc || '', order: order++, photos: [], at: Date.now(), by: uid(), ...(late ? { late } : {}) };
    names.push(`${it.name} ×${it.qty || 1}`); have.add(norm(it.name));
  }
  if (!names.length) return 0;
  await vupd(l.id, upd);
  const o = other(me);
  await slog(l, `${dir === 'request' ? '📥' : '📤'} ${ltitle(l)} : ${dir === 'request' ? `${myName()} demande à ${nm(o)}` : `${myName()} envoie à ${nm(o)}`} ${names.length} élément${names.length > 1 ? 's' : ''}${late ? ` (ajout${names.length > 1 ? 's' : ''} du ${dd(Date.now())})` : ''}`, { body: names.join(', ').slice(0, 180) });
  return names.length;
}
/** Données d'export (JPG / PDF) : éléments choisis, avec ou sans photos, et tout le circuit */
function exportDoc(l, ids, withPhotos) {
  const items = Object.entries(l.items || {}).filter(([i]) => ids.includes(i)).sort((a, b) => (a[1].order || 0) - (b[1].order || 0)), g = l.giver, rc = other(g);
  const cell = (q, d, who, w) => (q == null ? ['—', '', false] : [`×${q}`, [d, who].filter(Boolean).join(' · '), !!w]);
  const ph = k => { const x = l.phase?.[k] || {}, r = phaseInfo(l, k); return [x.sentAt ? `${k === 'aller' ? 'préparé' : 'rendu'} par ${nm(r.giver)} le ${dd(x.sentAt)}` : '', x.gotAt ? `réception confirmée par ${nm(r.receiver)} le ${dd(x.gotAt)}` : ''].filter(Boolean).join(' · ') || 'en cours'; };
  const total = Object.keys(l.items || {}).length;
  return {
    title: ltitle(l),
    stamp: `Exporté le ${dd(Date.now())} · ${S.family?.name || ''}${ids.length < total ? ` · ${ids.length} élément(s) sur ${total}` : ''}`,
    lines: [`${dirText(l)}${l.childIds?.length ? ' · ' + childNames(l.childIds) : ''}`, l.period ? `${vacName(l.period)} : du ${E.fmtDate(l.period.s)} au ${E.fmtDate(l.period.e)}` : '', `Aller (${nm(g)} → ${nm(rc)}) : ${ph('aller')}`, `Retour (${nm(rc)} → ${nm(g)}) : ${ph('retour')}`, closed(l) ? `Transfert clos le ${dd(l.phase.retour.gotAt)}` : ''].filter(Boolean),
    cols: ['Élément', l.dir === 'request' ? 'Demandé' : 'Prévu', 'Envoyé', 'Reçu', 'Rendu', 'Récupéré'],
    rows: items.map(([iid, it]) => {
      const a = stOf(l, 'aller', iid), r = stOf(l, 'retour', iid), sq = sentQty(l, iid), rq = r.qty ?? retQty(l, iid);
      const src = { extra: `Reçu en plus (non déclaré), indiqué par ${nmU(it.by)} le ${dd(it.at)}`, extraR: `Rendu en plus, indiqué par ${nmU(it.by)} le ${dd(it.at)}`, req: `Demandé à la réception par ${nmU(it.by)} le ${dd(it.at)}` }[it.src];
      return {
        name: it.name,
        sub: [it.desc, src, it.of ? `Complément de « ${l.items[it.of]?.name || ''} »` : '', a.note ? `Envoyé : ${a.note}` : '', it.late ? `Ajouté pendant la période le ${dd(it.late)}` : '', ...(it.hist || []).map(h => `Modifié le ${dd(h.at)} : ${h.txt}`),
          it.refused ? `Refusé par ${nmU(it.refused.by)} le ${dd(it.refused.at)}` : '', it.disputed ? `Contesté par ${nmU(it.disputed.by)} le ${dd(it.disputed.at)}` : '', it.okA ? `Écart (aller) accepté par ${nmU(it.okA.by)} le ${dd(it.okA.at)}` : '', it.okR ? `Retour accepté par ${nmU(it.okR.by)} le ${dd(it.okR.at)}` : ''].filter(Boolean),
        photos: withPhotos ? (it.photos || []).map(p => p.thumb).filter(Boolean) : [],
        cells: [it.src === 'extra' || it.src === 'extraR' ? cell(null) : cell(it.qty || 1, dd(it.at || l.createdAt), nmU(authorOf(l, it))), a.done ? cell(sq, dd(a.at), nm(g), !it.src && +sq !== +(it.qty || 1)) : cell(null),
          a.got ? cell(a.gotQty ?? sq, dd(a.gotAt), nm(rc), a.gotQty != null && a.done && +a.gotQty !== +sq) : cell(null),
          r.done ? cell(rq, dd(r.at), nm(rc)) : cell(null), r.got ? cell(r.gotQty ?? rq, dd(r.gotAt), nm(g), r.gotQty != null && +r.gotQty !== +rq) : cell(null)],
      };
    }),
    notes: ['Les quantités en rouge signalent un écart entre deux étapes. Les étapes confirmées ne sont plus modifiables.'],
  };
}
function exportSheet(l) {
  const items = Object.entries(l.items || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  openSheet(`<h3 class="sh-title">📄 Exporter « ${esc(ltitle(l))} »</h3><p class="small muted" style="margin-top:0">Avec le circuit de chaque élément : demande, envoi, réception, retour (quantités, dates, prénoms).</p>
    <label class="lbl">Format</label>${chips('fmt', [{ v: 'pdf', l: '📄 PDF' }, { v: 'jpg', l: '🖼️ Image JPG' }], ['pdf'])}
    <label class="row gap mt"><span class="sw"><input type="checkbox" name="photos" checked><span></span></span><span class="f1">Avec les photos</span></label>
    <div class="row between mt"><label class="lbl" style="margin:0">Éléments (${items.length})</label><a class="act" data-act="vl-exp-all">Tout / aucun</a></div>
    <div class="chips mtx" data-group="ids" data-multi="1" style="max-height:34vh;overflow:auto">${items.map(([i, it]) => `<button type="button" class="chip sm on" data-act="chip" data-val="${i}">${esc(it.name)}</button>`).join('')}</div>
    <div class="sh-actions"><button class="btn soft f1" data-act="vl-export-go" data-id="${l.id}" data-o="save">⬇️ Télécharger</button><button class="btn primary f1" data-act="vl-export-go" data-id="${l.id}" data-o="share">📤 Partager</button></div>`);
}

export const actions = {
  'sac-tab': el => { S.ui.sacTab = el.dataset.t; S.ui.sacSelOn = false; sel().clear(); S.render(); },
  'sac-pick': el => { S.ui.sacKey = el.dataset.k; S.ui.sacSelOn = false; sel().clear(); S.render(); },
  'sac-per': el => { S.ui.sacPer = el.dataset.id; S.render(); },
  'sac-sel': () => { S.ui.sacSelOn = !S.ui.sacSelOn; sel().clear(); S.render(); },
  'sac-sel-one': el => { const s = sel(); s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.add(el.dataset.id); S.render(); },
  'sac-sel-all': el => { const ids = el.dataset.ids.split(',').filter(Boolean), s = sel(), all = ids.every(id => s.has(id)); s.clear(); if (!all) ids.forEach(id => s.add(id)); S.render(); },
  'sac-new': el => itemSheet(null, { perm: el.dataset.perm === '1', k: el.dataset.k || '' }),
  'sac-item': el => { if (S.ui.sacSelOn) { actions['sac-sel-one'](el); return; } const i = S.sac.find(x => x.id === el.dataset.id); if (i) itemSheet(i, { relais: S.route.view === 'sac' && (S.ui.sacTab || 'relais') === 'relais' }); },
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
      else { const nid2 = S.be.db.newId(); await S.be.db.set(fpath('sac', nid2), { ...data, createdAt: Date.now(), createdBy: uid(), createdByName: myName() }); await log('sac', `Sac : ${f.name} ajouté${data.perm ? ' (chaque relais)' : ''}`, { body: f.desc || '', icon: '🎒', link: data.perm ? 'sacperm' : 'sac' }); }
      return true;
    }, 'Enregistré');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'sac-del': async el => {
    const i = S.sac.find(x => x.id === el.dataset.id); if (!i) return;
    if (!(await confirmBox(`Supprimer « ${i.name} » ?`, i.perm ? 'Elle disparaît de tous les relais.' : '', 'Supprimer', true))) return;
    await guard(() => S.be.db.del(fpath('sac', i.id)), 'Supprimé'); closeSheet();
  },
  'sac-del-sel': async () => {
    const ids = [...sel()].filter(id => S.sac.some(x => x.id === id)); if (!ids.length) return;
    if (!(await confirmBox(`Supprimer ${ids.length} affaire${ids.length > 1 ? 's' : ''} ?`, 'Elles disparaissent de tous les relais.', 'Supprimer', true))) return;
    await guard(async () => { for (const id of ids) await S.be.db.del(fpath('sac', id)); await log('sac', `Sac : ${ids.length} affaire${ids.length > 1 ? 's' : ''} supprimée${ids.length > 1 ? 's' : ''} (chaque relais)`, { icon: '🗑️', link: 'sacperm' }); }, 'Supprimé');
    S.ui.sacSelOn = false; sel().clear(); S.render();
  },
  'sac-out-sel': async () => {
    const h = S.ui.sacPick, ids = [...sel()]; if (!h || !ids.length) return;
    if (!(await confirmBox(`Retirer ${ids.length} affaire${ids.length > 1 ? 's' : ''} de ce relais ?`, 'Les affaires de chaque relais et les listes ne sont pas modifiées.', 'Retirer', true))) return;
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
  // Tout valider (relais) : « Dans le sac » pour celui qui donne, « Reçu » pour celui qui reçoit
  'sac-all': async el => {
    const h = S.ui.sacPick; if (!h) return; const items = itemsFor(h), me = myCode(), k = el.dataset.k, v = { by: uid(), byName: myName(), at: Date.now() };
    const data = me === h.to ? { got: Object.fromEntries(items.map(i => [i.id, v])) } : { packed: Object.fromEntries(items.map(i => [i.id, v])) };
    await guard(() => setRun(k, data), 'Tout est validé ☑️');
  },
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
    openSheet(`<h3 class="sh-title">⚠️ Signaler un oubli</h3><p class="small muted">Cochez ce qui manque : ${esc(nm(h.from))} sera prévenu(e).</p>
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
  // ───── listes type (privées)
  'tpl-vac': el => { S.ui.tplVac = el.dataset.v; S.ui.tplPer = null; S.render(); },
  'tpl-per': el => { S.ui.tplPer = el.dataset.id; S.render(); },
  'tpl-dir': async el => { await guard(() => tplUpd({ [`sacTpl.${el.dataset.v}.dir`]: el.dataset.d })); },
  'tpl-item': el => tplSheet(el.dataset.v, el.dataset.i || null),
  'tpl-item-save': async el => {
    const f = readForm(el.closest('.sheet')), v = el.dataset.v; if (!f.name) return toast("Donnez un nom à l'élément.", 'warn');
    const iid = el.dataset.i || nid(), cur = tpl(v).items?.[iid];
    const ok = await guard(async () => { await tplUpd({ [`sacTpl.${v}.items.${iid}`]: { name: f.name, qty: Math.max(1, +f.qty || 1), desc: f.desc || '', order: cur?.order ?? tplItems(v).length } }); return true; }, 'Enregistré');
    if (ok) closeSheet();
  },
  'tpl-item-del': async el => {
    const v = el.dataset.v, it = tpl(v).items?.[el.dataset.i]; if (!it) return;
    if (!(await confirmBox(`Retirer « ${it.name} » de la liste type ?`, 'Les listes des vacances déjà envoyées ne changent pas.', 'Retirer', true))) return;
    await guard(() => tplUpd({ [`sacTpl.${v}.items.${el.dataset.i}`]: S.be.db.deleteField() }), 'Retiré'); closeSheet();
  },
  'tpl-send': async el => {
    const v = el.dataset.v, iids = el.dataset.all ? tplItems(v).map(([id]) => id) : [el.dataset.i];
    el.disabled = true;
    const n = await guard(() => sendFromTpl(v, iids));
    el.disabled = false;
    if (n) toast(`${n} élément${n > 1 ? 's' : ''} ${(tpl(v).dir || 'request') === 'request' ? 'demandé' : 'envoyé'}${n > 1 ? 's' : ''} ✓`, 'ok'); else if (n === 0) toast('Déjà dans la liste.', 'warn');
  },
  // ───── listes des vacances
  'vl-new': el => listSheet(el.dataset.p),
  'vl-save': async el => {
    const f = readForm(el.closest('.sheet')), me = myCode() || 'A';
    if (!f.title) return toast('Donnez un titre à la liste.', 'warn');
    const per = periods().find(x => x.id === f.per); if (!per) return toast('Choisissez les vacances.', 'warn');
    const dir = f.dir || 'request', giver = dir === 'request' ? other(me) : me;
    el.disabled = true;
    const ok = await guard(async () => {
      const src = f.from ? L(f.from) : null, items = {};
      if (src) Object.entries(src.items || {}).filter(([, v]) => !v.src).forEach(([, v], n) => { items[nid()] = { name: v.name, desc: v.desc || '', qty: v.qty || 1, order: n, photos: v.photos || [], at: Date.now(), by: uid() }; });
      const id = S.be.db.newId(), l = { id, title: f.title, period: { id: per.id, n: per.n, i: per.i || '🏖️', s: per.s, e: per.e } };
      await S.be.db.set(fpath('sac', id), { kind: 'vlist', v: 2, title: f.title, period: l.period, dir, ownerCode: me, giver, childIds: f.childIds, items, st: { aller: {}, retour: {} }, phase: {}, createdAt: Date.now(), createdBy: uid(), createdByName: myName() });
      await slog(l, dir === 'request' ? `📥 ${myName()} demande à ${nm(giver)} : ${ltitle(l)}` : `📤 ${myName()} envoie à ${nm(other(giver))} : ${ltitle(l)}`);
      return id;
    }, 'Liste créée');
    if (ok) closeSheetsThen(() => go('sacl', { id: ok })); else el.disabled = false;
  },
  'vl-del': async el => {
    const l = L(el.dataset.id); if (!l) return;
    if (!canDelList(l)) return toast(isCreator(l) ? "L'autre parent a déjà agi sur cette liste : elle ne peut plus être supprimée." : 'Seule la personne qui a créé la liste peut la supprimer.', 'warn', 4000);
    if (!(await confirmBox(`Supprimer « ${ltitle(l)} » ?`, 'Tous ses éléments sont supprimés.', 'Supprimer', true))) return;
    await guard(async () => { await S.be.db.del(fpath('sac', l.id)); await log('sac', `🗑️ Liste supprimée : ${ltitle(l)}`, { icon: '🗑️', link: 'sac' }); }, 'Liste supprimée');
    go('sac');
  },
  'vl-item': el => {
    if (S.ui.sacSelOn) return; const l = L(el.dataset.id), it = l?.items?.[el.dataset.i]; if (!l || !it) return;
    if (authorOf(l, it) !== uid() || closed(l)) return toast("Seule la personne qui a ajouté l'élément peut le modifier.", 'warn');
    editSheet(l, el.dataset.i);
  },
  'vl-add': el => { const l = L(el.dataset.id); if (l && !closed(l)) addSheet(l, el.dataset.m); },
  'vl-add-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), l = L(el.dataset.id), mode = el.dataset.m; if (!l || closed(l)) return;
    if (!f.name) return toast("Donnez un nom à l'élément.", 'warn');
    const qty = Math.max(1, +f.qty || 1), iid = nid(), now = Date.now(), late = mode !== 'add' || datedAdd(l) ? today() : null;
    el.disabled = true;
    const ok = await guard(async () => {
      const photos = await uploadPhotos([...sh.querySelectorAll('[data-vi]')].flatMap(i => [...i.files]));
      const it = { name: f.name, desc: f.desc || '', qty, order: Object.keys(l.items || {}).length, photos, at: now, by: uid(), ...(late ? { late } : {}), ...(mode === 'add' ? {} : { src: mode }) };
      const upd = { [`items.${iid}`]: it };
      if (mode === 'extra') upd[`st.aller.${iid}`] = { got: true, gotQty: qty, gotBy: uid(), gotByName: myName(), gotAt: now };
      if (mode === 'extraR') upd[`st.retour.${iid}`] = { done: true, qty, by: uid(), byName: myName(), at: now };
      await vupd(l.id, upd);
      const T = { add: `${f.name} ×${qty} ajouté`, req: `${myName()} demande ${f.name} ×${qty}`, extra: `${myName()} a reçu en plus (non déclaré) : ${f.name} ×${qty}`, extraR: `${myName()} rend en plus : ${f.name} ×${qty}` }[mode];
      await slog(l, `${ltitle(l)} : ${T}${late ? ` (le ${dd(now)})` : ''}`, { icon: mode === 'add' ? '🧳' : '⚠️', ph: mode === 'extraR' ? 'retour' : 'aller' });
      return true;
    }, 'Enregistré');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'vl-item-save': async el => {
    const f = readForm(el.closest('.sheet')), l = L(el.dataset.id), iid = el.dataset.i; if (!l || !fullEdit(l, iid)) return toast('Modification impossible à ce stade.', 'warn');
    if (!f.name) return toast("Donnez un nom à l'élément.", 'warn');
    const qty = Math.max(1, +f.qty || 1), cur = l.items[iid], ch = [];
    if (cur.name !== f.name) ch.push(`Nom « ${cur.name} » → « ${f.name} »`);
    if (+cur.qty !== qty) ch.push(`Quantité ${cur.qty || 1} → ${qty}`);
    if ((cur.desc || '') !== (f.desc || '')) ch.push('Précisions modifiées');
    if (!ch.length) return closeSheet();
    const ok = await guard(async () => {
      await vupd(l.id, { [`items.${iid}.name`]: f.name, [`items.${iid}.qty`]: qty, [`items.${iid}.desc`]: f.desc || '', [`items.${iid}.hist`]: [...(cur.hist || []), { at: Date.now(), by: uid(), txt: ch.join(' · ') }] });
      await slog(l, `✏️ ${ltitle(l)} : ${cur.name}`, { body: ch.join(' · '), icon: '✏️' }); return true;
    }, 'Élément modifié');
    if (ok) closeSheet();
  },
  // en cours de période : on ne peut qu'ajouter une quantité (daté, l'autre parent est prévenu)
  'vl-item-plus': async el => {
    const f = readForm(el.closest('.sheet')), l = L(el.dataset.id), iid = el.dataset.i, it = l?.items?.[iid]; if (!it || authorOf(l, it) !== uid() || closed(l)) return;
    const plus = Math.max(1, +f.plus || 1), a = stOf(l, 'aller', iid), now = Date.now();
    const ok = await guard(async () => {
      if (!a.lock && !a.got) await vupd(l.id, { [`items.${iid}.qty`]: (+it.qty || 1) + plus, [`items.${iid}.hist`]: [...(it.hist || []), { at: now, by: uid(), txt: `Quantité ${it.qty || 1} → ${(+it.qty || 1) + plus} (+${plus})` }] });
      else await vupd(l.id, { [`items.${nid()}`]: { name: `${it.name} (complément)`, desc: it.desc || '', qty: plus, order: Object.keys(l.items).length, photos: [], at: now, by: uid(), late: today(), of: iid, ...(it.src === 'req' ? { src: 'req' } : {}) } });
      await slog(l, `➕ ${ltitle(l)} : ${it.name} +${plus} (le ${dd(now)})`, { icon: '➕' }); return true;
    }, `+${plus} ajouté`);
    if (ok) closeSheet();
  },
  'vl-item-del': async el => {
    const l = L(el.dataset.id), iid = el.dataset.i; if (!l?.items?.[iid] || !fullEdit(l, iid)) return toast('Suppression impossible à ce stade.', 'warn');
    if (!(await confirmBox(`Supprimer « ${l.items[iid].name} » ?`, '', 'Supprimer', true))) return;
    const db = S.be.db;
    await guard(async () => { await vupd(l.id, { [`items.${iid}`]: db.deleteField(), [`st.aller.${iid}`]: db.deleteField(), [`st.retour.${iid}`]: db.deleteField() }); await slog(l, `🗑️ ${ltitle(l)} : ${l.items[iid].name} retiré`, { icon: '🗑️' }); }, 'Supprimé');
    closeSheet();
  },
  'vl-del-sel': async () => {
    const id = S.route.params.id, l = L(id); if (!l) return;
    const ids = [...sel()].filter(i => fullEdit(l, i)); if (!ids.length) return toast('Rien à supprimer : seuls vos éléments, avant la période et avant toute action de l\'autre parent.', 'warn', 4000);
    if (!(await confirmBox(`Supprimer ${ids.length} élément${ids.length > 1 ? 's' : ''} ?`, '', 'Supprimer', true))) return;
    const db = S.be.db, data = {};
    for (const i of ids) { data[`items.${i}`] = db.deleteField(); data[`st.aller.${i}`] = db.deleteField(); data[`st.retour.${i}`] = db.deleteField(); }
    await guard(async () => { await vupd(id, data); await slog(l, `🗑️ ${ltitle(l)} : ${ids.length} élément${ids.length > 1 ? 's' : ''} retiré${ids.length > 1 ? 's' : ''}`, { icon: '🗑️' }); }, 'Supprimé');
    S.ui.sacSelOn = false; sel().clear(); S.render();
  },
  'vl-done': async el => {
    const l = L(el.dataset.id), { i, ph } = el.dataset; if (!l || !canAct(l, i, ph, 'giver')) return;
    const st = stOf(l, ph, i), on = !st.done; if (st.got) return;
    let q;
    if (ph === 'retour') q = retQty(l, i);
    else { const qIn = el.closest('.vi')?.querySelector('[data-change="vl-qty"]'); q = qIn && qIn.value !== '' ? Math.max(0, +qIn.value) : sentQty(l, i); }
    await guard(() => vupd(l.id, { [`st.${ph}.${i}.done`]: on, [`st.${ph}.${i}.qty`]: on ? q : st.qty ?? null, [`st.${ph}.${i}.by`]: uid(), [`st.${ph}.${i}.byName`]: myName(), [`st.${ph}.${i}.at`]: Date.now() }));
  },
  'vl-got': async el => {
    const l = L(el.dataset.id), { i, ph } = el.dataset; if (!l || !canAct(l, i, ph, 'receiver')) return;
    const st = stOf(l, ph, i), on = !st.got;
    const qIn = el.closest('.vi')?.querySelector('[data-change="vl-gotqty"]'), def = ph === 'retour' ? (st.qty ?? retQty(l, i)) : sentQty(l, i);
    const q = qIn && qIn.value !== '' ? Math.max(0, +qIn.value) : (st.gotQty ?? def);
    await guard(() => vupd(l.id, { [`st.${ph}.${i}.got`]: on, [`st.${ph}.${i}.gotQty`]: on ? q : st.gotQty ?? null, [`st.${ph}.${i}.gotBy`]: uid(), [`st.${ph}.${i}.gotByName`]: myName(), [`st.${ph}.${i}.gotAt`]: Date.now() }));
  },
  /** Tout valider : coche tous les éléments de l'étape pour mon rôle, avec les quantités saisies */
  'vl-all': async el => {
    const l = L(el.dataset.id), ph = el.dataset.ph, me = myCode(); if (!l || closed(l)) return;
    const r = phaseInfo(l, ph), now = Date.now(), upd = {}; let n = 0;
    for (const [i, it] of phaseItems(l, ph, me)) {
      const st = stOf(l, ph, i); if (st.lock || it.refused || it.disputed) continue;
      const card = document.getElementById('vi-' + i);
      if (me === r.giver) {
        if (st.done || st.got || it.src === 'extraR' || (ph === 'aller' && it.src === 'extra')) continue;
        const qIn = card?.querySelector('[data-change="vl-qty"]'), q = ph === 'retour' ? retQty(l, i) : qIn && qIn.value !== '' ? Math.max(0, +qIn.value) : sentQty(l, i);
        Object.assign(upd, { [`st.${ph}.${i}.done`]: true, [`st.${ph}.${i}.qty`]: q, [`st.${ph}.${i}.by`]: uid(), [`st.${ph}.${i}.byName`]: myName(), [`st.${ph}.${i}.at`]: now }); n++;
      } else if (me === r.receiver) {
        if (st.got) continue;
        const qIn = card?.querySelector('[data-change="vl-gotqty"]'), def = ph === 'retour' ? (st.qty ?? retQty(l, i)) : sentQty(l, i), q = qIn && qIn.value !== '' ? Math.max(0, +qIn.value) : (st.gotQty ?? def);
        Object.assign(upd, { [`st.${ph}.${i}.got`]: true, [`st.${ph}.${i}.gotQty`]: q, [`st.${ph}.${i}.gotBy`]: uid(), [`st.${ph}.${i}.gotByName`]: myName(), [`st.${ph}.${i}.gotAt`]: now }); n++;
      }
    }
    if (!n) return toast('Tout est déjà validé.', 'ok');
    await guard(() => vupd(l.id, upd), `${n} élément${n > 1 ? 's' : ''} validé${n > 1 ? 's' : ''} ☑️`);
  },
  'vl-qty': async el => { const l = L(el.dataset.id), { i, ph } = el.dataset; if (!l || ph !== 'aller' || !canAct(l, i, ph, 'giver') || stOf(l, ph, i).got) return; await guard(() => vupd(l.id, { [`st.${ph}.${i}.qty`]: el.value === '' ? null : Math.max(0, +el.value) })); },
  'vl-gotqty': async el => { const l = L(el.dataset.id), { i, ph } = el.dataset; if (!l || !canAct(l, i, ph, 'receiver')) return; await guard(() => vupd(l.id, { [`st.${ph}.${i}.gotQty`]: el.value === '' ? null : Math.max(0, +el.value) })); },
  'vl-note': async el => { const l = L(el.dataset.id), { i, ph } = el.dataset; if (!l || !canAct(l, i, ph, 'giver') || stOf(l, ph, i).got) return; await guard(() => vupd(l.id, { [`st.${ph}.${i}.note`]: el.value.trim() })); },
  'vl-ph': async el => {
    const l = L(el.dataset.id), { i, p, ph } = el.dataset; if (!l || stOf(l, ph, i).lock || closed(l)) return;
    const on = !l.st?.[ph]?.[i]?.ph?.[p];
    await guard(() => vupd(l.id, { [`st.${ph}.${i}.ph.${p}`]: on ? { by: uid(), at: Date.now() } : null }));
  },
  'vl-zoom': async el => {
    const sh = openSheet(`<div data-part="b"><img class="receipt" style="max-height:72vh" src="${el.dataset.t}"></div><button class="btn primary block mt" data-act="close-sheet">Fermer</button>`);
    if (el.dataset.b) { const b = await S.be.db.get(fpath('blobs', el.dataset.b)).catch(() => null); if (b) sh.querySelector('[data-part="b"]').innerHTML = `<img class="receipt" style="max-height:72vh" src="${b.data}">`; }
  },
  'vl-jump': () => document.getElementById('vl-alerts')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
  // actions de l'encadré « Alertes »
  'vl-al': async el => {
    const l = L(el.dataset.id), { i, a, ph } = el.dataset, it = l?.items?.[i]; if (!it || closed(l)) return;
    const now = Date.now(), stamp = { by: uid(), at: now }, own = myCode() === ownerOf(l), upd = {};
    let msg = '', ping = '';
    if (a === 'send' && own) { Object.assign(upd, { [`st.aller.${i}.done`]: true, [`st.aller.${i}.qty`]: +it.qty || 1, [`st.aller.${i}.by`]: uid(), [`st.aller.${i}.byName`]: myName(), [`st.aller.${i}.at`]: now }); msg = 'Envoyé'; ping = `📤 ${it.name} ×${it.qty || 1} envoyé`; }
    else if (a === 'refuse' && own) { upd[`items.${i}.refused`] = stamp; msg = 'Refusé'; ping = `✗ Demande refusée : ${it.name}`; }
    else if (a === 'confirm' && own) { const st = stOf(l, 'aller', i); Object.assign(upd, { [`st.aller.${i}.done`]: true, [`st.aller.${i}.qty`]: st.gotQty ?? it.qty, [`st.aller.${i}.by`]: uid(), [`st.aller.${i}.byName`]: myName(), [`st.aller.${i}.at`]: now }); msg = 'Confirmé'; ping = `✓ ${it.name} : bien envoyé`; }
    else if (a === 'dispute' && own) { upd[`items.${i}.disputed`] = stamp; msg = 'Contesté'; ping = `✗ ${it.name} : contesté`; }
    else if (a === 'okA') { upd[`items.${i}.okA`] = stamp; msg = 'Écart accepté'; ping = `✓ Écart accepté : ${it.name}`; }
    else if (a === 'okR' && own) { upd[`items.${i}.okR`] = stamp; msg = 'Accepté'; ping = `✓ Retour accepté : ${it.name}`; }
    else if (a === 'gotA') { Object.assign(upd, { [`st.aller.${i}.got`]: true, [`st.aller.${i}.gotQty`]: sentQty(l, i), [`st.aller.${i}.gotBy`]: uid(), [`st.aller.${i}.gotByName`]: myName(), [`st.aller.${i}.gotAt`]: now, [`st.aller.${i}.lock`]: !!l.phase?.aller?.gotAt }); msg = 'Reçu'; ping = `📥 ${it.name} finalement reçu`; }
    else if (a === 'gotR' && own) { const st = stOf(l, 'retour', i); Object.assign(upd, { [`st.retour.${i}.got`]: true, [`st.retour.${i}.gotQty`]: st.qty ?? retQty(l, i), [`st.retour.${i}.gotBy`]: uid(), [`st.retour.${i}.gotByName`]: myName(), [`st.retour.${i}.gotAt`]: now, [`st.retour.${i}.lock`]: !!l.phase?.retour?.gotAt }); msg = 'Récupéré'; ping = `✅ ${it.name} récupéré`; }
    else if (a === 'retNow') { Object.assign(upd, { [`st.retour.${i}.done`]: true, [`st.retour.${i}.qty`]: retQty(l, i), [`st.retour.${i}.by`]: uid(), [`st.retour.${i}.byName`]: myName(), [`st.retour.${i}.at`]: now }); msg = 'Rendu'; ping = `↩️ ${it.name} rendu`; }
    else if (a === 'ping') { await guard(() => slog(l, `🔔 ${ltitle(l)} : ${it.name}`, { body: `${myName()} vous relance (${ph})`, icon: '🔔', ph }), 'Relance envoyée 🔔'); return; }
    else return;
    await guard(async () => { await vupd(l.id, upd); await slog(l, `${ltitle(l)} : ${ping}`, { icon: '⚠️', ph }); }, msg);
  },
  'vl-sent': async el => {
    const l = L(el.dataset.id), ph = el.dataset.ph; if (!l || myCode() !== phaseInfo(l, ph).giver || closed(l)) return;
    const ids = phaseItems(l, ph, myCode()).map(([i]) => i).filter(i => !l.items[i].refused && !['extra', 'extraR'].includes(l.items[i].src)), st = l.st?.[ph] || {}, left = ids.filter(i => !st[i]?.done);
    if (left.length && !(await confirmBox(ph === 'aller' ? 'Tout est préparé ?' : 'Tout est rendu ?', `Pas encore cochés (ils apparaîtront en alerte) : ${esc(left.map(i => l.items[i].name).join(', '))}`, 'Oui, valider'))) return;
    const lines = ids.filter(i => st[i]?.done).map(i => `${l.items[i].name} ×${st[i].qty ?? sentQty(l, i)}`).join(', ');
    await guard(async () => { await vupd(l.id, { [`phase.${ph}.sentAt`]: Date.now(), [`phase.${ph}.sentBy`]: uid(), [`phase.${ph}.sentByName`]: myName() }); await slog(l, `🧳 ${ltitle(l)} (${ph}) : ${ids.length - left.length}/${ids.length} ${ph === 'aller' ? 'préparés' : 'rendus'}`, { body: lines.slice(0, 180), icon: '🎒', ph }); }, ph === 'aller' ? 'Préparation envoyée ✓' : 'Retour envoyé ✓');
  },
  'vl-recv': async el => {
    const l = L(el.dataset.id), ph = el.dataset.ph; if (!l || myCode() !== phaseInfo(l, ph).receiver || closed(l)) return;
    const items = phaseItems(l, ph, myCode()).map(([i]) => i), st = l.st?.[ph] || {}, def = i => (ph === 'retour' ? (st[i]?.qty ?? retQty(l, i)) : sentQty(l, i));
    const got = items.filter(i => st[i]?.got && !st[i]?.lock);
    const gaps = items.filter(i => st[i]?.got && st[i]?.gotQty != null && +st[i].gotQty !== +def(i)).map(i => `${l.items[i].name} : ${def(i)} → ${st[i].gotQty}`);
    const miss = items.filter(i => !st[i]?.got && !l.items[i].refused && !l.items[i].disputed).map(i => l.items[i].name);
    if (!(await confirmBox('Confirmer la réception ?', `${got.length} élément${got.length > 1 ? 's' : ''} reçu${got.length > 1 ? 's' : ''} ser${got.length > 1 ? 'ont' : 'a'} figé${got.length > 1 ? 's' : ''} (plus de modification).${miss.length ? ' Non reçus (en alerte) : ' + esc(miss.join(', ')) : ''}`, 'Confirmer'))) return;
    const upd = { [`phase.${ph}.gotAt`]: Date.now(), [`phase.${ph}.gotBy`]: uid(), [`phase.${ph}.gotByName`]: myName() };
    for (const i of got) upd[`st.${ph}.${i}.lock`] = true;
    await guard(async () => { await vupd(l.id, upd); await slog(l, `📥 ${ltitle(l)} (${ph}) : réception ${gaps.length || miss.length ? 'avec écarts' : 'complète ✓'}`, { body: [...gaps, ...(miss.length ? ['non reçus : ' + miss.join(', ')] : [])].join(' · ').slice(0, 180), icon: gaps.length || miss.length ? '⚠️' : '📥', ph }); }, 'Réception confirmée 🔒');
  },
  'vl-export': el => { const l = L(el.dataset.id); if (l) exportSheet(l); },
  'vl-exp-all': el => { const g = el.closest('.sheet').querySelector('[data-group="ids"]'), all = [...g.querySelectorAll('.chip')], on = all.every(c => c.classList.contains('on')); all.forEach(c => c.classList.toggle('on', !on)); },
  'vl-export-go': async el => {
    const l = L(el.dataset.id); if (!l) return;
    const sh = el.closest('.sheet'), f = readForm(sh), ids = [...sh.querySelectorAll('[data-group="ids"] .chip.on')].map(c => c.dataset.val);
    if (!ids.length) return toast('Choisissez au moins un élément.', 'warn');
    el.disabled = true; toast('Préparation du fichier…', 'ok', 1500);
    try {
      const name = ltitle(l).replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-');
      const file = await buildFile(exportDoc(l, ids, !!f.photos), f.fmt === 'jpg' ? 'jpg' : 'pdf', name);
      S.ui.lastExport = file; closeSheet();
      if (el.dataset.o === 'save') saveFile(file); else await shareFile(file, ltitle(l));
    } catch (e) { console.error(e); toast('Export impossible : ' + (e.message || e), 'err'); }
    el.disabled = false;
  },
  // ───── Repartir de zéro : tout le Sac (ce cercle et le cercle de test), notifications du Sac comprises
  'sac-reset': async () => {
    const t = LS.get('testAcc', null), ids = [...new Set([S.fid, t?.fid, t?.realFid].filter(Boolean))].filter(f => (S.profile?.familyIds || []).includes(f));
    const names = ids.map(f => S.families?.[f]?.name || (f === S.fid ? S.family?.name : f === t?.fid ? '🧪 Famille TEST' : 'cercle')).join(' et ');
    if (!(await confirmBox('Effacer tout le Sac ?', `Dans ${esc(names)} : affaires, listes des vacances, relais du sac, photos, ainsi que les notifications et l'historique du Sac. Vos listes type sont gardées. Impossible d'annuler.`, 'Tout effacer', true))) return;
    toast('Effacement en cours…', 'ok', 2500);
    const db = S.be.db, me = uid();
    const wipe = async (d, fid, owners) => {
      let n = 0;
      for (const sub of ['sac', 'sacRuns']) for (const r of await d.list(`families/${fid}/${sub}`)) { await d.del(`families/${fid}/${sub}/${r.id}`); n++; }
      for (const r of await d.list(`families/${fid}/blobs`, { where: [['kind', '==', 'sac']] }).catch(() => [])) await d.del(`families/${fid}/blobs/${r.id}`).catch(() => { });
      for (const o of owners) for (const r of await d.list(`families/${fid}/inbox/${o}/items`, { where: [['cat', '==', 'sac']] }).catch(() => [])) await d.del(`families/${fid}/inbox/${o}/items/${r.id}`).catch(() => { });
      return n;
    };
    const n = await guard(async () => {
      let k = 0; for (const fid of ids) k += await wipe(db, fid, [me]);
      if (t?.fid && ids.includes(t.fid)) await S.be.auth.side(t.email, t.pw, async ({ uid: mu, db: d2 }) => { await wipe(d2, t.fid, [mu]); }).catch(e => console.warn('test', e));
      return k;
    });
    if (n !== undefined) { toast(`Sac effacé (${n} élément${n > 1 ? 's' : ''}) ✓ On recommence !`, 'ok', 4000); S.ui.sacTab = 'liste'; S.render(); }
  },
};

// ───── Import (lien #/import?k=…) : listes des vacances (v1) ou listes type privées (v2)
function readImport(k) {
  try { let b = String(k).replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0)))); }
  catch (e) { return null; }
}
function findPeriod(id) { const st = settings(); return E.schoolHolidays(st.zone || 'B', st.customHolidays || []).find(p => p.id === id) || null; }
views.import = p => {
  const d = p.k ? readImport(p.k) : S.ui.importData;
  if (p.k && d) { S.ui.importData = d; history.replaceState(null, '', '#/import'); S.route = { view: 'import', params: {} }; }
  if (!d?.lists?.length && !d?.tpl?.length) return { title: 'Importer', back: 'sac', html: '<div class="card empty">Lien d\'import invalide ou déjà utilisé.</div>' };
  if (!isParent()) return { title: 'Importer', back: 'home', html: '<div class="card empty">Réservé aux parents.</div>' };
  const me = myCode() || 'A';
  if (d.tpl?.length) return {
    title: 'Listes type', back: 'sac',
    html: `<div class="card"><h3>📋 ${d.tpl.length} listes type</h3><p class="small muted" style="margin-top:0">Ajoutées à <b>vos</b> listes type (visibles uniquement par vous). Elles remplacent celles du même nom.</p>
      ${d.tpl.map(x => `<div class="per" style="align-items:flex-start"><div class="pi">${VAC[x.vac]?.[1] || '🏖️'}</div><div class="f1"><div class="pn">${esc(VAC[x.vac]?.[0] || x.vac)} · ${x.dir === 'send' ? `Envoi à ${esc(nm(other(me)))}` : `Demande à ${esc(nm(other(me)))}`}</div>
        <div class="tiny muted mtx">${x.items.map(i => `${esc(i[0])}${i[1] > 1 ? ' ×' + i[1] : ''}`).join(' · ')}</div></div></div>`).join('')}
      <button class="btn primary block mt" data-act="import-go">✅ Ajouter à mes listes type</button></div>`,
  };
  return {
    title: 'Importer des listes', back: 'sac',
    html: `<div class="card"><h3>🧳 ${d.lists.length} listes des vacances</h3><p class="small muted" style="margin-top:0">Elles seront ajoutées au cercle <b>${esc(S.family?.name || '')}</b>, pour ${esc(childNames(S.children.map(c => c.id)))}.</p>
      ${d.lists.map(l => { const per = findPeriod(l.per); return `<div class="per" style="align-items:flex-start"><div class="pi">${per?.i || '🏖️'}</div><div class="f1"><div class="pn">${esc(l.title)} · ${esc(per ? vacName(per) : l.per)}</div>
        <div class="pd">${l.dir === 'request' ? `Demande à ${esc(nm(other(me)))}` : `Envoi à ${esc(nm(other(me)))}`} · ${l.items.length} éléments</div>
        <div class="tiny muted mtx">${l.items.map(i => `${esc(i[0])}${i[1] > 1 ? ' ×' + i[1] : ''}`).join(' · ')}</div></div></div>`; }).join('')}
      <button class="btn primary block mt" data-act="import-go">✅ Ajouter ces listes</button></div>`,
  };
};
actions['import-go'] = async el => {
  const d = S.ui.importData; if (!d) return; el.disabled = true;
  const me = myCode() || 'A', kids = S.children.map(c => c.id);
  if (d.tpl?.length) {
    const ok = await guard(async () => {
      const upd = {};
      for (const x of d.tpl) { if (!VAC[x.vac]) continue; const items = {}; x.items.forEach((it, k) => { items[nid()] = { name: it[0], qty: Math.max(1, +it[1] || 1), desc: it[2] || '', order: k }; }); upd[`sacTpl.${x.vac}`] = { dir: x.dir === 'send' ? 'send' : 'request', items }; }
      await tplUpd(upd); return true;
    }, 'Listes type ajoutées ✓');
    if (ok) { S.ui.importData = null; S.ui.sacTab = 'liste'; S.ui.tplVac = d.tpl[0].vac; go('sac'); } else el.disabled = false;
    return;
  }
  const ok = await guard(async () => {
    let n = 0;
    for (const l of d.lists) {
      const per = findPeriod(l.per); if (!per) continue;
      const items = {}; l.items.forEach((it, k) => { items[nid()] = { name: it[0], qty: Math.max(1, +it[1] || 1), desc: it[2] || '', order: k, photos: [], at: Date.now(), by: uid() }; });
      await S.be.db.set(fpath('sac', S.be.db.newId()), { kind: 'vlist', v: 2, title: l.title, period: { id: per.id, n: per.n, i: per.i || '🏖️', s: per.s, e: per.e }, dir: l.dir || 'request', ownerCode: me, giver: (l.dir || 'request') === 'request' ? other(me) : me, childIds: kids, items, st: { aller: {}, retour: {} }, phase: {}, createdAt: Date.now(), createdBy: uid(), createdByName: myName() });
      n++;
    }
    await log('sac', `🧳 ${n} listes des vacances ajoutées`, { body: d.lists.map(l => l.title).join(' · ').slice(0, 160), icon: '🧳', link: 'sac?tab=vac' });
    return n;
  }, 'Listes ajoutées ✓');
  if (ok) {
    const first = d.lists.map(l => findPeriod(l.per)).filter(p => p && p.e >= today()).sort((a, b) => a.s.localeCompare(b.s))[0];
    S.ui.importData = null; S.ui.sacTab = 'vac'; if (first) S.ui.sacPer = first.id; go('sac');
  } else el.disabled = false;
};
