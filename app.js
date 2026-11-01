// ═══════════════════════════════════════════════════════════════
//  SJ Family v6 — démarrage, authentification, abonnements, rendu
// ═══════════════════════════════════════════════════════════════
import * as E from './engine.js?v=6.11';
import { createBackend } from './backend.js?v=6.11';
import { S, go, parseHash, LS, uid, parents, myName, errMsg, guard, queueFeed, syncFeed, scheduleReminders, queueApprovals, VERSION, APP_URL, ADMIN_EMAIL, ADMIN_ALIASES, isAdminUser, stat, isParent, can, LEGACY_T0, CHILD_DETAIL_KEYS, setFamily, log } from './core.js?v=6.11';
import { $, esc, toast, readForm, IC, closeSheetsThen, sheetDepth, openSheet, closeSheet, confirmBox } from './ui.js?v=6.11';
import * as Home from './views-home.js?v=6.11';
import * as Agenda from './views-agenda.js?v=6.11';
import * as Plan from './views-planning.js?v=6.11';
import * as Exch from './views-exchange.js?v=6.11';
import * as Fam from './views-family.js?v=6.11';
import * as Bud from './views-budget.js?v=6.11';
import * as More from './views-more.js?v=6.11';
import * as Admin from './views-admin.js?v=6.11';
import * as Install from './install.js?v=6.11';
import * as Sac from './views-sac.js?v=6.11';
import * as Print from './print.js?v=6.11';

const MODS = [Home, Agenda, Plan, Exch, Fam, Bud, More, Admin, Install, Sac, Print];
const VIEWS = Object.assign({}, ...MODS.map(m => m.views || {}));
const AFTER = Object.assign({}, ...MODS.map(m => m.after || {}));
const ACTIONS = Object.assign({}, ...MODS.map(m => m.actions || {}));
const TAB_OF = { home: 'home', agenda: 'agenda', exchanges: 'echange', family: 'cercle', sac: 'sac', sacl: 'sac', sacperm: 'sac', memories: 'souvenirs', liaison: 'liaison' };

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
  logout: async () => {
    if (S.acc === 'test') { LS.set('acc', 'main'); location.hash = '#/home'; location.reload(); return; }
    if (!(await confirmBox('Se déconnecter ?', 'Vous devrez saisir à nouveau votre e-mail et votre mot de passe.', 'Se déconnecter', true))) return;
    await guard(() => S.be.auth.signOut()); location.hash = '';
  },
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
function checkSetupLink() {
  if (parseHash().view !== 'setup' || !/[?&]k=/.test(location.hash)) return false;
  S.setup = { data: Admin.readSetupPayload(), state: 'confirm', log: [] };
  history.replaceState(null, '', location.pathname + location.search + '#/setup'); // efface les informations du lien de l'historique
  return true;
}
window.addEventListener('hashchange', () => { checkSetupLink(); S.route = parseHash(); window.scrollTo(0, 0); S.render(); });

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

function tabsHtml() {
  // Parents : Accueil · Agenda · Échange · Cercle · Sac — Proches : Accueil · Agenda · Souvenirs · Liaison · Cercle
  if (isParent()) return `
      <button class="tab" data-go="home" data-tab="home"><span class="ti">🏠</span>Accueil</button>
      <button class="tab" data-go="agenda" data-tab="agenda"><span class="ti">📅</span>Agenda</button>
      <button class="tab fab" data-go="exchanges" data-tab="echange"><span class="ti">🔄</span>Échange<span class="badge hide" id="bx"></span></button>
      <button class="tab" data-go="family" data-tab="cercle"><span class="ti">👨‍👩‍👧‍👦</span>Cercle</button>
      <button class="tab" data-go="sac" data-tab="sac"><span class="ti">🎒</span>Sac<span class="badge hide" id="bs"></span></button>`;
  return `
      <button class="tab" data-go="home" data-tab="home"><span class="ti">🏠</span>Accueil</button>
      <button class="tab" data-go="agenda" data-tab="agenda"><span class="ti">📅</span>Agenda</button>
      <button class="tab fab" data-go="memories" data-tab="souvenirs"><span class="ti">📸</span>Souvenirs</button>
      <button class="tab" data-go="liaison" data-tab="liaison"><span class="ti">📒</span>Liaison<span class="badge hide" id="bl"></span></button>
      <button class="tab" data-go="family" data-tab="cercle"><span class="ti">👨‍👩‍👧‍👦</span>Cercle</button>`;
}
function shell(withTabs = true) {
  const app = $('#app'), key = withTabs ? (isParent() ? 'P' : 'R') : 'none';
  if (!app.querySelector('.top') || !app.querySelector('#view') || app.dataset.shell !== key) {
    app.innerHTML = `<header class="top"><div class="top-l"></div><div class="top-t"></div><div class="top-r"></div></header><div id="tbar"></div><main id="view"></main>${withTabs ? `<nav class="tabs">${tabsHtml()}</nav>` : ''}`;
    app.dataset.shell = key;
  }
}
/** Barre du haut identique sur toutes les pages : Notifications · Réglages · Profil · Déconnexion */
function header({ title = '', back = null, actions = true } = {}) {
  const l = $('.top-l'), t = $('.top-t'), r = $('.top-r');
  S.backTo = back;
  l.innerHTML = back ? `<button class="tb" data-act="back" aria-label="Retour">${IC.back}</button>` : `<img class="logo-top" src="logo-top.png" alt="SJ Family" data-go="home">`;
  t.textContent = title;
  $('.top').classList.toggle('sub', !!back);
  const unread = More.unreadCount ? More.unreadCount() : 0;
  r.innerHTML = !actions ? '' : `<button class="tb" data-go="notifs" aria-label="Notifications">🔔${unread ? `<span class="badge">${unread > 99 ? '99+' : unread}</span>` : ''}</button>
    <button class="tb" data-go="settings" aria-label="Réglages">⚙️</button><button class="tb" data-go="profile" aria-label="Profil">👤</button>
    <button class="tb lo" data-act="logout" aria-label="Se déconnecter">${IC.logout}</button>`;
}
function doRender() {
  if (!S.ready) return;
  if (S.setup) return renderSetup();
  if (!S.user) return renderAuth();
  if (isAdminUser()) return renderAdmin();
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
  if (r.params?.n && S.fid && (!r.params.fam || r.params.fam === S.fid) && S.ui.nOpen !== r.params.n) { S.ui.nOpen = r.params.n; More.markRead(r.params.n); }
  if (r.params?.fam && r.params.fam !== S.fid && (S.profile?.familyIds || []).includes(r.params.fam) && S.ui.famJump !== r.params.fam) {
    S.ui.famJump = r.params.fam; S.be.db.update(`users/${uid()}`, { currentFamily: r.params.fam }).catch(() => { }); return renderLoading();
  }
  shell(true);
  const fn = VIEWS[r.view] || VIEWS.home;
  let out;
  try { out = fn(r.params || {}); } catch (e) { console.error(e); out = { title: 'Oups', html: `<div class="card"><b>Une erreur d'affichage est survenue.</b><p class="muted small">${esc(e.message)}</p><button class="btn primary" data-go="home">Retour à l'accueil</button></div>` }; }
  if (typeof out === 'string') out = { html: out };
  header(out);
  const v = $('#view'), tbar = $('#tbar'); v.innerHTML = out.html; S.lastView = r.view;
  if (tbar) { const b = testBanner(); if (tbar.innerHTML !== b) tbar.innerHTML = b; }
  { const tp = $('.top'), tb = $('.tabs'), st = document.documentElement.style, hh = tp?.offsetHeight || 68;
    st.setProperty('--hdr-h', hh + 'px'); st.setProperty('--top-h', (hh + (tbar?.offsetHeight || 0)) + 'px');
    st.setProperty('--tabs-h', (tb && getComputedStyle(tb).display !== 'none' ? tb.offsetHeight : 0) + 'px'); }
  const tab = TAB_OF[r.view];
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
  const bx = $('#bx'), bs = $('#bs'), bl = $('#bl'), px = Exch.pendingForMe ? Exch.pendingForMe() : 0, ps = Sac.pendingCount ? Sac.pendingCount() : 0, pl = More.unreadNotes ? More.unreadNotes() : 0;
  if (bx) { bx.textContent = px; bx.classList.toggle('hide', !px); }
  if (bs) { bs.textContent = ps; bs.classList.toggle('hide', !ps); }
  if (bl) { bl.textContent = pl; bl.classList.toggle('hide', !pl); }
  try { AFTER[r.view]?.(v, r.params || {}); } catch (e) { console.error(e); }
}
/** Bandeau du mode test : session Maman TEST, ou cercle de test ouvert */
function testBanner() {
  const t = LS.get('testAcc', null), me = S.user?.email || '';
  if (/^maman\.test\./.test(me)) return `<div class="testbar"><span>🧪 Vous êtes <b>Maman TEST</b></span><button class="btn soft sm" data-act="test-back">Revenir à mon compte</button></div>`;
  if (t && S.fid === t.fid) return `<div class="testbar"><span>🧪 Cercle de test</span><button class="btn soft sm" data-act="fam-switch" data-id="${t.realFid || ''}">Mon vrai cercle</button></div>`;
  return '';
}
function renderAdmin() {
  shell(false); header({ title: 'Administration', actions: false });
  $('.top-r').innerHTML = `<button class="tb lo" data-act="logout" aria-label="Déconnexion">${IC.logout}</button>`;
  $('#view').innerHTML = Admin.adminHtml(); S.lastView = 'admin';
}
function renderSetup() {
  const app = $('#app'); app.dataset.shell = 'auth';
  app.innerHTML = `<div class="auth"><img class="logo-full" src="logo-full.png" alt="SJ Family"><div class="box">${Admin.setupHtml()}</div></div>`;
}
function renderLoading() { shell(false); header({ actions: false }); $('#view').innerHTML = '<div class="boot"><div class="spin"></div></div>'; }

// ───── Connexion / inscription
function renderAuth() {
  const mode = S.authMode || 'login';
  const app = $('#app'); app.dataset.shell = 'auth';
  // autocomplete : « username » = seuls les identifiants déjà enregistrés pour CE site sont proposés ; « off » ailleurs
  const L = (n, l, t = 'text', ac = 'off', ph = '', val = '') => `<label class="lbl">${l}</label><input class="in" name="${n}" type="${t}" autocomplete="${ac}" autocapitalize="${t === 'email' ? 'off' : 'sentences'}" spellcheck="false" placeholder="${ph}" value="${esc(val)}">`;
  let body;
  if (mode === 'login') body = `<h2>Connexion</h2>${L('email', 'E-mail', 'email', 'username', 'vous@exemple.fr', S.authEmail || '')}${L('pw', 'Mot de passe', 'password', 'current-password')}
    <button class="btn primary block mt2" data-act="auth-login">Se connecter</button>
    ${S.adminFail ? `<div class="alert mt"><div class="ai">🛡️</div><div class="small">Compte admin introuvable ou mot de passe incorrect.<br><a href="#" class="lnk" data-act="auth-admin-create">Créer le compte admin</a> · <a href="#" class="lnk" data-act="auth-mode" data-m="reset">Mot de passe oublié</a></div></div>` : ''}
    <div class="sw2"><a href="#" data-act="auth-mode" data-m="reset">Mot de passe oublié ?</a></div>
    <div class="sw2">Pas encore de compte ? <a href="#" data-act="auth-mode" data-m="register">Créer un compte</a></div>`;
  else if (mode === 'register') body = `<h2>Créer un compte</h2>
    <div class="two"><div>${L('prenom', 'Prénom', 'text', 'off')}</div><div>${L('nom', 'Nom', 'text', 'off')}</div></div>
    ${L('phone', 'Téléphone', 'tel', 'off', '06 12 34 56 78')}${L('email', 'E-mail', 'email', 'username', 'vous@exemple.fr')}
    ${L('pw', 'Mot de passe (6 caractères min.)', 'password', 'new-password')}${L('pw2', 'Confirmer le mot de passe', 'password', 'new-password')}
    <button class="btn primary block mt2" data-act="auth-register">Créer mon compte</button>
    <div class="sw2">Déjà inscrit ? <a href="#" data-act="auth-mode" data-m="login">Se connecter</a></div>`;
  else body = `<h2>Mot de passe oublié</h2><p class="muted center small">Recevez un lien de réinitialisation par e-mail.</p>${L('email', 'E-mail', 'email', 'username', '', S.authEmail || '')}
    <button class="btn primary block mt2" data-act="auth-reset">Envoyer le lien</button>
    <div class="sw2"><a href="#" data-act="auth-mode" data-m="login">Retour à la connexion</a></div>`;
  app.innerHTML = `<div class="auth"><img class="logo-full" src="logo-full.png" alt="SJ Family"><div class="tag">La garde partagée, simple et sereine</div>
    <form class="box" autocomplete="off" onsubmit="return false">${body}</form>${Install.installButtons({ dark: true })}
    ${S.be?.mode === 'demo' ? '<div class="ver">mode démo</div>' : ''}</div>`;
}
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isAlias = e => ADMIN_ALIASES.includes(String(e || '').trim().toLowerCase());
const isAdminMail = e => isAlias(e) || String(e || '').trim().toLowerCase() === ADMIN_EMAIL;
Object.assign(ACTIONS, {
  'auth-mode': el => { const f = $('.auth form') ? readForm($('.auth form')) : {}; if (f.email) S.authEmail = f.email; S.authMode = el.dataset.m; S.adminFail = false; renderAuth(); },
  'auth-login': async el => {
    const f = readForm(el.closest('form')), alias = isAlias(f.email);
    const email = alias ? ADMIN_EMAIL : f.email.trim().toLowerCase();
    if (!emailOk(email) || !f.pw) return toast('Saisissez votre e-mail et votre mot de passe.', 'warn');
    el.disabled = true; S.authEmail = f.email; S.adminFail = false;
    try { await S.be.auth.signIn(email, f.pw); S.authEmail = ''; }
    catch (e) {
      el.disabled = false;
      if (alias || email === ADMIN_EMAIL) { S.adminFail = true; S.adminPw = f.pw; renderAuth(); }
      toast(errMsg(e), 'err', 4000);
    }
  },
  'auth-admin-create': async () => {
    const pw = S.adminPw || '';
    if (pw.length < 6) return toast('Saisissez le mot de passe admin (6 caractères min.).', 'warn');
    try { await S.be.auth.signUp(ADMIN_EMAIL, pw); try { await S.be.auth.sendVerification(); } catch (x) { /* */ } S.adminFail = false; S.adminPw = null; toast(`Compte admin créé. Confirmez l'e-mail envoyé à ${ADMIN_EMAIL}.`, 'ok', 5000); }
    catch (e) { toast(String(e?.code || '').includes('email-already-in-use') ? 'Le compte admin existe déjà : mot de passe incorrect. Utilisez « Mot de passe oublié ».' : errMsg(e), 'err', 5000); }
  },
  'auth-register': async el => {
    const f = readForm(el.closest('form'));
    if (!f.prenom || !f.nom) return toast('Prénom et nom obligatoires.', 'warn');
    if (f.phone.replace(/\D/g, '').length < 10) return toast('Numéro de téléphone invalide.', 'warn');
    if (!emailOk(f.email)) return toast('Adresse e-mail invalide.', 'warn');
    if (isAdminMail(f.email)) return toast('Cette adresse est réservée au mode administrateur. Utilisez une autre adresse pour votre compte parent.', 'warn', 5000);
    if (f.pw.length < 6) return toast('Mot de passe : 6 caractères minimum.', 'warn');
    if (f.pw !== f.pw2) return toast('Les mots de passe ne correspondent pas.', 'warn');
    el.disabled = true;
    try {
      S.signingUp = { prenom: f.prenom, nom: f.nom.toUpperCase(), phone: f.phone, email: f.email.toLowerCase() };
      const u = await S.be.auth.signUp(f.email, f.pw);
      await S.be.db.set(`users/${u.uid}`, { ...S.signingUp, familyIds: [], currentFamily: null, createdAt: Date.now() }, true);
      stat('users');
      S.signingUp = null; toast(`Bienvenue ${f.prenom} !`);
    } catch (e) { S.signingUp = null; toast(errMsg(e), 'err', 4500); el.disabled = false; }
  },
  'auth-reset': async el => {
    const f = readForm(el.closest('form')), email = isAlias(f.email) ? ADMIN_EMAIL : f.email.trim().toLowerCase();
    if (!emailOk(email)) return toast('Adresse e-mail invalide.', 'warn');
    await guard(() => S.be.auth.reset(email), `Lien envoyé${isAlias(f.email) ? ' à ' + ADMIN_EMAIL : ''}, vérifiez votre boîte mail (et les spams).`);
    S.authMode = 'login'; S.adminFail = false; renderAuth();
  },
});

// ───── Abonnements Firestore (selon le rôle : parent = tout le cercle, proche = agenda, souvenirs, ses notes + rubriques autorisées)
const SUBS = ['members', 'invites', 'children', 'childInfo', 'plannings', 'exchanges', 'events', 'tasks', 'notes', 'expenses', 'docs', 'contacts', 'memories', 'sac', 'sacRuns'];
const AP_SUBS = new Set(['memories', 'docs', 'memoriesMine', 'docsMine', 'members']);
const FEED_SUBS = new Set(['children', 'childInfo', 'plannings', 'exchanges', 'events', 'tasks', 'notes']);
let unUser = null, unFam = [], unData = [];
function stopData() { unData.forEach(f => { try { f(); } catch (e) { /* */ } }); unData = []; S.dataKey = ''; }
function resetFamily() {
  stopData();
  unFam.forEach(f => { try { f(); } catch (e) { /* */ } }); unFam = [];
  for (const s of SUBS) S[s] = []; S.activity = []; S.legacy = []; S.family = null; S.meMember = null; S.priv = null; S.loaded = {}; S.familyGone = false; S.migrated = false;
}
function sortKids(rows) { return rows.sort((a, b) => (a.birth || '9').localeCompare(b.birth || '9') || (a.createdAt || 0) - (b.createdAt || 0)); }
function listenSub(sub, path, opts = null, into = null) {
  unData.push(S.be.db.listenCol(path, rows => {
    if (into) { into(rows); } else { S[sub] = sub === 'children' ? sortKids(rows) : rows; }
    S.loaded[sub] = true; S.render();
    if (FEED_SUBS.has(sub)) queueFeed();
    if (sub === 'members' && !S.remindersDone && S.loaded.plannings) { S.remindersDone = true; setTimeout(scheduleReminders, 4000); }
    if (isParent()) scheduleMigrate();
    if (AP_SUBS.has(sub)) queueApprovals();
    if (sub === 'sac' || sub === 'members') Sac.queueSacReminders();
  }, opts, err => { console.warn(sub, err?.code || err); S.loaded[sub] = true; S.render(); }));
}
/** (Ré)abonne les données quand le rôle ou les autorisations changent */
function ensureData() {
  if (!S.family || !S.fid) return;
  const par = isParent(), perms = S.meMember?.perms || {};
  if (!par && !S.loaded.me) return; // attendre sa fiche membre (autorisations)
  const key = par ? 'P' : 'R' + JSON.stringify(perms);
  if (key === S.dataKey) return;
  stopData(); S.dataKey = key;
  const fid = S.fid, me = uid(), P = sub => `families/${fid}/${sub}`;
  for (const sub of SUBS) S[sub] = [];
  if (par) {
    for (const sub of SUBS) listenSub(sub, P(sub));
    unData.push(S.be.db.listenDoc(`families/${fid}/private/main`, d => { S.priv = d; S.loaded.priv = true; S.render(); queueFeed(); scheduleMigrate(); }, err => { console.warn('private', err?.code || err); S.loaded.priv = true; }));
    // ancien journal commun (avant les historiques personnels)
    unData.push(S.be.db.listenCol(P('activity'), rows => { S.legacy = rows; S.render(); }, { where: [['at', '<', LEGACY_T0]], orderBy: ['at', 'desc'], limit: 150 }, err => console.warn('legacy', err?.code || err)));
  } else {
    for (const sub of ['children', 'plannings', 'events']) listenSub(sub, P(sub));
    // souvenirs et documents : publiés (validés) + les siens en attente
    const pubMine = (sub) => { let a = [], b = []; const m = () => { const x = new Map(); for (const r of [...a, ...b]) x.set(r.id, r); S[sub] = [...x.values()]; };
      listenSub(sub, P(sub), { where: [['pub', '==', true]] }, rows => { a = rows; m(); }); listenSub(sub + 'Mine', P(sub), { where: [['createdBy', '==', me]] }, rows => { b = rows; m(); }); };
    pubMine('memories');
    listenSub('exchanges', P('exchanges'), { where: [['state', '==', 'accepted']] });
    let toMe = [], byMe = [];
    const mergeNotes = () => { const m = new Map(); for (const n of [...toMe, ...byMe]) m.set(n.id, n); S.notes = [...m.values()]; };
    listenSub('notes', P('notes'), { where: [['to', 'array-contains', me]] }, rows => { toMe = rows; mergeNotes(); });
    listenSub('notesMine', P('notes'), { where: [['createdBy', '==', me]] }, rows => { byMe = rows; mergeNotes(); });
    if (perms.docs) pubMine('docs');
    for (const sub of ['tasks', 'contacts', 'expenses']) if (perms[sub]) listenSub(sub, P(sub));
    if (perms.sac) { listenSub('sac', P('sac')); listenSub('sacRuns', P('sacRuns')); }
  }
}
function attachFamily(fid) {
  resetFamily(); S.fid = fid; if (!fid) return;
  const db = S.be.db, me = uid();
  unFam.push(db.listenDoc(`families/${fid}`, f => {
    S.family = f; S.familyGone = !f;
    if (f) { applyColors(); ensureData(); }
    S.render(); queueFeed();
  }, err => { console.warn('famille', err); S.familyGone = true; S.render(); }));
  unFam.push(db.listenDoc(`families/${fid}/members/${me}`, m => { S.meMember = m; S.loaded.me = true; ensureData(); S.render(); }, err => { console.warn('membre', err?.code || err); S.loaded.me = true; ensureData(); }));
  unFam.push(db.listenCol(`families/${fid}/inbox/${me}/items`, rows => { S.activity = rows; S.loaded.activity = true; S.render(); }, { orderBy: ['at', 'desc'], limit: 300 }, err => console.warn('inbox', err?.code || err)));
}

/** Mises à niveau ponctuelles faites par un parent (une fois les données chargées) */
let migT = null;
function scheduleMigrate() { clearTimeout(migT); migT = setTimeout(migrate, 2500); }
async function migrate() {
  if (!isParent() || S.migrating) return;
  const f = S.family; if (!f) return;
  S.migrating = true;
  const db = S.be.db, fid = S.fid;
  try {
    // 1) jeton des widgets → document privé des parents
    if (f.widgetToken && S.loaded.priv) {
      if (!S.priv?.widgetToken) await db.set(`families/${fid}/private/main`, { widgetToken: f.widgetToken, widgetHealth: !!f.widgetHealth }, true);
      await db.update(`families/${fid}`, { widgetToken: db.deleteField(), widgetHealth: db.deleteField() });
    }
    // 2) fiches détaillées des enfants (école, santé…) → childInfo (parents uniquement)
    if (S.loaded.children && S.loaded.childInfo) for (const c of S.children) {
      const det = {}; for (const k of CHILD_DETAIL_KEYS) if (c[k] !== undefined) det[k] = c[k];
      if (!Object.keys(det).length) continue;
      await db.set(`families/${fid}/childInfo/${c.id}`, det, true);
      const del = {}; for (const k of Object.keys(det)) del[k] = db.deleteField();
      await db.update(`families/${fid}/children/${c.id}`, del);
    }
    // 3) liste des membres (identifiants seulement) lisible par tout le cercle
    if (S.loaded.members && S.members.length) {
      const ids = [...new Set(S.members.map(m => m.uid))].sort();
      if (JSON.stringify(ids) !== JSON.stringify([...(f.memberUids || [])].sort())) await db.update(`families/${fid}`, { memberUids: ids });
    }
    // 4) invitations : marquées « rejointes » quand la personne est dans le cercle
    if (S.loaded.invites && S.loaded.members) for (const i of S.invites.filter(x => x.state === 'pending')) {
      const ph = (i.phone || '').replace(/\D/g, '').slice(-9);
      const m = S.members.find(x => (i.email && (x.email || '').toLowerCase() === i.email) || (ph && (x.phone || '').replace(/\D/g, '').slice(-9) === ph));
      if (m) await db.update(`families/${fid}/invites/${i.id}`, { state: 'joined', joinedUid: m.uid, joinedAt: Date.now() });
    }
    // 5) photos des souvenirs : visibles des proches
    if (S.loaded.memories) for (const m of S.memories.filter(x => x.blobId && !x.bk)) {
      try { await db.update(`families/${fid}/blobs/${m.blobId}`, { kind: 'mem' }); } catch (e) { /* */ }
      await db.update(`families/${fid}/memories/${m.id}`, { bk: 1 });
    }
    // 6) importations antérieures à la validation = publiées (les nouvelles expirent après 48 h sans validation : voir syncApprovals)
    for (const sub of ['memories', 'docs']) if (S.loaded[sub]) {
      for (const it of S[sub]) if (it.pub === undefined) await db.update(`families/${fid}/${sub}/${it.id}`, { pub: true });
    }
    S.migrated = true;
  } catch (e) { console.warn('migration', e?.code || e); }
  S.migrating = false;
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
  // Compte actif : principal, ou Maman TEST dans une session séparée (revenir à son compte ne déconnecte pas)
  S.acc = LS.get('acc', 'main') === 'test' && LS.get('testAcc', null) ? 'test' : 'main';
  try { S.be = await createBackend(demo ? 'demo' : 'firebase', S.acc === 'test' ? 'sjtest' : null); }
  catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="card" style="margin-top:30px"><h3>Connexion impossible</h3><p class="muted">Le service n'a pas pu être chargé. Vérifiez votre connexion internet puis réessayez.</p><button class="btn primary block" onclick="location.reload()">Réessayer</button></div>`;
    return;
  }
  S.route = parseHash();
  checkSetupLink();
  Install.checkStandalone();
  S.ready = true;
  S.be.auth.onChange(u => {
    S.user = u;
    if (unUser) { unUser(); unUser = null; }
    resetFamily(); S.fid = null; S.profile = null; S.families = {}; S.remindersDone = false;
    if (!u && S.acc === 'test') {
      const t = LS.get('testAcc', null);
      S.be.auth.signIn(t.email, t.pw).catch(e => { console.warn('test', e); LS.set('acc', 'main'); location.reload(); });
      renderLoading(); return;
    }
    if (!u) { S.render(); return; }
    if (isAdminUser()) { S.profile = { admin: true }; S.admin = null; S.render(); return; }
    renderLoading();
    unUser = S.be.db.listenDoc(`users/${u.uid}`, async p => {
      if (!p) {
        if (S.signingUp) return; // le document est en cours de création
        await S.be.db.set(`users/${u.uid}`, { email: u.email, prenom: (u.email || '').split('@')[0], nom: '', phone: '', familyIds: [], currentFamily: null, createdAt: Date.now() }, true);
        return;
      }
      S.profile = p;
      if (LS.get('activeDay', '') !== E.todayISO() && !S.setupRunning) { LS.set('activeDay', E.todayISO()); stat('active'); }
      const fid = p.currentFamily && (p.familyIds || []).includes(p.currentFamily) ? p.currentFamily : (p.familyIds || [])[0] || null;
      if (fid !== S.fid) attachFamily(fid);
      loadFamilyNames(p.familyIds || []);
      S.render();
    }, err => { console.warn('profil', err); toast(errMsg(err), 'err', 6000); });
  });
  // maintenance périodique : flux widgets (glissement des dates) + rappels
  setInterval(() => { if (S.family) { syncFeed(); scheduleReminders(); } }, 60 * 60 * 1000);
  // expiration des demandes de validation (48 h) et rappels associés
  setInterval(() => { if (S.family && !document.hidden) { queueApprovals(100); Sac.queueSacReminders(200); if (['memories', 'docs', 'notifs'].includes(S.route?.view)) S.render(); } }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.family) { S.render(); queueFeed(); queueApprovals(1500); Sac.queueSacReminders(2000); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
}
start();
// ───── Accueil : glisser à gauche / à droite pour passer d'un enfant à l'autre (Tous → Selman → Jandal…)
let sw = null;
document.addEventListener('touchstart', e => {
  if (S.route.view !== 'home' || sheetDepth() || e.touches.length !== 1 || e.target.closest('.chips.scroll,.week,input,textarea')) { sw = null; return; }
  sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!sw) return; const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y; const ok = Date.now() - sw.t < 600; sw = null;
  if (!ok || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || S.children.length < 2) return;
  Home.cycleKid(dx < 0 ? 1 : -1);
}, { passive: true });
window.SJF = { S, E, go, syncFeed, version: VERSION, APP_URL, sacSync: () => Sac.syncSacReminders() };
