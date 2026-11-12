// ═══════════════════════════════════════════════════════════════
//  SJ Family — état global, sélecteurs, écriture des données, notifications
// ═══════════════════════════════════════════════════════════════
import * as E from './engine.js?v=6.16';
import { toast, esc } from './ui.js?v=6.16';

export const VERSION = '6.16';
export const APP_URL = 'https://newboy7745.github.io/sj-family/';
/** Version minimale de l'appli Android des widgets (numéro de compilation) : au-dessous, le widget propose la mise à jour */
export const WIDGETS_APK = 13;
/** Adresse courte à partager (n'affiche ni GitHub ni le pseudo) */
export const SHARE_URL = 'https://tinyurl.com/sj-family';
/** Historique : les entrées antérieures à cette date restent dans l'ancien journal commun */
export const LEGACY_T0 = 1793491200000; // 1er novembre 2026 00:00 UTC
export const REPO = 'Newboy7745/sj-family';
export const APK_URL = `https://github.com/${REPO}/releases/latest/download/SJ-Widgets.apk`;
export const SCRIPT_URL = `${APP_URL}widget-iphone.js`;
export const FEED_URL = t => `https://firestore.googleapis.com/v1/projects/sj-family-dd337/databases/(default)/documents/widgets/${t}?key=AIzaSyDlyQZ-O5Xuko-jtIvhJSzlncg1eL9Icdg`;

// Compte administrateur : « admin@admin.com » est un alias du compte Firebase khalid.ajdid@gmail.com (aucun mot de passe dans le code)
export const ADMIN_EMAIL = 'khalid.ajdid@gmail.com';
export const ADMIN_ALIASES = ['admin@admin.com', 'admin@admin@com', 'admin@admin.fr'];
export const isAdminUser = () => (S.user?.email || '').toLowerCase() === ADMIN_EMAIL;
export function platform() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
export const isStandalone = () => !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
/** Statistiques anonymes (compteurs uniquement, aucune donnée personnelle) lues par le mode admin */
export const STAT_KEYS = ['users', 'families', 'active', 'installAndroid', 'installIOS', 'installOther', 'dlAndroid', 'dlIOS'];
export async function stat(key) {
  if (!S.be || !STAT_KEYS.includes(key)) return;
  const inc = S.be.db.increment(1);
  try {
    await Promise.all([S.be.db.set('stats/global', { [key]: inc }, true), S.be.db.set(`stats/d-${E.todayISO()}`, { [key]: inc }, true)]);
  } catch (e) { console.warn('stat', key, e?.code || e); }
}
export const CATS = {
  garde: { i: '📅', n: 'Garde' }, echange: { i: '🔄', n: 'Échanges' }, budget: { i: '💰', n: 'Budget' },
  agenda: { i: '🗓️', n: 'Agenda' }, taches: { i: '✅', n: 'Tâches' }, liaison: { i: '📒', n: 'Liaison' },
  cercle: { i: '👨‍👩‍👧‍👦', n: 'Cercle' }, documents: { i: '📁', n: 'Documents' }, souvenirs: { i: '📸', n: 'Souvenirs' },
  contacts: { i: '📞', n: 'Répertoire' }, sac: { i: '🎒', n: 'Sac' },
};
export const PARENT_COLORS = ['#9DC3E6', '#F8CBAD', '#B4D7A8', '#D9C2E9', '#FFE08A', '#A8DADC'];
export const CHILD_EMOJIS = ['👦', '👧', '🧒', '👶', '🧑', '🦁', '🐻', '🦊', '🐼', '🐯', '🚀', '⚽', '🎨', '🦄', '⭐'];

const LS = {
  get(k, d) { try { const v = localStorage.getItem('sjf:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sjf:' + k, JSON.stringify(v)); } catch (e) { /* */ } },
};
export { LS };

export const S = {
  be: null, user: null, profile: null, fid: null, family: null, families: {}, meMember: null, priv: null,
  members: [], invites: [], children: [], childInfo: [], plannings: [], exchanges: [], events: [], pevents: [], evx: [], tasks: [], notes: [],
  expenses: [], docs: [], contacts: [], memories: [], sac: [], sacRuns: [], activity: [], legacy: [], loaded: {},
  sel: new Set(LS.get('sel', [])), route: { view: 'home', params: {} }, ui: {},
};

// ───── Routeur (hash)
export function go(view, params = {}) {
  const q = new URLSearchParams(params).toString();
  const h = `#/${view}${q ? '?' + q : ''}`;
  if (location.hash === h) S.render?.(); else location.hash = h;
}
export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [v, q] = h.split('?');
  return { view: v || 'home', params: Object.fromEntries(new URLSearchParams(q || '')) };
}
export const rerender = () => S.render?.();

// ───── Sélecteurs
export const uid = () => S.user?.uid;
export function parents() {
  const p = S.family?.parents || {}, tB = S.family?.testCircle && p.B?.name === 'Maman' ? 'Maman TEST' : null;
  return {
    A: { uid: p.A?.uid || null, name: p.A?.name || 'Parent 1', short: p.A?.short || p.A?.name || 'Parent 1', color: p.A?.color || PARENT_COLORS[0], phone: p.A?.phone || '', email: p.A?.email || '' },
    B: { uid: p.B?.uid || null, name: tB || p.B?.name || 'Parent 2', short: p.B?.short || p.B?.name || 'Parent 2', color: p.B?.color || PARENT_COLORS[1], phone: p.B?.phone || '', email: p.B?.email || '' },
  };
}
export const pName = c => parents()[c]?.name || '—';
/** Prénom du parent (l'appellation « Papa » / « Maman » n'apparaît que sur l'accueil et dans le Cercle) */
export const pShort = c => parents()[c]?.name || '—';
/** Créneau d'un relais : « 08h20–08h30 » */
export const hoTime = h => `${E.fmtTime(h.time)}${h.timeEnd ? '–' + E.fmtTime(h.timeEnd) : ''}`;
/** Lieux d'un relais : « 📍 École », ou « 📍 Dépose : École · Récupération : Chez Jounayda » */
export function hoPlace(h, pre = ' · ') {
  const d = h.dropPlace || '', p = h.place || '';
  if (!d && !p) return '';
  return `${pre}📍 ${d && p && d !== p ? `Dépose : ${d} · Récupération : ${p}` : p || d}`;
}
export const pColor = c => parents()[c]?.color || '#ddd';
/** Événements visibles : ceux du cercle, plus (parents) ceux réservés aux parents, ex. accompagnement d'une sortie scolaire */
export function allEvents() { return isParent() ? [...S.events, ...S.pevents.map(e => ({ ...e, pe: true }))] : S.events; }
export const findEvent = id => allEvents().find(e => e.id === id) || null;
/** Absences et matchs des séances : { 'idEvénement_date': état } */
export function evxMap() { const m = {}; for (const x of S.evx) if (x.evId && x.date) m[E.evxKey(x.evId, x.date)] = x; return m; }
/** Seul le parent qui a créé l'événement le modifie ou le supprime (un événement créé par un proche reste gérable par les parents) */
export function canEditEv(ev) { const p = parents(); return !!ev && isParent() && (ev.createdBy === uid() || ![p.A.uid, p.B.uid].includes(ev.createdBy)); }
/** Occurrences avec leur état (absence, match) entre deux dates, pour les enfants choisis */
export function occs(from, to, ids = null) {
  const o = E.withStatus(E.expandEvents(allEvents(), from, to, settings()), evxMap());
  return ids ? o.filter(e => !e.childIds?.length || e.childIds.some(i => ids.includes(i))) : o;
}
export function me() { return S.meMember || S.members.find(m => m.uid === uid()) || { uid: uid(), name: S.profile?.prenom || 'Moi' }; }
export function myCode() { const p = parents(); return p.A.uid && p.A.uid === uid() ? 'A' : p.B.uid && p.B.uid === uid() ? 'B' : null; }
export const isParent = () => !!myCode();
/** Proche (grand-parent, nounou…) : voit l'agenda, les souvenirs, ses notes et les rubriques ouvertes par les parents */
export const isProche = () => !!S.family && !isParent();
export const PERM_KEYS = [
  { k: 'docs', l: '📁 Documents' }, { k: 'tasks', l: '✅ Tâches' }, { k: 'contacts', l: '📞 Répertoire' },
  { k: 'expenses', l: '💰 Budget (lecture seule)' }, { k: 'sac', l: '🎒 Sac du relais' },
];
/** Accès à une rubrique : toujours pour les parents, sur autorisation pour les proches */
export function can(sub) { return isParent() || !!(S.meMember?.perms || {})[sub]; }
export function otherParentUid() { const c = myCode(); if (!c) return null; return parents()[E.other(c)].uid; }
export function hasOtherParent() { return !!otherParentUid(); }
export function memberName(u) {
  if (!u) return '—'; if (u === uid()) return 'Moi';
  const p = parents(); if (p.A.uid === u) return p.A.name; if (p.B.uid === u) return p.B.name;
  const m = S.members.find(x => x.uid === u); return m ? (m.prenom || m.name || 'Proche') : (S.family?.dir?.[u] || 'Proche');
}
/** Tous les membres connus du cercle (parents + proches) */
export function allMemberUids() {
  const p = parents();
  return [...new Set([...(S.family?.memberUids || []), ...S.members.map(m => m.uid), p.A.uid, p.B.uid, uid()].filter(Boolean))];
}
/** Champs détaillés d'un enfant (école, santé…) : réservés aux parents (collection childInfo) */
export const CHILD_DETAIL_KEYS = ['school', 'cls', 'teacher', 'schoolInfo', 'doctor', 'doctorPhone', 'blood', 'allergies', 'treatments', 'health', 'height', 'shoe', 'clothes', 'activities', 'notes'];
export function kidFull(c) { if (!c) return c; const i = S.childInfo.find(x => x.id === c.id); return i ? { ...c, ...i, id: c.id } : c; }
/** Avatar d'enfant : photo ronde si elle existe, sinon emoji */
export function kidAvatar(c, size = 28) {
  if (c?.photo) return `<img class="kav" src="${c.photo}" alt="" style="width:${size}px;height:${size}px">`;
  return `<span class="kav e" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .78)}px">${esc(c?.emoji || '🧒')}</span>`;
}
export function groupAvatar(size = 28) {
  if (S.family?.groupPhoto) return `<img class="kav" src="${S.family.groupPhoto}" alt="" style="width:${size}px;height:${size}px">`;
  return '';
}
export const myName = () => S.profile ? `${S.profile.prenom || ''}`.trim() || S.user?.email : '';
export const myFullName = () => S.profile ? `${S.profile.prenom || ''} ${S.profile.nom || ''}`.trim() : '';
export function selChildren() { const all = S.children; const s = all.filter(c => S.sel.has(c.id)); return s.length ? s : all; }
export const selIds = () => selChildren().map(c => c.id);
export const childName = id => S.children.find(c => c.id === id)?.prenom || '?';
export const childNames = ids => (ids || []).map(childName).join(' & ');
export function setSel(ids) { S.sel = new Set(ids); LS.set('sel', [...S.sel]); }
export const settings = () => ({ handoverTime: '18:30', middayTime: '14:00', zone: 'B', customHolidays: [], relayRules: [], ...(S.family?.settings || {}) });

let _eng = null, _engKey = '';
export function engine() {
  const key = `${S.plannings.map(p => p.id + p.state + (p.updatedAt || 0)).join()}|${S.exchanges.map(x => x.id + x.state).join()}|${JSON.stringify(S.family?.settings || {})}`;
  if (!_eng || key !== _engKey) { _eng = E.makeEngine({ plannings: S.plannings, exchanges: S.exchanges, settings: settings() }); _engKey = key; }
  return _eng;
}

// ───── Écritures
export const fpath = (sub, id) => `families/${S.fid}/${sub}${id ? '/' + id : ''}`;
export async function addItem(sub, data) {
  const id = S.be.db.newId();
  await S.be.db.set(fpath(sub, id), { ...data, createdAt: Date.now(), createdBy: uid(), createdByName: myName() });
  return id;
}
export const updItem = (sub, id, data) => S.be.db.update(fpath(sub, id), { ...data, updatedAt: Date.now(), updatedBy: uid() });
export const setFamily = data => S.be.db.update(`families/${S.fid}`, { ...data, updatedAt: Date.now() });

/**
 * Journal d'activité : chaque destinataire reçoit l'entrée dans son propre historique (inbox/{uid}/items).
 * to = 'parents' (défaut : les deux parents) · 'self' (uniquement moi) · 'all' (tout le cercle) · [uid…] (ces membres + les deux parents)
 * push = destinataires prévenus sur leur téléphone (par défaut : tous sauf moi)
 */
export function audience(to = 'parents') {
  const p = parents(), par = [p.A.uid, p.B.uid].filter(Boolean);
  let list;
  if (to === 'self') list = [];
  else if (to === 'all') list = allMemberUids();
  else if (Array.isArray(to)) list = [...to, ...par];
  else list = par;
  return [...new Set([uid(), ...list].filter(Boolean))];
}
/** Page ouverte par défaut quand on touche une notification de cette rubrique */
export const CAT_LINK = { garde: 'plannings', echange: 'exchanges', budget: 'budget', agenda: 'agenda', taches: 'tasks', liaison: 'liaison', cercle: 'family', documents: 'docs', souvenirs: 'memories', contacts: 'contacts', sac: 'sac' };
/** Lien d'une notification : « vue?param=… » (sans #/) */
export const notifLink = a => a?.link || CAT_LINK[a?.cat] || 'home';
export async function log(cat, title, { body = '', link = null, icon = null, to = 'parents', push = null } = {}) {
  try {
    const id = S.be.db.newId(), at = Date.now(), ic = icon || CATS[cat]?.i || '🔔';
    const rcpt = audience(to), lk = link || CAT_LINK[cat] || null;
    const item = { cat, title, body, link: lk, icon: ic, by: uid(), byName: myName(), at, fid: S.fid };
    await Promise.all(rcpt.map(r => S.be.db.set(`families/${S.fid}/inbox/${r}/items/${id}`, item)));
    const pushList = (push || rcpt).filter(r => r !== uid());
    pushTo(pushList, `${ic} ${title}`, `${myName()}${body ? ' — ' + body : ''}`, lk, id);
  } catch (e) { console.warn('log', e); }
}

// ───── Notifications push gratuites (ntfy.sh) vers les autres membres
export async function ntfyPublish(topic, { title, message, tags, click, delay, seq, actions, priority }) {
  if (!topic) return;
  const body = { topic, title: String(title || '').slice(0, 200), message: String(message || ' ').slice(0, 1000), click: click || APP_URL };
  if (tags) body.tags = tags; if (delay) body.delay = delay; if (seq) body.sequence_id = seq; if (actions) body.actions = actions; if (priority) body.priority = priority;
  if (S.be?.mode === 'demo') { (S.ntfyLog ||= []).push({ op: 'pub', ...body }); return; }
  try { await fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify(body) }); } catch (e) { console.warn('ntfy', e); }
}
/** Annule une notification programmée (identifiant de séquence ntfy) avant son envoi */
export function ntfyCancel(topic, seq) {
  if (!topic || !seq) return;
  if (S.be?.mode === 'demo') { (S.ntfyLog ||= []).push({ op: 'del', topic, seq }); return; }
  fetch(`https://ntfy.sh/${encodeURIComponent(topic)}/${encodeURIComponent(seq)}/delete`, { mode: 'no-cors' }).catch(e => console.warn('ntfy', e));
}
/** Notifications push vers des membres précis (les sujets ntfy des autres ne sont connus que des parents) */
export function pushTo(uids, title, message, link = null, nid = null) {
  if (S.be?.mode === 'demo') return;
  const click = `${APP_URL}#/${link || 'notifs'}${(link || '').includes('?') ? '&' : '?'}fam=${S.fid}${nid ? '&n=' + nid : ''}`;
  for (const u of uids) { const m = S.members.find(x => x.uid === u); if (m && m.uid !== uid() && m.ntfyOn && m.ntfyTopic) ntfyPublish(m.ntfyTopic, { title, message, click }); }
}
// ───── Rappels personnalisés : pour chaque action (remise / récupération d'un relais, dépose / récupération d'un événement),
// combien de temps avant, combien de rappels et à quel intervalle. Réglages par défaut de chaque parent (fiche membre
// alerts.def), et réglage propre à un événement (alerts.ev[id]) ou à un échange (alerts.x[id]) : habituel, personnalisé ou aucun.
// Envoi : notifications ntfy programmées (≤ 3 jours à l'avance), registre reminders/al… partagé : pas de doublon, annulation si besoin.
export const ALERT_LABELS = { relDrop: '🔁 Relais : remise des enfants', relPick: '🔁 Relais : récupération des enfants', evDrop: '🗓️ Événements : dépose', evPick: '🗓️ Événements : récupération' };
const legacyRemind = m => (m?.remind === 'off' ? { on: false, b: 120, n: 1, i: 30 } : { on: true, b: +m?.remind || 120, n: 1, i: 30 });
export function alertDefaults(m) {
  const a = m?.alerts?.def || {}, rel = legacyRemind(m);
  return { relDrop: a.relDrop || rel, relPick: a.relPick || rel, evDrop: a.evDrop || { on: true, b: 60, n: 1, i: 15 }, evPick: a.evPick || { on: true, b: 30, n: 1, i: 15 } };
}
/** Réglage d'un parent pour un événement ('ev') ou un échange ('x') : { mode: 'def' | 'custom' | 'off', drop, pick } */
export const itemAlerts = (m, kind, id) => m?.alerts?.[kind]?.[id] || { mode: 'def' };
/** Instants des rappels avant l'heure at (le dernier au plus tard à l'heure dite) */
export function alertSteps(cfg, at) {
  if (!cfg?.on) return [];
  const n = Math.max(1, Math.min(5, +cfg.n || 1)), iv = Math.max(1, +cfg.i || 15) * 60000, out = [];
  for (let k = 0; k < n; k++) { const t = at - (+cfg.b || 60) * 60000 + k * iv; if (t <= at) out.push(t); }
  return out;
}
export const durTxt = min => (min >= 1440 && min % 1440 === 0 ? (min === 1440 ? '1 jour' : `${min / 1440} jours`) : min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ' ' + String(min % 60).padStart(2, '0') : ''}` : `${min} min`);
/** « 1 h avant, puis toutes les 15 min (3 rappels) » */
export function alertText(cfg) {
  if (!cfg?.on) return 'Aucun rappel';
  const n = Math.max(1, +cfg.n || 1);
  return `${durTxt(+cfg.b || 60)} avant${n > 1 ? `, puis toutes les ${durTxt(+cfg.i || 15)} (${n} rappels)` : ''}`;
}
const cyrb = str => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
const tsOf = (d, t) => { const [Y, M, D] = d.split('-').map(Number), [h, mi] = String(t || '00:00').split(':').map(Number); return new Date(Y, M - 1, D, h, mi).getTime(); };
/** Échange accepté qui a créé ce relais (jour échangé = ce jour ou le lendemain) */
const exchangeOf = h => S.exchanges.find(x => x.state === 'accepted' && (x.changes || []).some(c => c.d === h.date || c.d === E.addDays(h.date, 1)));
/** Rappels voulus dans les heures qui viennent, pour les parents qui ont activé les notifications */
export function wantedAlerts(now = Date.now(), horizonH = 70) {
  const out = [], today = E.todayISO(new Date(now)), end = E.addDays(today, 3), eng = engine(), ids = S.children.map(c => c.id);
  const mem = S.members.filter(m => m.parentCode && m.ntfyOn && m.ntfyTopic);
  if (!mem.length || !ids.length) return out;
  const push = (m, key, at, title, message, link, old = null) => { if (at >= now + 60000 && at <= now + horizonH * 3600000) out.push({ key, id: 'al' + cyrb(key), uid: m.uid, topic: m.ntfyTopic, at, title, message, link, old }); };
  for (const h of eng.handovers(ids, today, end)) {
    const T = tsOf(h.date, h.time), x = exchangeOf(h);
    for (const m of mem) {
      const role = h.from === m.parentCode ? 'drop' : h.to === m.parentCode ? 'pick' : null; if (!role) continue;
      const ia = x ? itemAlerts(m, 'x', x.id) : { mode: 'def' }; if (ia.mode === 'off') continue;
      const cfg = ia.mode === 'custom' ? ia[role] : alertDefaults(m)[role === 'drop' ? 'relDrop' : 'relPick'];
      alertSteps(cfg, T).forEach((at, k) => push(m, `r|${h.date}|${h.time}|${h.from}${h.to}|${h.childIds.join(',')}|${role}|${m.uid}|${k}`, at,
        `🔁 ${role === 'drop' ? 'Remise' : 'Récupération'} ${E.relDay(h.date)} à ${hoTime(h)}`,
        `${role === 'drop' ? `${childNames(h.childIds)} → ${pName(h.to)}` : `Récupération de ${childNames(h.childIds)}`}${hoPlace(h, ' — ')}`, `agenda?d=${h.date}`,
        k === 0 ? `${h.date}_${h.time.replace(':', '')}_${h.to}_${m.uid}` : null)); // rappel déjà programmé par une version précédente
    }
  }
  for (const o of occs(today, end)) {
    if ((o.x && !o.match) || !o.time) continue; // absent, remplacé par un match, ou sur la journée
    const src = o.match ? o.src : o, kid = (o.childIds || [])[0];
    const hold = kid ? eng.presence(kid, o.occ, E.t2m(o.time)) : null;
    const by = { drop: src.from || hold, pick: src.to || src.from || hold }, T = { drop: tsOf(o.occ, o.time), pick: o.timeEnd ? tsOf(o.occ, o.timeEnd) : null };
    const place = o.pickPlace || o.dropPlace || o.place || '';
    for (const m of mem) {
      const ia = itemAlerts(m, 'ev', src.id); if (ia.mode === 'off') continue;
      const def = alertDefaults(m);
      for (const role of ['drop', 'pick']) {
        if (!T[role]) continue;
        let cfg; if (ia.mode === 'custom') cfg = ia[role]; else { if (by[role] !== m.parentCode) continue; cfg = role === 'drop' ? def.evDrop : def.evPick; }
        alertSteps(cfg, T[role]).forEach((at, k) => push(m, `e|${src.id}|${o.occ}|${o.match ? 'm' : ''}${role}|${m.uid}|${k}`, at,
          `${o.icon || '📌'} ${role === 'drop' ? 'Dépose' : 'Récupération'} ${E.relDay(o.occ)} à ${E.fmtTime(role === 'drop' ? o.time : o.timeEnd)}`,
          `${o.title}${o.childIds?.length ? ' · ' + childNames(o.childIds) : ''}${place ? ' — 📍 ' + place : ''}`, `agenda?d=${o.occ}`));
      }
    }
  }
  return out;
}
let remTimer = null;
export function queueReminders() { clearTimeout(remTimer); remTimer = setTimeout(scheduleReminders, 5000); }
/** Programme les rappels voulus et annule ceux qui ne le sont plus (réglage changé, séance annulée, événement supprimé) */
export async function scheduleReminders() {
  if (!S.fid || !S.children.length || !isParent() || S.alRun) return;
  S.alRun = true;
  try {
    const db = S.be.db, now = Date.now(), want = new Map(wantedAlerts(now).map(a => [a.id, a]));
    const ledger = await db.list(fpath('reminders'), { where: [['kind', '==', 'al']] }), have = new Set();
    for (const L of ledger) {
      if (L.at < now - 7 * 86400000) { await db.del(fpath('reminders', L.id)).catch(() => { }); continue; }
      const w = want.get(L.id);
      if (L.at > now + 30000 && (!w || w.at !== L.at || w.topic !== L.topic || w.title !== L.title)) { ntfyCancel(L.topic, L.id); await db.del(fpath('reminders', L.id)).catch(() => { }); continue; }
      have.add(L.id);
    }
    for (const a of want.values()) {
      if (have.has(a.id)) continue;
      if (a.old && await db.get(fpath('reminders', a.old)).catch(() => null)) continue; // ancien rappel de relais (avant 6.16) déjà envoyé à ntfy
      const created = await db.createIfAbsent(fpath('reminders', a.id), { kind: 'al', uid: a.uid, topic: a.topic, at: a.at, title: a.title, createdAt: now });
      if (!created) continue;
      ntfyPublish(a.topic, { title: a.title, message: a.message, delay: String(Math.round(a.at / 1000)), seq: a.id, tags: ['bell'], click: `${APP_URL}#/${a.link}&fam=${S.fid}` });
    }
  } catch (e) { console.warn('rappels', e); } finally { S.alRun = false; }
}

// ───── Flux des widgets (document public non listable widgets/{jeton})
let feedTimer = null;
export function queueFeed() { clearTimeout(feedTimer); feedTimer = setTimeout(syncFeed, 2500); }
/** Jeton secret des widgets : commun aux parents (document privé), personnel pour un proche */
export function widgetToken() { return isParent() ? (S.priv?.widgetToken || S.family?.widgetToken || null) : (S.meMember?.widgetToken || null); }
export async function syncFeed(force = false) {
  const tok = widgetToken(); if (!tok || !S.children.length) return;
  try {
    const par = isParent();
    const feed = E.buildFeed({
      engine: engine(), family: S.family, children: S.children.map(kidFull), parents: parents(),
      events: allEvents(), evx: evxMap(), tasks: par ? S.tasks : [], notes: par ? [...S.notes].sort((a, b) => b.at - a.at) : [],
      includeHealth: par && !!(S.priv?.widgetHealth ?? S.family?.widgetHealth), appUrl: APP_URL, apk: WIDGETS_APK,
    });
    const sig = JSON.stringify({ ...feed, gen: 0 });
    const h = await hash(sig);
    const k = 'feed:' + tok;
    if (!force && LS.get(k) === h + E.todayISO()) return;
    await S.be.db.set(`widgets/${tok}`, { fid: S.fid, payload: JSON.stringify(feed), updatedAt: Date.now() });
    LS.set(k, h + E.todayISO());
  } catch (e) { console.warn('feed', e); }
}
async function hash(s) {
  try { const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
}

// ───── Divers
export function avatar(name, color = '#E8735A', size = 40) {
  return `<span class="av" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.round(size * .42)}px">${esc((name || '?').trim().charAt(0).toUpperCase())}</span>`;
}
export function errMsg(e) {
  const c = e?.code || e?.message || '';
  const M = {
    'auth/invalid-credential': 'E-mail ou mot de passe incorrect.', 'auth/wrong-password': 'Mot de passe incorrect.', 'auth/user-not-found': 'Aucun compte avec cet e-mail.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail.', 'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
    'auth/invalid-email': 'Adresse e-mail invalide.', 'auth/too-many-requests': 'Trop de tentatives, réessayez dans quelques minutes.',
    'auth/network-request-failed': 'Pas de connexion internet.', 'permission-denied': "Accès refusé : vérifiez que les règles Firestore ont bien été mises à jour (voir LISEZMOI).",
    'unavailable': 'Serveur injoignable, vos changements seront envoyés au retour du réseau.',
  };
  for (const k of Object.keys(M)) if (c.includes(k)) return M[k];
  return 'Erreur : ' + (e?.message || c || 'inconnue');
}
export async function guard(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { console.error(e); toast(errMsg(e), 'err', 4500); return undefined; }
}
export function needsValidation() { return isParent() && hasOtherParent(); }
/**
 * Importations (souvenirs, documents) : l'autre parent a 48 h pour valider. Sans validation, le média expire :
 * il disparaît pour l'autre parent et la personne qui l'a envoyé doit le renvoyer (nouvelle demande de 48 h).
 * Rappels push à l'autre parent 24 h, 1 h et 15 min avant l'expiration, sauf s'il a mis la demande en sourdine.
 */
export const APPROVE_MS = 48 * 3600000;
export const needApproval = () => isParent() ? hasOtherParent() : true;
export const sentAt = it => it?.sentAt || it?.createdAt || it?.at || 0;
export const expiresAt = it => sentAt(it) + APPROVE_MS;
export const grpOf = it => it?.grp || it?.id;
// les médias privés des parents (priv) ne passent pas par la validation
export const isPending = it => !!it && it.pub === false && !it.refused && !it.priv;
export const isExpired = it => isPending(it) && Date.now() >= expiresAt(it);
export const canApprove = it => isParent() && isPending(it) && !isExpired(it) && it.createdBy !== uid();
export const canResend = it => isExpired(it) && it.createdBy === uid();
/** Les médias expirés ne restent visibles que pour la personne qui les a envoyés (pour les renvoyer) */
// refusé : ne reste visible que pour la personne qui l'a envoyé (barré d'une croix rouge)
export const shownItem = it => (it?.refused ? it.createdBy === uid() : !isExpired(it) || it.createdBy === uid());
export const isMuted = it => !!it?.muted?.[uid()];
/** Temps restant : « 47 h 12 min », « 15 min » */
export function leftText(ms) {
  const s = Math.max(0, Math.ceil(ms / 60000)), h = Math.floor(s / 60), m = s % 60;
  return h ? `${h} h${m ? ' ' + String(m).padStart(2, '0') + ' min' : ''}` : `${m} min`;
}
export function approvalText(it) {
  if (!it || it.pub !== false) return '';
  if (it.refused) return `❌ Refusé par ${it.refusedByName || "l'autre parent"}`;
  if (isExpired(it)) return it.createdBy === uid() ? '⌛ Non validé dans les 48 h : renvoyez-le pour une nouvelle demande' : '⌛ Expiré (non validé dans les 48 h)';
  const left = leftText(expiresAt(it) - Date.now());
  if (canApprove(it)) return `⏳ À valider · disparaît dans ${left} sans validation${isMuted(it) ? ' · 🔕 rappels coupés' : ''}`;
  return `⏳ En attente de validation par ${isParent() ? "l'autre parent" : 'un parent'} · expire dans ${left}`;
}
const SUB_N = { memories: ['Souvenir', 'souvenirs'], docs: ['Document', 'documents'] };
export const subLabel = (sub, n) => n > 1 ? `${n} ${SUB_N[sub][1]}` : SUB_N[sub][0];
/** Lots en attente (les photos/vidéos envoyées ensemble forment un lot) */
export function approvalGroups({ expired = false } = {}) {
  const out = new Map();
  for (const sub of ['memories', 'docs']) for (const it of S[sub] || []) {
    if (!isPending(it) || isExpired(it) !== expired) continue;
    const k = `${sub}:${grpOf(it)}:${sentAt(it)}`;
    if (!out.has(k)) out.set(k, { sub, grp: grpOf(it), sent: sentAt(it), exp: expiresAt(it), items: [], by: it.createdBy, byName: it.createdByName || memberName(it.createdBy), title: it.title || '' });
    out.get(k).items.push(it);
  }
  return [...out.values()].sort((a, b) => a.exp - b.exp);
}
export const groupItems = (sub, grp) => (S[sub] || []).filter(it => grpOf(it) === grp);
const AP_STEPS = [['r24', 1440], ['r1', 60], ['r15', 15]];
const apSeq = (g, k) => `sj${g.grp}${Math.round(g.sent / 1000).toString(36)}${k}`.replace(/[^-_A-Za-z0-9]/g, '').slice(0, 64);
const apLink = g => `${APP_URL}#/appr?c=${g.sub}&g=${encodeURIComponent(g.grp)}`;
function scheduleSteps(g, targets, owner, now) {
  const n = g.items.length, what = subLabel(g.sub, n), pl = n > 1;
  const quote = g.title ? ` « ${g.title} »` : '';
  for (const topic of Object.values(targets)) for (const [k, min] of AP_STEPS) {
    const when = g.exp - min * 60000; if (when < now + 30000) continue;
    const left = min >= 60 ? `${min / 60} h` : `${min} min`, url = apLink(g);
    ntfyPublish(topic, {
      title: `${min <= 15 ? '⚠️' : '⏳'} ${what} à valider : il reste ${left}`,
      message: `Envoyé${pl ? 's' : ''} par ${g.byName || 'un membre'}${quote}. Sans validation, ${pl ? 'ils disparaissent' : 'il disparaît'} dans ${left} et ${pl ? 'devront' : 'devra'} être renvoyé${pl ? 's' : ''}.`,
      delay: String(Math.round(when / 1000)), seq: apSeq(g, k), click: url, priority: min <= 15 ? 4 : 3,
      actions: [{ action: 'view', label: 'Ouvrir', url }, { action: 'view', label: '🔕 Sourdine', url: url + '&mute=1', clear: true }],
    });
  }
  if (owner && g.exp > now + 30000) ntfyPublish(owner.topic, {
    title: `⌛ ${what} non validé${pl ? 's' : ''} dans les 48 h`, message: `${quote ? quote.trim() + ' : ' : ''}personne ne l'a validé à temps. Renvoyez-le depuis l'application pour une nouvelle demande.`,
    delay: String(Math.round(g.exp / 1000)), seq: apSeq(g, 'ex'), click: apLink(g),
  });
}
function cancelSteps(L, only, now) {
  for (const [u, topic] of Object.entries(L.targets || {})) {
    if (only && u !== only) continue;
    for (const [k, min] of AP_STEPS) if (L.exp - min * 60000 > now) ntfyCancel(topic, apSeq(L, k));
  }
  if (!only && L.owner?.topic && L.exp > now) ntfyCancel(L.owner.topic, apSeq(L, 'ex'));
}
let apT = null, apBusy = false, apAgain = false;
export function queueApprovals(ms = 2500) { clearTimeout(apT); apT = setTimeout(syncApprovals, ms); }
/**
 * Rappels de validation (programmés une seule fois par lot grâce au registre reminders/ap_…, partagé par les deux parents)
 * et annulation de ceux qui restent quand le lot est validé, refusé, supprimé, renvoyé ou mis en sourdine.
 */
export async function syncApprovals() {
  if (!S.fid || !S.family) return;
  if (apBusy) { apAgain = true; return; }
  apBusy = true;
  try {
    await expiredNotice();
    if (!isParent() || !S.loaded.memories || !S.loaded.docs || !S.loaded.members) return;
    const db = S.be.db, now = Date.now(), live = new Map(), have = new Set();
    for (const g of approvalGroups()) live.set(`ap_${g.grp}_${g.sent}`, g);
    const ledger = await db.list(fpath('reminders'), { where: [['kind', '==', 'ap']] });
    for (const L of ledger) {
      const g = live.get(L.id);
      // lot introuvable ici alors qu'il vient d'être envoyé : pas encore reçu, on attend (sinon : supprimé)
      if (!g && !groupItems(L.sub, L.grp).length && now - (L.at || 0) < 120000) continue;
      if (!g) { cancelSteps(L, null, now); await db.del(fpath('reminders', L.id)).catch(() => { }); continue; }
      have.add(L.id);
      const quiet = Object.keys(L.targets || {}).filter(u => g.items.every(it => it.muted?.[u]));
      if (quiet.length) {
        for (const u of quiet) cancelSteps(L, u, now);
        const targets = { ...L.targets }; for (const u of quiet) delete targets[u];
        await db.update(fpath('reminders', L.id), { targets }).catch(() => { });
      }
    }
    const p = parents();
    for (const [key, g] of live) {
      if (have.has(key) || g.exp <= now) continue;
      const targets = {};
      for (const u of [p.A.uid, p.B.uid]) {
        if (!u || u === g.by || g.items.every(it => it.muted?.[u])) continue;
        const m = S.members.find(x => x.uid === u); if (m?.ntfyOn && m.ntfyTopic) targets[u] = m.ntfyTopic;
      }
      const ow = S.members.find(x => x.uid === g.by), owner = ow?.ntfyOn && ow.ntfyTopic ? { uid: g.by, topic: ow.ntfyTopic } : null;
      const created = await db.createIfAbsent(fpath('reminders', key), { kind: 'ap', sub: g.sub, grp: g.grp, sent: g.sent, exp: g.exp, targets, owner, at: now });
      if (created) scheduleSteps(g, targets, owner, now);
    }
  } catch (e) { console.warn('validation', e?.code || e); }
  finally { apBusy = false; if (apAgain) { apAgain = false; queueApprovals(800); } }
}
/** Mes envois expirés : une entrée dans mon historique (une fois par envoi) */
async function expiredNotice() {
  for (const g of approvalGroups({ expired: true })) {
    if (g.by !== uid()) continue;
    const todo = g.items.filter(it => it.expSeen !== sentAt(it)); if (!todo.length) continue;
    for (const it of todo) await updItem(g.sub, it.id, { expSeen: sentAt(it) }).catch(() => { });
    const pl = g.items.length > 1;
    await log(g.sub === 'docs' ? 'documents' : 'souvenirs', `${subLabel(g.sub, g.items.length)} non validé${pl ? 's' : ''} dans les 48 h${g.title ? ' : ' + g.title : ''}`, { to: 'self', icon: '⌛', body: `À renvoyer depuis ${g.sub === 'docs' ? 'Documents' : 'Souvenirs'}`, link: g.sub });
  }
}
/** Sourdine : plus de rappels pour moi sur ce lot (je peux toujours valider jusqu'à l'expiration) */
export async function muteGroup(sub, grp) {
  const items = groupItems(sub, grp).filter(it => canApprove(it) && !isMuted(it));
  for (const it of items) await updItem(sub, it.id, { [`muted.${uid()}`]: true });
  queueApprovals(400);
  return items.length;
}
/** Renvoi d'un lot expiré : nouvelle demande de validation de 48 h */
export async function resendGroup(sub, grp) {
  const items = groupItems(sub, grp).filter(canResend); if (!items.length) return 0;
  const now = Date.now();
  for (const it of items) await updItem(sub, it.id, { sentAt: now, muted: {} });
  const n = items.length, t = items[0].title;
  await log(sub === 'docs' ? 'documents' : 'souvenirs', `${subLabel(sub, n)} renvoyé${n > 1 ? 's' : ''} pour validation${t ? ' : ' + t : ''}`, { icon: '⏳', body: 'À valider sous 48 h' });
  queueApprovals(400);
  return n;
}
/** Note de liaison qui m'est adressée (les anciennes notes sans destinataires concernent les parents) */
export const noteForMe = n => !n.to || n.to.includes(uid()) || (!n.to.length && n.createdBy === uid());
/** Compte à rebours détaillé à la minute : « dans 1 j 21 h 12 min » */
export function countdown(date, time) {
  const [Y, M, D] = date.split('-').map(Number), [h, m] = time.split(':').map(Number);
  const s = Math.max(0, Math.ceil((new Date(Y, M - 1, D, h, m).getTime() - Date.now()) / 60000));
  if (s < 60) return `dans ${s} min`;
  const d = Math.floor(s / 1440), hh = Math.floor((s % 1440) / 60), mm = s % 60;
  return d ? `dans ${d} j ${hh} h ${String(mm).padStart(2, '0')} min` : `dans ${hh} h ${String(mm).padStart(2, '0')} min`;
}
