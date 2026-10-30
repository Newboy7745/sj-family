// ═══════════════════════════════════════════════════════════════
//  SJ Family v6 — démarrage, authentification, abonnements, rendu
// ═══════════════════════════════════════════════════════════════
import * as E from './engine.js';
import { createBackend } from './backend.js';
import { S, go, parseHash, LS, uid, parents, myName, errMsg, guard, queueFeed, syncFeed, scheduleReminders, VERSION, APP_URL } from './core.js';
import { $, esc, toast, readForm, IC, closeSheetsThen, sheetDepth, openSheet, closeSheet } from './ui.js';
import * as Home from './views-home.js';
import * as Agenda from './views-agenda.js';
import * as Plan from './views-planning.js';
import * as Exch from './views-exchange.js';
import * as Fam from './views-family.js';
import * as Bud from './views-budget.js';
import * as More from './views-more.js';

const MODS = [Home, Agenda, Plan, Exch, Fam, Bud, More];
const VIEWS = Object.assign({}, ...MODS.map(m => m.views || {}));
const AFTER = Object.assign({}, ...MODS.map(m => m.after || {}));
const ACTIONS = Object.assign({}, ...MODS.map(m => m.actions || {}));
const TAB_OF = { home: 'home', agenda: 'agenda', exchanges: 'echange', family: 'cercle', notifs: 'notifs' };

// ───── Actions communes
Object.assign(ACTIONS, {
  chip(el) {
    const g = el.closest('[data-group]');
    if (g && !g.dataset.multi) g.querySelectorAll('.chip').forEach(c => c !== el && c.classList.remove('on'));
    el.classList.toggle('on', g && !g.dataset.multi ? true : !el.classList.contains('on'));
    g?.dispatchEvent(new CustomEvent('chipchange', { bubbles: true, detail: { val: el.dataset.val, on: el.classList.contains('on') } }));
  },
  'close-sheet': () => closeSheet(),
  back() { if (S.nav > 0) { S.nav--; history.back(); } else go(S.backTo || 'home'); },
  logout: async () => { await guard(() => S.be.auth.signOut()); location.hash = ''; },
});

// ───── Clics délégués
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) {
    e.preventDefault();
    const params = g.dataset.params ? JSON.parse(g.dataset.params) : {};
    const nav = () => { S.nav = (S.nav || 0) + 1; go(g.dataset.go, params); };
    if (sheetDepth()) closeSheetsThen(nav); else nav();
    return;
  }
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled) {
    const fn = ACTIONS[a.dataset.act];
    if (fn) { e.preventDefault(); try { const r = fn(a, e); if (r && r.catch) r.catch(err => { console.error(err); toast(errMsg(err), 'err', 4500); }); } catch (err) { console.error(err); toast(errMsg(err), 'err', 4500); } }
    else console.warn('action inconnue', a.dataset.act);
  }
});
document.addEventListener('change', e => {
  const a = e.target.closest('[data-change]');
  if (a) { const fn = ACTIONS[a.dataset.change]; if (fn) fn(a, e); }
});

// ───── Rendu
let raf = 0, deferred = false;
S.render = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; doRender(); }); };
document.addEventListener('focusout', () => { if (deferred) { deferred = false; setTimeout(S.render, 60); } });
window.addEventListener('hashchange', () => { S.route = parseHash(); window.scrollTo(0, 0); S.render(); });

function lighten(hex, k) {
  const n = parseInt(hex.replace('#', ''), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k);
  return `rgb(${r},${g},${b})`;
}
function darken(hex, k) {
  const n = parseInt(hex.replace('#', ''), 16); return `rgb(${Math.round((n >> 16) * (1 - k))},${Math.round(((n >> 8) & 255) * (1 - k))},${Math.round((n & 255) * (1 - k))})`;
}
function applyColors() {
  const p = parents(), st = document.documentElement.style;
  st.setProperty('--pa', p.A.color); st.setProperty('--pb', p.B.color);
  st.setProperty('--pa-l', lighten(p.A.color, .55)); st.setProperty('--pb-l', lighten(p.B.color, .55));
  st.setProperty('--pa-d', darken(p.A.color, .45)); st.setProperty('--pb-d', darken(p.B.color, .4));
}

function shell(withTabs = true) {
  const app = $('#app');
  if (!app.querySelector('.top') || !app.querySelector('#view') || app.dataset.shell !== String(withTabs)) {
    app.innerHTML = `<header class="top"><div class="top-l"></div><div class="top-t"></div><div class="top-r"></div></header><main id="view"></main>${withTabs ? `
      <nav class="tabs">
        <button class="tab" data-go="home" data-tab="home"><span class="ti">🏠</span>Accueil</button>
        <button class="tab" data-go="agenda" data-tab="agenda"><span class="ti">📅</span>Agenda</button>
        <button class="tab fab" data-go="exchanges" data-tab="echange"><span class="ti">🔄</span>Échange<span class="badge hide" id="bx"></span></button>
        <button class="tab" data-go="family" data-tab="cercle"><span class="ti">👨‍👩‍👧‍👦</span>Cercle</button>
        <button class="tab" data-go="notifs" data-tab="notifs"><span class="ti">🔔</span>Notifs<span class="badge hide" id="bn"></span></button>
      </nav>` : ''}`;
    app.dataset.shell = String(withTabs);
  }
}
function header({ title = '', back = null, actions = true } = {}) {
  const l = $('.top-l'), t = $('.top-t'), r = $('.top-r');
  S.backTo = back;
  l.innerHTML = back ? `<button class="tb" data-act="back" aria-label="Retour">${IC.back}</button>` : `<img class="logo-top" src="logo-top.png" alt="SJ Family" data-go="home">`;
  t.textContent = title;
  const unread = More.unreadCount ? More.unreadCount() : 0;
  const bell = `<button class="tb" data-go="notifs" aria-label="Notifications">🔔${unread ? `<span class="badge">${unread > 99 ? '99+' : unread}</span>` : ''}</button>`;
  r.innerHTML = !actions ? '' : back ? bell : `${bell}<button class="tb" data-go="settings" aria-label="Réglages">⚙️</button><button class="tb" data-go="profile" aria-label="Profil">👤</button>`;
}
function doRender() {
  if (!S.ready) return;
  if (!S.user) return renderAuth();
  if (!S.profile) return renderLoading();
  const ae = document.activeElement, view = $('#view');
  if (ae && view && view.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && S.lastView === S.route.view) { deferred = true; return; }
  const r = S.route;
  if (r.view === 'join' && r.params.code) { LS.set('pendingJoin', r.params.code.toUpperCase()); location.hash = '#/family'; return; }
  if (!S.fid || (!S.family && S.familyGone)) {
    shell(false); header({ title: '', actions: false });
    $('#view').innerHTML = Fam.onboardingHtml();
    S.lastView = 'onboarding';
    Fam.afterOnboarding?.($('#view'));
    return;
  }
  if (!S.family) return renderLoading();
  shell(true);
  const fn = VIEWS[r.view] || VIEWS.home;
  let out;
  try { out = fn(r.params || {}); } catch (e) { console.error(e); out = { title: 'Oups', html: `<div class="card"><b>Une erreur d'affichage est survenue.</b><p class="muted small">${esc(e.message)}</p><button class="btn primary" data-go="home">Retour à l'accueil</button></div>` }; }
  if (typeof out === 'string') out = { html: out };
  header(out);
  const v = $('#view'); v.innerHTML = out.html; S.lastView = r.view;
  const tab = TAB_OF[r.view];
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
  const bn = $('#bn'), bx = $('#bx'), un = More.unreadCount ? More.unreadCount() : 0, px = Exch.pendingForMe ? Exch.pendingForMe() : 0;
  if (bn) { bn.textContent = un > 99 ? '99+' : un; bn.classList.toggle('hide', !un); }
  if (bx) { bx.textContent = px; bx.classList.toggle('hide', !px); }
  try { AFTER[r.view]?.(v, r.params || {}); } catch (e) { console.error(e); }
}
function renderLoading() { shell(false); header({ actions: false }); $('#view').innerHTML = '<div class="boot"><div class="spin"></div></div>'; }

// ───── Connexion / inscription
function renderAuth() {
  const mode = S.authMode || 'login';
  const app = $('#app'); app.dataset.shell = 'auth';
  const L = (n, l, t = 'text', ac = '', ph = '') => `<label class="lbl">${l}</label><input class="in" name="${n}" type="${t}" ${ac ? `autocomplete="${ac}"` : ''} placeholder="${ph}">`;
  let body;
  if (mode === 'login') body = `<h2>Connexion</h2>${L('email', 'E-mail', 'email', 'email', 'vous@exemple.fr')}${L('pw', 'Mot de passe', 'password', 'current-password')}
    <button class="btn primary block mt2" data-act="auth-login">Se connecter</button>
    <div class="sw2"><a href="#" data-act="auth-mode" data-m="reset">Mot de passe oublié ?</a></div>
    <div class="sw2">Pas encore de compte ? <a href="#" data-act="auth-mode" data-m="register">Créer un compte</a></div>`;
  else if (mode === 'register') body = `<h2>Créer un compte</h2>
    <div class="two"><div>${L('prenom', 'Prénom', 'text', 'given-name')}</div><div>${L('nom', 'Nom', 'text', 'family-name')}</div></div>
    ${L('phone', 'Téléphone', 'tel', 'tel', '06 12 34 56 78')}${L('email', 'E-mail', 'email', 'email', 'vous@exemple.fr')}
    ${L('pw', 'Mot de passe (6 caractères min.)', 'password', 'new-password')}${L('pw2', 'Confirmer le mot de passe', 'password', 'new-password')}
    <button class="btn primary block mt2" data-act="auth-register">Créer mon compte</button>
    <div class="sw2">Déjà inscrit ? <a href="#" data-act="auth-mode" data-m="login">Se connecter</a></div>`;
  else body = `<h2>Mot de passe oublié</h2><p class="muted center small">Recevez un lien de réinitialisation par e-mail.</p>${L('email', 'E-mail', 'email', 'email')}
    <button class="btn primary block mt2" data-act="auth-reset">Envoyer le lien</button>
    <div class="sw2"><a href="#" data-act="auth-mode" data-m="login">Retour à la connexion</a></div>`;
  app.innerHTML = `<div class="auth"><img class="logo-full" src="logo-full.png" alt="SJ Family"><div class="tag">La garde partagée, simple et sereine</div>
    <form class="box" onsubmit="return false">${body}</form><div class="ver">SJ Family ${VERSION}${S.be?.mode === 'demo' ? ' · mode démo' : ''}</div></div>`;
}
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
Object.assign(ACTIONS, {
  'auth-mode': el => { S.authMode = el.dataset.m; renderAuth(); },
  'auth-login': async el => {
    const f = readForm(el.closest('form'));
    if (!emailOk(f.email) || !f.pw) return toast('Saisissez votre e-mail et votre mot de passe.', 'warn');
    el.disabled = true;
    try { await S.be.auth.signIn(f.email, f.pw); } catch (e) { toast(errMsg(e), 'err', 4000); el.disabled = false; }
  },
  'auth-register': async el => {
    const f = readForm(el.closest('form'));
    if (!f.prenom || !f.nom) return toast('Prénom et nom obligatoires.', 'warn');
    if (f.phone.replace(/\D/g, '').length < 10) return toast('Numéro de téléphone invalide.', 'warn');
    if (!emailOk(f.email)) return toast('Adresse e-mail invalide.', 'warn');
    if (f.pw.length < 6) return toast('Mot de passe : 6 caractères minimum.', 'warn');
    if (f.pw !== f.pw2) return toast('Les mots de passe ne correspondent pas.', 'warn');
    el.disabled = true;
    try {
      S.signingUp = { prenom: f.prenom, nom: f.nom.toUpperCase(), phone: f.phone, email: f.email.toLowerCase() };
      const u = await S.be.auth.signUp(f.email, f.pw);
      await S.be.db.set(`users/${u.uid}`, { ...S.signingUp, familyIds: [], currentFamily: null, createdAt: Date.now() }, true);
      S.signingUp = null; toast(`Bienvenue ${f.prenom} !`);
    } catch (e) { S.signingUp = null; toast(errMsg(e), 'err', 4500); el.disabled = false; }
  },
  'auth-reset': async el => {
    const f = readForm(el.closest('form'));
    if (!emailOk(f.email)) return toast('Adresse e-mail invalide.', 'warn');
    await guard(() => S.be.auth.reset(f.email), 'Lien envoyé, vérifiez votre boîte mail (et les spams).');
    S.authMode = 'login'; renderAuth();
  },
});

// ───── Abonnements Firestore
const SUBS = ['members', 'invites', 'children', 'plannings', 'exchanges', 'events', 'tasks', 'notes', 'expenses', 'docs', 'contacts', 'memories'];
const FEED_SUBS = new Set(['children', 'plannings', 'exchanges', 'events', 'tasks', 'notes']);
let unUser = null, unFam = [];
function resetFamily() {
  unFam.forEach(f => { try { f(); } catch (e) { /* */ } }); unFam = [];
  for (const s of SUBS) S[s] = []; S.activity = []; S.family = null; S.loaded = {}; S.familyGone = false;
}
function attachFamily(fid) {
  resetFamily(); S.fid = fid; if (!fid) return;
  const db = S.be.db;
  unFam.push(db.listenDoc(`families/${fid}`, f => {
    S.family = f; S.familyGone = !f;
    if (f) applyColors();
    S.render(); queueFeed();
  }, err => { console.warn('famille', err); S.familyGone = true; S.render(); }));
  for (const sub of SUBS) unFam.push(db.listenCol(`families/${fid}/${sub}`, rows => {
    if (sub === 'children') rows.sort((a, b) => (a.birth || '9').localeCompare(b.birth || '9') || (a.createdAt || 0) - (b.createdAt || 0));
    S[sub] = rows; S.loaded[sub] = true; S.render();
    if (FEED_SUBS.has(sub)) queueFeed();
    if (sub === 'members' && !S.remindersDone && S.loaded.plannings) { S.remindersDone = true; setTimeout(scheduleReminders, 4000); }
  }, null, err => console.warn(sub, err)));
  unFam.push(db.listenCol(`families/${fid}/activity`, rows => { S.activity = rows; S.loaded.activity = true; S.render(); }, { orderBy: ['at', 'desc'], limit: 300 }, err => console.warn('activity', err)));
}
async function loadFamilyNames(ids = []) {
  for (const id of ids) if (!S.families[id]) {
    try { const f = await S.be.db.get(`families/${id}`); S.families[id] = f ? { id, name: f.name, childNames: '' } : { id, name: '(cercle indisponible)', gone: true }; }
    catch (e) { S.families[id] = { id, name: '(accès refusé)', gone: true }; }
  }
  S.render();
}

async function start() {
  const demo = new URLSearchParams(location.search).has('demo') || LS.get('demo', false);
  if (demo) LS.set('demo', true);
  try { S.be = await createBackend(demo ? 'demo' : 'firebase'); }
  catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="card" style="margin-top:30px"><h3>Connexion impossible</h3><p class="muted">Le service n'a pas pu être chargé. Vérifiez votre connexion internet puis réessayez.</p><button class="btn primary block" onclick="location.reload()">Réessayer</button></div>`;
    return;
  }
  S.route = parseHash();
  S.ready = true;
  S.be.auth.onChange(u => {
    S.user = u;
    if (unUser) { unUser(); unUser = null; }
    resetFamily(); S.fid = null; S.profile = null; S.families = {}; S.remindersDone = false;
    if (!u) { S.render(); return; }
    renderLoading();
    unUser = S.be.db.listenDoc(`users/${u.uid}`, async p => {
      if (!p) {
        if (S.signingUp) return; // le document est en cours de création
        await S.be.db.set(`users/${u.uid}`, { email: u.email, prenom: (u.email || '').split('@')[0], nom: '', phone: '', familyIds: [], currentFamily: null, createdAt: Date.now() }, true);
        return;
      }
      S.profile = p;
      const fid = p.currentFamily && (p.familyIds || []).includes(p.currentFamily) ? p.currentFamily : (p.familyIds || [])[0] || null;
      if (fid !== S.fid) attachFamily(fid);
      loadFamilyNames(p.familyIds || []);
      S.render();
    }, err => { console.warn('profil', err); toast(errMsg(err), 'err', 6000); });
  });
  // maintenance périodique : flux widgets (glissement des dates) + rappels
  setInterval(() => { if (S.family) { syncFeed(); scheduleReminders(); } }, 60 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.family) { S.render(); queueFeed(); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
}
start();
window.SJF = { S, E, go, syncFeed, version: VERSION, APP_URL };
