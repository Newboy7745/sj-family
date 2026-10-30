// ═══════════════════════════════════════════════════════════════
//  SJ Family — état global, sélecteurs, écriture des données, notifications
// ═══════════════════════════════════════════════════════════════
import * as E from './engine.js';
import { toast, esc } from './ui.js';

export const VERSION = '6.2';
export const APP_URL = 'https://newboy7745.github.io/sj-family/';
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
  contacts: { i: '📞', n: 'Répertoire' },
};
export const PARENT_COLORS = ['#9DC3E6', '#F8CBAD', '#B4D7A8', '#D9C2E9', '#FFE08A', '#A8DADC'];
export const CHILD_EMOJIS = ['👦', '👧', '🧒', '👶', '🧑', '🦁', '🐻', '🦊', '🐼', '🐯', '🚀', '⚽', '🎨', '🦄', '⭐'];

const LS = {
  get(k, d) { try { const v = localStorage.getItem('sjf:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sjf:' + k, JSON.stringify(v)); } catch (e) { /* */ } },
};
export { LS };

export const S = {
  be: null, user: null, profile: null, fid: null, family: null, families: {},
  members: [], invites: [], children: [], plannings: [], exchanges: [], events: [], tasks: [], notes: [],
  expenses: [], docs: [], contacts: [], memories: [], activity: [], loaded: {},
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
export function me() { return S.members.find(m => m.uid === uid()) || { uid: uid(), name: S.profile?.prenom || 'Moi' }; }
export function myCode() { const p = parents(); return p.A.uid === uid() ? 'A' : p.B.uid === uid() ? 'B' : null; }
export const isParent = () => !!myCode();
export function otherParentUid() { const c = myCode(); if (!c) return null; return parents()[E.other(c)].uid; }
export function hasOtherParent() { const o = otherParentUid(); return !!(o && S.members.some(m => m.uid === o)); }
export const myName = () => S.profile ? `${S.profile.prenom || ''}`.trim() || S.user?.email : '';
export const myFullName = () => S.profile ? `${S.profile.prenom || ''} ${S.profile.nom || ''}`.trim() : '';
export function selChildren() { const all = S.children; const s = all.filter(c => S.sel.has(c.id)); return s.length ? s : all; }
export const selIds = () => selChildren().map(c => c.id);
export const childName = id => S.children.find(c => c.id === id)?.prenom || '?';
export const childNames = ids => (ids || []).map(childName).join(' & ');
export function setSel(ids) { S.sel = new Set(ids); LS.set('sel', [...S.sel]); }
export const settings = () => ({ handoverTime: '18:30', middayTime: '14:00', zone: 'B', customHolidays: [], ...(S.family?.settings || {}) });

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

/** Journal d'activité (historique + notifications des autres membres) */
export async function log(cat, title, { body = '', link = null, icon = null } = {}) {
  try {
    const id = S.be.db.newId();
    await S.be.db.set(fpath('activity', id), { cat, title, body, link, icon: icon || CATS[cat]?.i || '🔔', by: uid(), byName: myName(), at: Date.now() });
    pushOthers(`${icon || CATS[cat]?.i || '🔔'} ${title}`, `${myName()}${body ? ' — ' + body : ''}`);
  } catch (e) { console.warn('log', e); }
}

// ───── Notifications push gratuites (ntfy.sh) vers les autres membres
export async function ntfyPublish(topic, { title, message, tags, click, delay }) {
  if (!topic) return;
  const body = { topic, title: String(title || '').slice(0, 200), message: String(message || ' ').slice(0, 1000), click: click || APP_URL };
  if (tags) body.tags = tags; if (delay) body.delay = delay;
  try { await fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify(body) }); } catch (e) { console.warn('ntfy', e); }
}
export function pushOthers(title, message) {
  if (S.be?.mode === 'demo') return;
  for (const m of S.members) if (m.uid !== uid() && m.ntfyOn && m.ntfyTopic) ntfyPublish(m.ntfyTopic, { title, message });
}
/** Rappels de relais programmés (≤ 3 jours à l'avance, sans doublon entre téléphones) */
export async function scheduleReminders() {
  if (!S.fid || S.be?.mode === 'demo' || !S.children.length) return;
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
export async function syncFeed(force = false) {
  const tok = S.family?.widgetToken; if (!tok || !S.children.length) return;
  try {
    const feed = E.buildFeed({
      engine: engine(), family: S.family, children: S.children, parents: parents(),
      events: S.events, tasks: S.tasks, notes: [...S.notes].sort((a, b) => b.at - a.at), includeHealth: !!S.family.widgetHealth, appUrl: APP_URL,
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
