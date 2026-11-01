// ═══════════════ Mode administrateur (statistiques anonymes) & installation express par lien ═══════════════
import * as E from './engine.js?v=6.8';
import { SJ_PLANNINGS } from './sj-data.js?v=6.8';
import { S, VERSION, REPO, ADMIN_EMAIL, STAT_KEYS, stat, errMsg, LS } from './core.js?v=6.8';
import { esc, toast, IC } from './ui.js?v=6.8';
import { createFamily } from './views-family.js?v=6.8';

const FB = 'https://console.firebase.google.com/project/sj-family-dd337';

// ───────────── Tableau de bord admin
async function loadAdmin(force = false) {
  if (S.admin?.loading || (S.admin?.loaded && !force)) return;
  S.admin = { ...(S.admin || {}), loading: true, err: null };
  S.render();
  const out = { loading: false, loaded: true, global: {}, days: [], apk: null, err: null, at: Date.now() };
  try {
    out.global = (await S.be.db.get('stats/global')) || {};
    out.days = (await S.be.db.list('stats')).filter(d => d.id.startsWith('d-')).map(d => ({ ...d, date: d.id.slice(2) })).sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) { out.err = e?.code?.includes('permission') ? 'rules' : errMsg(e); }
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`);
    if (r.ok) { const rel = await r.json(); out.apk = { total: rel.reduce((s, x) => s + (x.assets || []).reduce((a, b) => a + (b.download_count || 0), 0), 0), count: rel.length, last: rel[0]?.published_at || null }; }
  } catch (e) { /* GitHub injoignable */ }
  S.admin = out; S.render();
}
function bars(days, keys, colors, labels) {
  const today = E.todayISO(), list = [];
  for (let i = 29; i >= 0; i--) { const d = E.addDays(today, -i); const row = days.find(x => x.date === d) || {}; list.push({ d, v: keys.map(k => +row[k] || 0) }); }
  const max = Math.max(1, ...list.map(x => x.v.reduce((a, b) => a + b, 0)));
  const total = list.reduce((s, x) => s + x.v.reduce((a, b) => a + b, 0), 0);
  return `<div class="abars">${list.map((x, i) => `<div class="ab" title="${E.fmtDate(x.d, 'short')} : ${x.v.join(' / ')}">${x.v.map((v, j) => v ? `<span style="height:${v / max * 100}%;background:${colors[j]}"></span>` : '').join('')}${i % 7 === 0 ? `<em>${E.fmtDate(x.d, 'short')}</em>` : ''}</div>`).join('')}</div>
    <div class="row between tiny muted" style="margin-top:18px"><span>${labels.map((l, j) => `<i class="lg" style="background:${colors[j]}"></i>${l}`).join(' &nbsp; ')}</span><span>30 j : <b>${total}</b></span></div>`;
}
const kpi = (i, v, l, s = '') => `<div class="kpi"><div class="ki">${i}</div><div class="kv">${v}</div><div class="kl">${l}</div>${s ? `<div class="ks">${s}</div>` : ''}</div>`;
export function adminHtml() {
  const u = S.user, a = S.admin || {};
  if (!u.emailVerified) return `<div class="card center"><div style="font-size:46px">✉️</div><h3 style="justify-content:center">Confirmez l'adresse admin</h3>
    <p class="muted">Un e-mail de confirmation a été envoyé à <b>${esc(ADMIN_EMAIL)}</b>. Ouvrez-le, touchez le lien, puis revenez ici.</p>
    <button class="btn primary block" data-act="adm-verified">J'ai confirmé</button><button class="btn soft block mt" data-act="adm-resend">Renvoyer l'e-mail</button>
    <p class="hint">Pensez à regarder dans les spams.</p></div>`;
  if (!a.loaded) { setTimeout(() => loadAdmin(), 0); return '<div class="boot"><div class="spin"></div></div>'; }
  const g = a.global || {}, today = E.todayISO(), dt = a.days.find(d => d.date === today) || {};
  const last7 = a.days.filter(d => d.date > E.addDays(today, -7));
  const sum = (arr, k) => arr.reduce((s, d) => s + (+d[k] || 0), 0);
  return `${a.err === 'rules' ? `<div class="alert"><div class="ai">🔐</div><div class="small"><b>Statistiques inaccessibles.</b> Publiez les nouvelles règles Firestore (fichier REGLES-FIRESTORE.txt) puis touchez Actualiser.</div></div>` : a.err ? `<div class="alert"><div class="ai">⚠️</div><div class="small">${esc(a.err)}</div></div>` : ''}
    <div class="kpis">
      ${kpi('👥', g.users || 0, 'Comptes créés', `+${dt.users || 0} aujourd'hui`)}
      ${kpi('🟢', dt.active || 0, "Utilisateurs actifs aujourd'hui", `${sum(last7, 'active')} connexions sur 7 j`)}
      ${kpi('🏡', g.families || 0, 'Cercles familiaux', `+${sum(last7, 'families')} sur 7 j`)}
      ${kpi('📲', (g.installAndroid || 0) + (g.installIOS || 0) + (g.installOther || 0), 'Applications installées', `🤖 ${g.installAndroid || 0} · 🍏 ${g.installIOS || 0}${g.installOther ? ' · 💻 ' + g.installOther : ''}`)}
      ${kpi('⬇️', (g.dlAndroid || 0) + (g.dlIOS || 0), 'Clics « Télécharger »', `🤖 ${g.dlAndroid || 0} · 🍏 ${g.dlIOS || 0}`)}
      ${kpi('🧩', a.apk ? a.apk.total : '—', 'APK widgets téléchargés', a.apk ? `${a.apk.count} version${a.apk.count > 1 ? 's' : ''}` : 'GitHub indisponible')}
    </div>
    <div class="card"><h3>📈 Utilisateurs actifs par jour</h3>${bars(a.days, ['active'], ['#1E9E6A'], ['Actifs'])}</div>
    <div class="card"><h3>⬇️ Téléchargements & installations</h3>${bars(a.days, ['dlAndroid', 'dlIOS', 'installAndroid', 'installIOS'], ['#E8735A', '#F4B49F', '#0F4C87', '#9DC3E6'], ['Clic Android', 'Clic iPhone', 'Install. Android', 'Install. iPhone'])}</div>
    <div class="card"><h3>🆕 Nouveaux comptes & cercles</h3>${bars(a.days, ['users', 'families'], ['#0B3D6E', '#C9A24A'], ['Comptes', 'Cercles'])}</div>
    <div class="card"><h3>🛠️ Gestion</h3>
      <p class="small muted" style="margin-top:0">Les statistiques sont anonymes : aucun nom, e-mail ni donnée familiale n'est visible ici. La suppression de comptes se fait dans la console Firebase.</p>
      <a class="btn soft block" href="${FB}/authentication/users" target="_blank" rel="noopener">👤 Comptes (Firebase Authentication)</a>
      <a class="btn soft block mt" href="${FB}/firestore/databases/-default-/data" target="_blank" rel="noopener">🗄️ Données (Firestore)</a>
      <a class="btn soft block mt" href="https://github.com/${REPO}/releases" target="_blank" rel="noopener">🧩 Versions de l'APK (GitHub)</a></div>
    <div class="row gap"><button class="btn primary f1" data-act="adm-refresh">${IC.refresh} Actualiser</button><button class="btn soft f1" data-act="logout">${IC.logout} Déconnexion</button></div>
    <p class="hint center">Mis à jour ${a.at ? new Date(a.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''} · SJ Family ${VERSION}</p>`;
}

// ───────────── Installation express (lien personnel contenant les informations du compte)
export function readSetupPayload() {
  const m = location.hash.match(/[?&]k=([^&]+)/); if (!m) return null;
  try {
    const b = m[1].replace(/-/g, '+').replace(/_/g, '/'), bin = atob(b);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch (e) { return null; }
}
export function setupHtml() {
  const st = S.setup, d = st.data;
  if (!d) return `<h2>Lien expiré</h2><p class="muted center">Ce lien d'installation n'est plus valable (la page a été rechargée). Rouvrez le lien reçu.</p><button class="btn primary block mt2" data-act="setup-close">Continuer</button>`;
  const rows = st.log.map(l => `<div class="li"><div class="le" style="font-size:20px">${l.s === 'ok' ? '✅' : l.s === 'warn' ? '⚠️' : l.s === 'err' ? '❌' : '⏳'}</div><div class="f1"><div class="lt">${esc(l.t)}</div>${l.m ? `<div class="ls">${esc(l.m)}</div>` : ''}</div></div>`).join('');
  if (st.state === 'confirm') return `<h2>Installation express</h2><p class="muted center small">Tout va être créé exactement comme si vous le faisiez vous-même :</p>
    <div class="li"><div class="le">👤</div><div class="f1"><div class="lt">${esc(d.user.prenom)} ${esc(d.user.nom)}</div><div class="ls">${esc(d.user.email)} · ${esc(d.role || 'Papa')}</div></div></div>
    <div class="li"><div class="le">🏡</div><div class="f1"><div class="lt">${esc(d.family.name)}</div><div class="ls">Autre parent : ${esc(d.family.other.prenom)} ${esc(d.family.other.nom || '')} (aucune invitation envoyée : vous l'inviterez plus tard)</div></div></div>
    <div class="li"><div class="le">🧒</div><div class="f1"><div class="lt">${esc(d.kids.map(k => k.prenom).join(' & '))}</div><div class="ls">${esc(d.kids.map(k => k.cls).filter(Boolean).join(' · '))}</div></div></div>
    <div class="li"><div class="le">📅</div><div class="f1"><div class="lt">Plannings officiels ${esc(d.import.join(' & '))}</div><div class="ls">Relais la veille à 18h30</div></div></div>
    ${d.admin ? `<div class="li"><div class="le">🛡️</div><div class="f1"><div class="lt">Compte admin</div><div class="ls">admin@admin.com → ${esc(ADMIN_EMAIL)}</div></div></div>` : ''}
    <button class="btn coral block mt2" data-act="setup-go">Tout créer</button><button class="btn soft block mt" data-act="setup-close">Annuler</button>`;
  return `<h2>${st.state === 'done' ? 'C\'est prêt 🎉' : st.state === 'error' ? 'Installation interrompue' : 'Installation…'}</h2>${rows}
    ${st.state === 'error' ? `<div class="alert mt"><div class="ai">⚠️</div><div class="small">${esc(st.error || '')}<br>Vous pouvez rouvrir le même lien après correction : rien ne sera créé en double.</div></div>` : ''}
    ${st.state === 'done' || st.state === 'error' ? `<button class="btn primary block mt2" data-act="setup-close">${st.state === 'done' ? 'Ouvrir mon espace' : 'Fermer'}</button>` : '<div class="boot" style="height:60px"><div class="spin"></div></div>'}`;
}
const isCode = (e, c) => String(e?.code || e?.message || '').includes(c);
async function runSetup() {
  const st = S.setup, d = st.data, A = S.be.auth, db = S.be.db;
  const log = (t, s = 'run', m = '') => { st.log.push({ t, s, m }); S.render(); return st.log[st.log.length - 1]; };
  st.state = 'run'; st.log = []; S.setupRunning = true; S.render();
  try {
    if (A.current()) await A.signOut();
    // 1. Compte admin
    if (d.admin && d.admin.pw) {
      const l = log('Compte admin');
      try { await A.signUp(ADMIN_EMAIL, d.admin.pw); try { await A.sendVerification(); } catch (e) { /* */ } l.s = 'ok'; l.m = `Créé. Confirmez l'e-mail envoyé à ${ADMIN_EMAIL}.`; }
      catch (e) {
        if (!isCode(e, 'email-already-in-use')) throw e;
        try { await A.signIn(ADMIN_EMAIL, d.admin.pw); const c = A.current(); if (c && !c.emailVerified) { try { await A.sendVerification(); } catch (x) { /* */ } } l.s = 'ok'; l.m = 'Déjà existant, mot de passe confirmé.'; }
        catch (e2) { l.s = 'warn'; l.m = `Ce compte existe déjà avec un autre mot de passe : sur l'écran de connexion, saisissez admin@admin.com puis « Mot de passe oublié ».`; }
      }
      if (A.current()) await A.signOut();
      S.render();
    }
    // 2. Compte utilisateur
    const prof = { prenom: d.user.prenom, nom: (d.user.nom || '').toUpperCase(), phone: d.user.phone || '', email: d.user.email.toLowerCase() };
    S.signingUp = prof;
    let l = log(`Compte ${prof.email}`), created = false;
    try { await A.signUp(prof.email, d.user.pw); created = true; l.s = 'ok'; l.m = 'Compte créé.'; }
    catch (e) {
      if (!isCode(e, 'email-already-in-use')) throw e;
      try { await A.signIn(prof.email, d.user.pw); l.s = 'ok'; l.m = 'Compte existant : connexion réussie.'; }
      catch (e2) { l.s = 'err'; throw new Error(`Le compte ${prof.email} existe déjà avec un autre mot de passe. Supprimez-le dans la console Firebase (Authentication) ou utilisez « Mot de passe oublié ».`); }
    }
    const me = A.current(), uid = me.uid;
    if (created) stat('users');
    // 3. Profil
    l = log('Profil');
    const existing = await db.get(`users/${uid}`);
    if (!existing) await db.set(`users/${uid}`, { ...prof, familyIds: [], currentFamily: null, createdAt: Date.now() });
    else await db.set(`users/${uid}`, { prenom: prof.prenom, nom: prof.nom, email: prof.email, ...(prof.phone ? { phone: prof.phone } : {}) }, true);
    l.s = 'ok'; l.m = `${prof.prenom} ${prof.nom}`;
    // 4. Cercle familial
    l = log('Cercle familial');
    let fid = existing && existing.currentFamily && (existing.familyIds || []).includes(existing.currentFamily) ? existing.currentFamily : (existing?.familyIds || [])[0] || null;
    if (fid) { l.s = 'ok'; l.m = 'Cercle existant conservé.'; }
    else {
      fid = await createFamily({ name: d.family.name, mine: d.role || 'Papa', status: d.family.status || 'separes', oprenom: d.family.other.prenom, onom: d.family.other.nom || '', ophone: d.family.other.phone || '', oemail: d.family.other.email || '', noInvite: true, zone: d.family.zone || 'B', ht: d.family.ht || '18:30' },
        { profile: prof, userId: uid, linkUser: false });
      const f = await db.get(`families/${fid}`);
      l.s = 'ok'; l.m = `${d.family.name} · code du cercle ${f?.joinCode || ''}`;
    }
    // 5. Enfants
    l = log('Enfants');
    const kidsNow = await db.list(`families/${fid}/children`), ids = [];
    for (const k of d.kids) {
      const ex = kidsNow.find(x => (x.prenom || '').toLowerCase() === k.prenom.toLowerCase());
      if (ex) { ids.push(ex.id); continue; }
      const id = db.newId();
      await db.set(`families/${fid}/children/${id}`, { prenom: k.prenom, nom: (k.nom || '').toUpperCase(), birth: k.birth || '', emoji: k.emoji || '🧒', createdAt: Date.now(), createdBy: uid, createdByName: prof.prenom });
      if (k.cls || k.school) await db.set(`families/${fid}/childInfo/${id}`, { cls: k.cls || '', school: k.school || '' }, true);
      await db.set(`families/${fid}/inbox/${uid}/items/${db.newId()}`, { cat: 'cercle', title: `Nouvel enfant : ${k.prenom}`, body: '', icon: '👨‍👩‍👧‍👦', by: uid, byName: prof.prenom, at: Date.now() });
      ids.push(id);
    }
    l.s = 'ok'; l.m = d.kids.map(k => k.prenom).join(' & ');
    // 6. Plannings officiels (KA = parent A = créateur du cercle)
    l = log('Plannings de garde');
    const pls = await db.list(`families/${fid}/plannings`);
    for (const y of d.import || []) {
      if (pls.some(p => p.source === `sj-${y}` && ['active', 'pending'].includes(p.state))) continue;
      const src = SJ_PLANNINGS[y]; if (!src) continue;
      await db.set(`families/${fid}/plannings/${db.newId()}`, {
        title: `Garde ${y} (officiel)`, icon: src.icon, childIds: ids, start: src.start, days: E.mapKJ(src.days, 'A'), comments: src.comments, feries: src.feries,
        source: `sj-${y}`, rhythm: null, state: 'active', createdAt: Date.now(), createdBy: uid, createdByName: prof.prenom, validatedAt: Date.now(), validatedBy: uid, validatedByName: prof.prenom + ' (auto)',
      });
      await db.set(`families/${fid}/inbox/${uid}/items/${db.newId()}`, { cat: 'garde', title: `Nouveau planning : Garde ${y} (officiel)`, body: d.kids.map(k => k.prenom).join(' & '), icon: '📅', by: uid, byName: prof.prenom, at: Date.now() });
    }
    l.s = 'ok'; l.m = `${(d.import || []).join(' & ')} · Khalid = parent A, jours d'école chez ${d.family.other.prenom}`;
    // 7. Activation
    await db.update(`users/${uid}`, { familyIds: db.arrayUnion(fid), currentFamily: fid, [`lastSeen.${fid}`]: Date.now() });
    LS.set('sel', []);
    st.state = 'done';
  } catch (e) {
    console.error(e);
    st.state = 'error';
    st.error = isCode(e, 'permission') ? "Accès refusé par Firebase : publiez d'abord les règles du fichier REGLES-FIRESTORE.txt (Firestore › Règles › Publier)." : (e.message && !e.code ? e.message : errMsg(e));
    const last = st.log[st.log.length - 1]; if (last && last.s === 'run') last.s = 'err';
  } finally { S.signingUp = null; S.setupRunning = false; S.render(); }
}
export const actions = {
  'adm-refresh': () => loadAdmin(true),
  'adm-resend': async () => { try { await S.be.auth.sendVerification(); toast(`E-mail envoyé à ${ADMIN_EMAIL}`); } catch (e) { toast(errMsg(e), 'err'); } },
  'adm-verified': async () => {
    try { const u = await S.be.auth.refresh(); if (u?.emailVerified) { S.user = { ...S.user, emailVerified: true }; S.admin = null; S.render(); toast('Adresse confirmée ✓'); } else toast("Pas encore confirmée : ouvrez le lien reçu par e-mail.", 'warn', 4000); }
    catch (e) { toast(errMsg(e), 'err'); }
  },
  'setup-go': () => runSetup(),
  'setup-close': () => { S.setup = null; location.hash = '#/home'; S.render(); },
};
export { STAT_KEYS };
