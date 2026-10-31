// ═══════════════════════════════════════════════════════════════
//  SJ Family — état global, sélecteurs, écriture des données, notifications
// ═══════════════════════════════════════════════════════════════
import * as E from './engine.js?v=6.5';
import { toast, esc } from './ui.js?v=6.5';

export const VERSION = '6.5';
export const APP_URL = 'https://newboy7745.github.io/sj-family/';
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
  members: [], invites: [], children: [], childInfo: [], plannings: [], exchanges: [], events: [], tasks: [], notes: [],
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
  const p = S.family?.parents || {};
  return {
    A: { uid: p.A?.uid || null, name: p.A?.name || 'Parent 1', short: p.A?.short || p.A?.name || 'Parent 1', color: p.A?.color || PARENT_COLORS[0], phone: p.A?.phone || '', email: p.A?.email || '' },
    B: { uid: p.B?.uid || null, name: p.B?.name || 'Parent 2', short: p.B?.short || p.B?.name || 'Parent 2', color: p.B?.color || PARENT_COLORS[1], phone: p.B?.phone || '', email: p.B?.email || '' },
  };
}
export const pName = c => parents()[c]?.name || '—';
export const pShort = c => parents()[c]?.short || '—';
export const pColor = c => parents()[c]?.color || '#ddd';
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
  const m = S.members.find(x => x.uid === u); return m ? (m.prenom || m.name || 'Proche') : 'Proche';
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
export async function log(cat, title, { body = '', link = null, icon = null, to = 'parents', push = null } = {}) {
  try {
    const id = S.be.db.newId(), at = Date.now(), ic = icon || CATS[cat]?.i || '🔔';
    const rcpt = audience(to);
    const item = { cat, title, body, link, icon: ic, by: uid(), byName: myName(), at };
    await Promise.all(rcpt.map(r => S.be.db.set(`families/${S.fid}/inbox/${r}/items/${id}`, item)));
    const pushList = (push || rcpt).filter(r => r !== uid());
    pushTo(pushList, `${ic} ${title}`, `${myName()}${body ? ' — ' + body : ''}`);
  } catch (e) { console.warn('log', e); }
}

// ───── Notifications push gratuites (ntfy.sh) vers les autres membres
export async function ntfyPublish(topic, { title, message, tags, click, delay }) {
  if (!topic) return;
  const body = { topic, title: String(title || '').slice(0, 200), message: String(message || ' ').slice(0, 1000), click: click || APP_URL };
  if (tags) body.tags = tags; if (delay) body.delay = delay;
  try { await fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify(body) }); } catch (e) { console.warn('ntfy', e); }
}
/** Notifications push vers des membres précis (les sujets ntfy des autres ne sont connus que des parents) */
export function pushTo(uids, title, message) {
  if (S.be?.mode === 'demo') return;
  for (const u of uids) { const m = S.members.find(x => x.uid === u); if (m && m.uid !== uid() && m.ntfyOn && m.ntfyTopic) ntfyPublish(m.ntfyTopic, { title, message }); }
}
/** Rappels de relais programmés (≤ 3 jours à l'avance, sans doublon entre téléphones) */
export async function scheduleReminders() {
  if (!S.fid || S.be?.mode === 'demo' || !S.children.length || !isParent()) return;
  const today = E.todayISO(), eng = engine();
  const hs = eng.handovers(S.children.map(c => c.id), today, E.addDays(today, 2));
  const now = Date.now();
  for (const h of hs) {
    const [Y, M, D] = h.date.split('-').map(Number), [hh, mm] = h.time.split(':').map(Number);
    const at = new Date(Y, M - 1, D, hh, mm).getTime();
    for (const m of S.members) {
      if (!m.ntfyOn || !m.ntfyTopic || !m.parentCode || m.remind === 'off') continue;
      const before = (+m.remind || 120) * 60000, when = at - before;
      if (when < now + 60000 || when > now + 70 * 3600000) continue;
      const key = `${h.date}_${h.time.replace(':', '')}_${h.to}_${m.uid}`;
      try {
        const created = await S.be.db.createIfAbsent(fpath('reminders', key), { at: when, uid: m.uid, createdAt: now });
        if (!created) continue;
        const mine = h.to === m.parentCode ? `Récupération de ${childNames(h.childIds)}` : `Remise de ${childNames(h.childIds)} à ${pName(h.to)}`;
        ntfyPublish(m.ntfyTopic, { title: `🔁 Relais ${E.relDay(h.date)} à ${E.fmtTime(h.time)}`, message: `${mine}${h.place ? ' — ' + h.place : ''}`, delay: String(Math.round(when / 1000)), tags: ['bell'] });
      } catch (e) { console.warn('reminder', e); }
    }
  }
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
      events: S.events, tasks: par ? S.tasks : [], notes: par ? [...S.notes].sort((a, b) => b.at - a.at) : [],
      includeHealth: par && !!(S.priv?.widgetHealth ?? S.family?.widgetHealth), appUrl: APP_URL,
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
