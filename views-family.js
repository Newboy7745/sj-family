// ═══════════════ Cercle familial : création, adhésion, statut, enfants, membres, invitations ═══════════════
import * as E from './engine.js?v=6.10';
import { randomId } from './backend.js?v=6.10';
import { stat } from './core.js?v=6.10';
import { S, engine, parents, pName, uid, me, myName, myFullName, myCode, isParent, childNames, settings, addItem, updItem, log, guard, fpath, go, needsValidation, setFamily, LS, APP_URL, SHARE_URL, PARENT_COLORS, CHILD_EMOJIS, avatar, kidAvatar, groupAvatar, kidFull, CHILD_DETAIL_KEYS, PERM_KEYS, memberName, hasOtherParent, countdown } from './core.js?v=6.10';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, IC, copyText, closeSheetsThen, compressImage, squarePhoto } from './ui.js?v=6.10';

const STATUS = { separes: '🔶 Séparés', divorces: '📋 Divorcés' };
const code6 = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = new Uint8Array(6); crypto.getRandomValues(b); return [...b].map(x => a[x % a.length]).join(''); };

// ───── Accueil sans cercle
export function onboardingHtml() {
  const p = S.profile || {};
  const mine = (p.familyIds || []).length;
  return `<h1 class="hello">Bienvenue ${esc(p.prenom || '')} 👋</h1>
    <p class="muted" style="font-size:17px">Pour commencer, créez votre cercle familial ou rejoignez celui de l'autre parent grâce à son code.</p>
    <button class="card" style="width:100%;text-align:left" data-act="fam-create"><div class="row gap"><div style="font-size:40px">🏡</div><div class="f1"><div class="b" style="font-size:19px">Créer mon cercle familial</div><div class="small muted">Vous êtes le premier parent à vous inscrire</div></div><span class="lnk">›</span></div></button>
    <button class="card" style="width:100%;text-align:left" data-act="fam-join"><div class="row gap"><div style="font-size:40px">🔑</div><div class="f1"><div class="b" style="font-size:19px">Rejoindre un cercle</div><div class="small muted">Avec le code reçu par SMS ou e-mail</div></div><span class="lnk">›</span></div></button>
    ${S.familyGone && mine ? `<div class="alert"><div class="ai">⚠️</div><div class="small">Votre cercle n'est plus accessible. Vérifiez les règles Firestore (voir LISEZMOI) ou choisissez un autre cercle.</div></div>` : ''}
    <div class="center mt2"><button class="btn soft sm" data-act="logout">${IC.logout} Se déconnecter</button></div>`;
}
export function afterOnboarding() {
  const code = LS.get('pendingJoin', null);
  if (code && !S.joinPrompted) { S.joinPrompted = true; joinSheet(code); }
}

// ───── Créer / rejoindre
function createSheet(pendingChild = null) {
  const p = S.profile || {};
  openSheet(`<h3 class="sh-title">🏡 Nouveau cercle</h3>
    <label class="lbl">Nom du cercle</label><input class="in" name="name" value="Famille ${esc(p.nom || '')}">
    <label class="lbl">Je suis</label>${chips('mine', [{ v: 'Papa', l: '👨 Papa' }, { v: 'Maman', l: '👩 Maman' }, { v: 'Parent', l: '🧑 Parent' }], ['Papa'])}
    <div class="card" style="background:#F7F9FC;box-shadow:none;margin-top:16px"><div class="b">👤 L'autre parent</div><div class="hint" style="margin-top:2px">Il recevra une invitation et rejoindra le cercle avec le code.</div>
      <div class="two"><div><label class="lbl">Prénom</label><input class="in" name="oprenom"></div><div><label class="lbl">Nom</label><input class="in" name="onom"></div></div>
      <label class="lbl">Téléphone</label><input class="in" type="tel" name="ophone" placeholder="06…">
      <label class="lbl">E-mail</label><input class="in" type="email" name="oemail"></div>
    <label class="lbl">Zone scolaire</label>${chips('zone', ['A', 'B', 'C'].map(z => ({ v: z, l: 'Zone ' + z })), ['B'])}
    <label class="lbl">Heure des relais</label><input class="in" type="time" name="ht" value="18:30">
    <div class="hint">Une garde commençant un jour = récupération la veille à cette heure ; fin de garde le dernier jour à cette heure.</div>
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="fam-create-go">Créer le cercle</button></div>`);
  S.pendingChild = pendingChild;
}
export async function createFamily(f, { profile = S.profile, userId = uid(), linkUser = true } = {}) {
  const db = S.be.db, u = userId, p = profile || {}, fid = db.newId(), code = code6();
  const other = f.mine === 'Papa' ? 'Maman' : f.mine === 'Maman' ? 'Papa' : 'Parent';
  const fam = {
    name: f.name || `Famille ${p.nom || ''}`, ownerUid: u, joinCode: code, createdAt: Date.now(), memberUids: [u],
    parents: {
      A: { uid: u, name: p.prenom || 'Moi', nom: p.nom || '', short: f.mine || 'Papa', color: PARENT_COLORS[0], phone: p.phone || '', email: p.email || '' },
      B: { uid: null, name: f.oprenom || 'Autre parent', nom: (f.onom || '').toUpperCase(), short: other, color: PARENT_COLORS[1], phone: f.ophone || '', email: (f.oemail || '').toLowerCase() },
    },
    settings: { handoverTime: f.ht || '18:30', middayTime: '14:00', zone: f.zone || 'B', customHolidays: [] },
  };
  await db.set(`families/${fid}`, fam);
  await db.set(`families/${fid}/members/${u}`, { uid: u, prenom: p.prenom || '', nom: p.nom || '', name: p.prenom || '', email: p.email || '', phone: p.phone || '', role: 'parent', parentCode: 'A', joinedAt: Date.now() });
  await db.set(`joinCodes/${code}`, { fid, name: fam.name, by: p.prenom || '', createdAt: Date.now() });
  if (!f.noInvite && (f.oprenom || f.ophone || f.oemail)) await db.set(`families/${fid}/invites/${db.newId()}`, { prenom: f.oprenom || '', nom: f.onom || '', phone: f.ophone || '', email: (f.oemail || '').toLowerCase(), role: 'parent', relation: other, state: 'pending', by: u, byName: p.prenom || '', at: Date.now() });
  if (linkUser) await db.update(`users/${u}`, { familyIds: db.arrayUnion(fid), currentFamily: fid, [`lastSeen.${fid}`]: Date.now() });
  stat('families');
  await db.set(`families/${fid}/inbox/${u}/items/${db.newId()}`, { cat: 'cercle', title: `Cercle créé : ${fam.name}`, body: '', icon: '🏡', by: u, byName: p.prenom || '', at: Date.now() });
  return fid;
}
function joinSheet(code = '') {
  openSheet(`<h3 class="sh-title">🔑 Rejoindre un cercle</h3>
    <label class="lbl">Code du cercle</label><input class="in" name="code" value="${esc(code)}" maxlength="6" style="text-transform:uppercase;letter-spacing:6px;font-size:24px;text-align:center" placeholder="ABC123">
    <label class="lbl">Je suis</label>${chips('role', [{ v: 'parent', l: "👪 L'autre parent" }, { v: 'proche', l: '👵 Un proche' }], ['parent'])}
    <label class="lbl">Lien avec les enfants (proche)</label><input class="in" name="relation" placeholder="Grand-mère, oncle, nounou…">
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="fam-join-go">Rejoindre</button></div>`);
}
async function joinFamily(code, role, relation) {
  const db = S.be.db, u = uid(), p = S.profile || {};
  const jc = await db.get(`joinCodes/${code}`);
  if (!jc) throw Object.assign(new Error('Code introuvable. Vérifiez les 6 caractères.'), { code: 'join/not-found' });
  const fid = jc.fid;
  if ((p.familyIds || []).includes(fid)) { await db.update(`users/${u}`, { currentFamily: fid }); return fid; }
  await db.set(`families/${fid}/members/${u}`, { uid: u, prenom: p.prenom || '', nom: p.nom || '', name: p.prenom || '', email: p.email || '', phone: p.phone || '', role, relation: relation || '', parentCode: null, joinCode: code, joinedAt: Date.now() });
  const fam = await db.get(`families/${fid}`);
  let asParent = false;
  if (role === 'parent' && fam && !fam.parents?.B?.uid) {
    await db.update(`families/${fid}`, { 'parents.B.uid': u, 'parents.B.name': p.prenom || 'Parent 2', 'parents.B.phone': p.phone || '', 'parents.B.email': p.email || '' });
    await db.update(`families/${fid}/members/${u}`, { parentCode: 'B' });
    asParent = true;
  } else if (role === 'parent') { await db.update(`families/${fid}/members/${u}`, { role: 'proche', relation: relation || 'Proche' }); toast('Les deux parents sont déjà inscrits : vous rejoignez le cercle en tant que proche.', 'warn', 5000); }
  // l'invitation est marquée « rejointe » par l'application d'un parent ; ici : identifiant visible du cercle + historique
  try { await db.update(`families/${fid}`, { memberUids: db.arrayUnion(u) }); } catch (e) { console.warn('memberUids', e?.code || e); }
  await db.update(`users/${u}`, { familyIds: db.arrayUnion(fid), currentFamily: fid, [`lastSeen.${fid}`]: Date.now() + 5000 });
  const f2 = await db.get(`families/${fid}`).catch(() => null);
  const rcpt = [...new Set([u, f2?.parents?.A?.uid, f2?.parents?.B?.uid].filter(Boolean))], aid = db.newId();
  for (const r of rcpt) await db.set(`families/${fid}/inbox/${r}/items/${aid}`, { cat: 'cercle', title: `${p.prenom || 'Un membre'} a rejoint le cercle${asParent ? ' (parent)' : ''}`, body: relation || '', icon: '🤝', by: u, byName: p.prenom || '', at: Date.now() }).catch(() => { });
  LS.set('pendingJoin', null);
  return fid;
}

// ───── Vue Cercle
function childRow(c) {
  const eng = engine(), today = E.todayISO(), who = eng.presence(c.id, today, E.nowMin());
  const sel = (S.ui.famSel || []).includes(c.id);
  return `<div class="tile ${sel ? 'sel' : ''}"><button class="ck ${sel ? 'on' : ''}" data-act="kid-check" data-id="${c.id}">${sel ? '✓' : ''}</button>
    <button class="row gap f1" style="text-align:left" data-go="child" data-params='{"id":"${c.id}"}'>${kidAvatar(c, 46)}<span class="f1"><span class="b">${esc(c.prenom)} ${esc(c.nom || '')}</span><br>
    <span class="small muted">${c.birth ? `${E.age(c.birth)} ans · ` : ''}${who ? 'chez ' + esc(pName(who)) : 'sans planning'}</span></span><span class="lnk">›</span></button></div>`;
}
function permLabel(m) {
  const on = PERM_KEYS.filter(x => (m.perms || {})[x.k]).map(x => x.l.replace(/^\S+\s/, ''));
  return `Agenda · Souvenirs · ses notes${on.length ? ' · ' + on.join(' · ') : ''}`;
}
function memberRow(m, p, u) {
  const proche = !m.parentCode;
  const pend = m.pendingPerms;
  return `<div class="li" ${proche && isParent() ? `data-act="perm-open" data-id="${m.uid}" style="cursor:pointer"` : ''}>${avatar(m.name, m.parentCode ? p[m.parentCode].color : '#8E9BB0', 40)}<div class="f1"><div class="lt">${esc(m.prenom || m.name)} ${esc(m.nom || '')}${m.uid === u ? ' <span class="pill navy">vous</span>' : ''}${pend ? ' <span class="pill warn">⏳ accès à valider</span>' : ''}</div>
    <div class="ls">${m.parentCode ? 'Parent' : esc(m.relation || 'Proche')}${m.email ? ' · ' + esc(m.email) : ''}</div>${proche ? `<div class="ls">👁️ ${esc(permLabel(m))}</div>` : ''}</div>${proche && isParent() ? '<span class="lnk">›</span>' : '<span class="pill ok">✓</span>'}</div>`;
}
export const views = {
  family() {
    const f = S.family, p = parents(), myc = myCode(), u = uid(), par = isParent();
    const fams = (S.profile?.familyIds || []).map(id => S.families[id] || { id, name: '…' });
    const sel = (S.ui.famSel || []).filter(id => S.children.some(c => c.id === id));
    const invites = S.invites.filter(i => i.state === 'pending');
    const circles = `<div class="card"><h3>👨‍👩‍👧‍👦 Mes cercles (${fams.length}) <a class="act" data-act="fam-menu">${IC.plus}</a></h3>
        ${fams.map(x => `<button class="tile ${x.id === S.fid ? 'sel' : ''}" style="width:100%;text-align:left" data-act="fam-switch" data-id="${x.id}"><div class="f1"><div class="b">${esc(x.name)}</div>${x.id === S.fid ? `<div class="small muted">${esc(p.A.name)} & ${p.B.uid ? esc(p.B.name) : 'en attente'} · ${S.children.length} enfant${S.children.length > 1 ? 's' : ''}</div>` : ''}</div>${x.id === S.fid ? '<span class="pill ok">✓ Actif</span>' : ''}</button>`).join('')}</div>`;
    const kids = `<div class="card"><h3>🧒 Enfants ${par ? `<a class="act" data-act="kid-add">${IC.plus} Ajouter</a>` : ''}</h3>
        ${S.children.length > 1 ? `<div class="tile"><span class="gph">${groupAvatar(46) || '<span class="kav e" style="width:46px;height:46px;font-size:30px">👨‍👧‍👦</span>'}</span><div class="f1"><div class="b">Tous les enfants</div><div class="small muted">${S.family.groupPhoto ? 'Photo de groupe' : 'Pictogramme'} affiché pour « Tous »</div></div>${par ? `<button class="btn soft sm" data-act="grp-photo">📷</button>` : ''}</div>` : ''}
        ${S.children.length ? S.children.map(childRow).join('') : '<div class="empty">Aucun enfant pour l\'instant.</div>'}
        ${sel.length > 1 ? `<div class="row gap wrap mt"><span class="small b">${sel.length} sélectionnés :</span><button class="btn primary sm" data-go="kids" data-params='${JSON.stringify({ ids: sel.join(',') })}'>👀 Voir ensemble</button>${par ? `<button class="btn soft sm" data-act="kid-multi">${IC.edit} Modifier ensemble</button><button class="btn soft sm" data-act="wiz-start" data-kids="${sel.join(',')}">📅 Rythme</button>` : ''}</div>`
          : sel.length === 1 ? `<div class="hint">Cochez un autre enfant pour les consulter ensemble.</div>` : `<div class="hint">Cochez plusieurs enfants pour les consulter ensemble${par ? ' ou les modifier en une fois' : ''}.</div>`}
        ${par ? `<button class="btn ghost block mt" data-act="kid-add">${IC.plus} Ajouter un enfant</button>` : ''}</div>`;
    const parentsCard = `<div class="card"><h3>👪 Parents</h3>
        ${['A', 'B'].map(c => `<div class="li">${avatar(p[c].name, p[c].color, 44)}<div class="f1"><div class="lt">${esc(p[c].name)} <span class="muted small">(${esc(p[c].short)})</span>${c === myc ? ' <span class="pill navy">vous</span>' : ''}</div>
          <div class="ls">${p[c].uid ? '✓ Inscrit' : '⏳ Pas encore inscrit'}${p[c].phone ? ' · ' + esc(p[c].phone) : ''}</div></div>
          ${(c === myc || (!p[c].uid && par)) ? `<button class="ib" data-act="par-edit" data-c="${c}">${IC.edit}</button>` : p[c].phone ? `<a class="ib" href="tel:${esc(p[c].phone)}">${IC.phone}</a>` : ''}</div>`).join('')}</div>`;
    if (!par) return { title: 'Mon cercle', html: `${circles}${kids}${parentsCard}
      <div class="card"><h3>👁️ Ce que je vois</h3><p class="small muted" style="margin-top:0">${esc(permLabel(S.meMember || {}))}. Les parents peuvent vous ouvrir d'autres rubriques.</p></div>` };
    return {
      title: 'Mon cercle',
      html: `${circles}${kids}${parentsCard}
      <div class="card"><h3>🤝 Membres (${S.members.length})</h3>
        ${S.members.map(m => memberRow(m, p, u)).join('')}
        <div class="hint">Touchez un proche pour choisir ce qu'il peut voir. ${hasOtherParent() ? "Chaque changement d'accès doit être validé par l'autre parent." : ''}</div>
        ${invites.length ? `<div class="lbl">Invitations en attente</div>${invites.map(i => `<div class="li"><div class="le">✉️</div><div class="f1"><div class="lt">${esc(i.prenom)} ${esc(i.nom || '')}</div><div class="ls">${esc(i.relation || (i.role === 'parent' ? 'Parent' : 'Proche'))} · ${esc(i.phone || i.email || '')} · active dès la création de son compte</div></div>
          <button class="ib" data-act="inv-send" data-id="${i.id}">${IC.share}</button><button class="ib" data-act="inv-del" data-id="${i.id}">${IC.trash}</button></div>`).join('')}` : ''}
        <button class="btn ghost block mt" data-act="inv-new">✉️ Inviter un parent ou un proche</button></div>

      <div class="card center"><h3 style="justify-content:center">🔑 Code du cercle</h3><div style="font-size:34px;font-weight:800;letter-spacing:8px;color:var(--navy)">${esc(f.joinCode || '—')}</div>
        <div class="hint">À saisir après la création du compte, dans « Rejoindre un cercle ».</div>
        <div class="row gap mt"><button class="btn soft f1" data-act="code-copy">${IC.copy} Copier</button><button class="btn primary f1" data-act="code-share">${IC.share} Partager</button></div></div>`,
    };
  },
  /** Plusieurs enfants consultés côte à côte */
  kids(p) {
    const ids = String(p.ids || '').split(',').filter(id => S.children.some(c => c.id === id));
    const ks = (ids.length ? ids : S.children.map(c => c.id)).map(id => kidFull(S.children.find(c => c.id === id)));
    const eng = engine(), today = E.todayISO(), min = E.nowMin(), par = isParent();
    const rows = [
      ['🏠 Actuellement', k => { const w = eng.presence(k.id, today, min); return w ? 'Chez ' + pName(w) : '—'; }],
      ['🔁 Prochain relais', k => { const n = eng.nextHandovers([k.id], today, min, 1)[0]; return n ? `${E.relDay(n.date)} ${E.fmtTime(n.time)} → ${parents()[n.to].short}${n.place ? ' · ' + n.place : ''} (${countdown(n.date, n.time).replace('dans ', '')})` : '—'; }],
      ['🎂 Âge', k => k.birth ? `${E.age(k.birth)} ans (${E.fmtDate(k.birth, 'num')})` : '—'],
      ['📅 Planning', k => S.plannings.filter(x => x.childIds.includes(k.id) && x.state === 'active').map(x => x.title).join(', ') || '—'],
    ];
    if (par) rows.push(['🏫 École', k => [k.school, k.cls].filter(Boolean).join(' · ') || '—'], ['👩‍🏫 Enseignant(e)', k => k.teacher || '—'], ['🩺 Médecin', k => [k.doctor, k.doctorPhone].filter(Boolean).join(' · ') || '—'],
      ['⚠️ Allergies', k => k.allergies || '—'], ['💊 Traitements', k => k.treatments || '—'], ['📏 Taille', k => k.height || '—'], ['👟 Pointure', k => k.shoe || '—'], ['👕 Vêtements', k => k.clothes || '—'], ['⚽ Activités', k => k.activities || '—']);
    if (par || (S.meMember?.perms || {}).docs) rows.push(['📁 Documents', k => String(S.docs.filter(d => !d.childIds?.length || d.childIds.includes(k.id)).length)]);
    const grid = `grid-template-columns:110px repeat(${ks.length},minmax(0,1fr))`;
    return {
      title: ks.map(k => k.prenom).join(' & '), back: 'family',
      html: `<div class="card tight"><div class="cmp" style="${grid}"><div></div>${ks.map(k => `<div class="cmp-h">${kidAvatar(k, 54)}<div class="b">${esc(k.prenom)}</div></div>`).join('')}
        ${rows.map(([l, f]) => `<div class="cmp-l">${l}</div>${ks.map(k => `<div class="cmp-v">${esc(f(k))}</div>`).join('')}`).join('')}</div></div>
        <div class="row gap wrap">${ks.map(k => `<button class="btn soft f1" data-go="child" data-params='{"id":"${k.id}"}'>${esc(k.prenom)} ›</button>`).join('')}</div>`,
    };
  },
  child(p) {
    const c = kidFull(S.children.find(x => x.id === p.id));
    if (!c) return { title: 'Enfant', back: 'family', html: '<div class="card empty">Enfant introuvable.</div>' };
    const eng = engine(), today = E.todayISO(), who = eng.presence(c.id, today, E.nowMin()), nx = eng.nextHandovers([c.id], today, E.nowMin(), 1)[0];
    const row = (l, v, tel) => v ? `<div class="prow"><span class="muted">${l}</span><span class="b" style="text-align:right">${tel ? `<a href="tel:${esc(v)}">${esc(v)}</a>` : esc(v)}</span></div>` : '';
    const ps = S.plannings.filter(x => x.childIds.includes(c.id) && ['active', 'pending'].includes(x.state));
    const nextB = c.birth ? (() => { const y = +today.slice(0, 4); let d = `${y}${c.birth.slice(4)}`; if (d < today) d = `${y + 1}${c.birth.slice(4)}`; return d; })() : null;
    return {
      title: c.prenom, back: 'family',
      html: `<div class="card center"><div class="kid-big">${kidAvatar(c, 110)}</div><h2 style="font-size:32px">${esc(c.prenom)} ${esc(c.nom || '')}</h2>
        <div class="muted">${c.birth ? `${E.age(c.birth)} ans · né(e) le ${E.fmtDate(c.birth)}` : 'Date de naissance non renseignée'}</div>
        ${nextB ? `<div class="pill navy mt">🎂 Anniversaire dans ${E.diffDays(today, nextB)} j</div>` : ''}
        ${isParent() ? `<div class="row gap mt"><button class="btn primary f1" data-act="kid-edit" data-id="${c.id}">${IC.edit} Modifier</button></div>` : ''}</div>
      <div class="card"><h3>🏠 Garde</h3><div class="b">${who ? 'Actuellement chez ' + esc(pName(who)) : 'Aucun planning en cours'}</div>
        ${nx ? `<div class="small muted">Prochain relais ${esc(E.relDay(nx.date))} à ${E.fmtTime(nx.time)} → ${esc(pName(nx.to))}</div>` : ''}
        ${ps.map(x => `<div class="li"><div class="le">${x.icon || '📅'}</div><div class="f1"><div class="lt">${esc(x.title)}</div><div class="ls">${E.fmtDate(x.start, 'num')} → ${E.fmtDate(E.addDays(x.start, x.days.length - 1), 'num')} · ${x.state === 'active' ? 'actif' : 'en attente'}</div></div></div>`).join('')}
        ${isParent() ? `<button class="btn ghost block mt" data-act="wiz-start" data-kids="${c.id}">📅 Modifier le rythme de ${esc(c.prenom)}</button>` : ''}</div>
      ${!isParent() ? '' : `<div class="card"><h3>🏫 École</h3>${row('Établissement', c.school)}${row('Classe', c.cls)}${row('Enseignant(e)', c.teacher)}${row('Horaires / cantine', c.schoolInfo)}${!c.school && !c.cls ? '<p class="muted small">Non renseigné.</p>' : ''}</div>
      <div class="card"><h3>🩺 Santé</h3>${row('Médecin', c.doctor)}${row('Téléphone', c.doctorPhone, true)}${row('Groupe sanguin', c.blood)}${row('Allergies', c.allergies)}${row('Traitements', c.treatments)}${row('Vaccins / notes', c.health)}${!c.doctor && !c.allergies ? '<p class="muted small">Non renseigné.</p>' : ''}</div>
      <div class="card"><h3>👕 Infos pratiques</h3>${row('Taille', c.height)}${row('Pointure', c.shoe)}${row('Vêtements', c.clothes)}${row('Activités', c.activities)}${row('Notes', c.notes)}${!c.height && !c.shoe && !c.notes ? '<p class="muted small">Non renseigné.</p>' : ''}</div>
      ${(S.profile?.familyIds || []).length > 1 ? `<button class="btn soft block" data-act="kid-copy" data-id="${c.id}">📋 Rattacher aussi à un autre cercle</button>` : ''}`}
      ${isParent() ? `<button class="btn soft block mt" style="color:var(--err)" data-act="kid-del" data-id="${c.id}">${IC.trash} Retirer ${esc(c.prenom)} de ce cercle</button>` : ''}`,
    };
  },
};
const KID_FIELDS = [['school', 'Établissement scolaire'], ['cls', 'Classe'], ['teacher', 'Enseignant(e)'], ['schoolInfo', 'Horaires / cantine / garderie'], ['doctor', 'Médecin traitant'], ['doctorPhone', 'Téléphone du médecin', 'tel'],
  ['blood', 'Groupe sanguin'], ['allergies', 'Allergies'], ['treatments', 'Traitements en cours'], ['health', 'Vaccins / notes santé'], ['height', 'Taille'], ['shoe', 'Pointure'], ['clothes', 'Taille de vêtements'], ['activities', 'Activités'], ['notes', 'Notes']];
function kidSheet(c = null) {
  const fams = (S.profile?.familyIds || []).filter(id => id !== S.fid).map(id => S.families[id]).filter(Boolean);
  const sh = openSheet(`<h3 class="sh-title">👶 ${c ? 'Modifier ' + esc(c.prenom) : 'Ajouter un enfant'}</h3>
    ${!c ? `<div class="seg"><button class="on" data-act="kid-tab" data-t="new">Nouvel enfant</button><button data-act="kid-tab" data-t="exist">Enfant existant</button></div>` : ''}
    <div data-part="new">
    <div class="two"><div><label class="lbl">Prénom</label><input class="in" name="prenom" value="${esc(c?.prenom || '')}"></div><div><label class="lbl">Nom</label><input class="in" name="nom" value="${esc(c?.nom || S.profile?.nom || '')}"></div></div>
    <label class="lbl">Date de naissance</label><input class="in" type="date" name="birth" value="${c?.birth || ''}">
    <label class="lbl">Photo ou pictogramme</label>
    <div class="row gap"><span data-part="ph">${kidAvatar(c || {}, 64)}</span><div class="f1 row gap wrap">
      <label class="btn soft sm">📷 Photo<input type="file" accept="image/*" capture="user" class="hide" data-ph="1"></label>
      <label class="btn soft sm">🖼️ Galerie<input type="file" accept="image/*" class="hide" data-ph="1"></label>
      <button type="button" class="btn soft sm" data-act="kid-ph-reset">↩️ Pictogramme</button></div></div>
    <input type="hidden" name="photo" value="${c?.photo ? 'keep' : ''}">
    <label class="lbl">Pictogramme</label>${chips('emoji', CHILD_EMOJIS.map(e => ({ v: e, l: e })), [c?.emoji || '🧒'])}
    ${!c ? `<label class="lbl">Ajouter dans</label><select class="in" name="dest"><option value="cur">Ce cercle (${esc(S.family?.name || '')})</option>${fams.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}<option value="new">➕ Un nouveau cercle</option></select>
      <div class="hint">Chaque enfant ajouté apparaît comme un nouvel enfant dont vous gérez la garde.</div>` : ''}
    ${c ? `<details class="mt"><summary class="b">École, santé, infos pratiques</summary>${KID_FIELDS.map(([k, l, t]) => `<label class="lbl">${l}</label><input class="in" ${t ? `type="${t}"` : ''} name="${k}" value="${esc(kidFull(c)[k] || '')}">`).join('')}</details>` : ''}
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="kid-save" data-id="${c?.id || ''}">${c ? 'Enregistrer' : 'Ajouter'}</button></div></div>
    ${!c ? `<div data-part="exist" class="hide"><div data-part="exist-list"><div class="boot" style="height:120px"><div class="spin"></div></div></div></div>` : ''}`);
  sh._photo = c?.photo || null;
  sh.querySelectorAll('[data-ph]').forEach(inp => inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    try { sh._photo = await squarePhoto(file, 360); sh.querySelector('[data-part="ph"]').innerHTML = kidAvatar({ photo: sh._photo }, 64); }
    catch (e) { toast('Photo illisible', 'err'); }
  }));
}
async function loadOtherKids(sh) {
  const box = sh.querySelector('[data-part="exist-list"]');
  const ids = (S.profile?.familyIds || []).filter(id => id !== S.fid);
  const rows = [];
  for (const fid of ids) { try { const ks = await S.be.db.list(`families/${fid}/children`); for (const k of ks) rows.push({ ...k, fid, fname: S.families[fid]?.name || '' }); } catch (e) { /* */ } }
  const here = new Set(S.children.map(c => (c.prenom + c.birth).toLowerCase()));
  const list = rows.filter(r => !here.has((r.prenom + r.birth).toLowerCase()));
  box.innerHTML = list.length ? list.map(r => `<button class="tile" style="width:100%;text-align:left" data-act="kid-attach" data-fid="${r.fid}" data-id="${r.id}"><span style="font-size:28px">${esc(r.emoji || '🧒')}</span><span class="f1"><b>${esc(r.prenom)} ${esc(r.nom || '')}</b><br><span class="small muted">${esc(r.fname)}</span></span><span class="lnk">Rattacher ›</span></button>`).join('')
    : '<div class="empty">Aucun autre enfant dans vos autres cercles.</div>';
}
function inviteMessage(i) {
  const f = S.family, kids = childNames(S.children.map(c => c.id));
  return `Bonjour ${i.prenom || ''}, ${myName()} vous invite à rejoindre « ${f.name} » sur SJ Family${kids ? ` pour organiser la garde de ${kids}` : ''}.\n\n1) Ouvrez : ${SHARE_URL}#/join?code=${f.joinCode}\n2) Installez l'application et créez votre compte\n3) « Rejoindre un cercle » avec le code : ${f.joinCode}`;
}
function sendInviteSheet(i) {
  const msg = inviteMessage(i), enc = encodeURIComponent(msg), phone = (i.phone || '').replace(/[^\d+]/g, '');
  openSheet(`<h3 class="sh-title">✉️ Envoyer l'invitation</h3><p class="muted small">L'invitation reste « en attente » jusqu'à ce que ${esc(i.prenom || 'la personne')} crée son compte avec le code.</p>
    <div class="note"><div class="nx small">${esc(msg)}</div></div>
    <div class="row gap wrap">${phone ? `<a class="btn primary f1" href="sms:${phone}?body=${enc}">${IC.sms} SMS</a><a class="btn soft f1" href="https://wa.me/${phone.replace(/^0/, '33').replace('+', '')}?text=${enc}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
    ${i.email ? `<a class="btn primary f1" href="mailto:${esc(i.email)}?subject=${encodeURIComponent('Invitation SJ Family')}&body=${enc}">${IC.mail} E-mail</a>` : ''}
    <button class="btn ghost f1" data-act="inv-copy" data-msg="${esc(msg)}">${IC.copy} Copier</button></div>`);
}
export const actions = {
  'fam-create': () => createSheet(),
  'fam-join': () => joinSheet(LS.get('pendingJoin', '') || ''),
  'fam-menu': () => openSheet(`<h3 class="sh-title">Cercles</h3><button class="btn primary block" data-act="fam-create">🏡 Créer un nouveau cercle</button><button class="btn ghost block mt" data-act="fam-join">🔑 Rejoindre avec un code</button>`),
  'fam-create-go': async el => {
    const f = readForm(el.closest('.sheet'));
    if (!f.name) return toast('Donnez un nom au cercle.', 'warn');
    el.disabled = true;
    const fid = await guard(() => createFamily(f));
    if (!fid) { el.disabled = false; return; }
    const pc = S.pendingChild; S.pendingChild = null;
    if (pc) await guard(() => S.be.db.set(`families/${fid}/children/${S.be.db.newId()}`, { ...pc, createdAt: Date.now(), createdBy: uid() }));
    closeSheetsThen(() => { toast('Cercle créé 🎉'); go('home'); });
  },
  'fam-join-go': async el => {
    const f = readForm(el.closest('.sheet')), code = (f.code || '').toUpperCase().replace(/\s/g, '');
    if (code.length !== 6) return toast('Le code comporte 6 caractères.', 'warn');
    el.disabled = true;
    try { await joinFamily(code, f.role || 'parent', f.relation); closeSheetsThen(() => { toast('Bienvenue dans le cercle 🎉'); go('home'); }); }
    catch (e) { el.disabled = false; toast(e.code === 'join/not-found' ? e.message : (e.message || 'Erreur'), 'err', 4500); }
  },
  'fam-switch': async el => { if (el.dataset.id === S.fid) return; await guard(() => S.be.db.update(`users/${uid()}`, { currentFamily: el.dataset.id }), 'Cercle changé'); S.sel = new Set(); },
  'kid-ph-reset': el => { const sh = el.closest('.sheet'); sh._photo = null; sh.querySelector('[data-part="ph"]').innerHTML = kidAvatar({ emoji: readForm(sh).emoji || '🧒' }, 64); },
  'grp-photo': () => {
    const sh = openSheet(`<h3 class="sh-title">📷 Photo « Tous »</h3><p class="small muted">Affichée à la place du pictogramme quand tous les enfants sont sélectionnés. Visible par tout le cercle.</p>
      <div class="center" data-part="ph">${groupAvatar(120) || '<span class="kav e" style="width:120px;height:120px;font-size:80px">👨‍👧‍👦</span>'}</div>
      <div class="row gap mt"><label class="btn soft f1">📷 Photo<input type="file" accept="image/*" capture="environment" class="hide" data-ph="1"></label><label class="btn soft f1">🖼️ Galerie<input type="file" accept="image/*" class="hide" data-ph="1"></label></div>
      <div class="sh-actions">${S.family.groupPhoto ? `<button class="btn soft" data-act="grp-photo-del">↩️ Pictogramme</button>` : ''}<button class="btn ghost f1" data-act="close-sheet">Fermer</button></div>`);
    sh.querySelectorAll('[data-ph]').forEach(inp => inp.addEventListener('change', async () => {
      const file = inp.files[0]; if (!file) return;
      try { const ph = await squarePhoto(file, 480); await guard(async () => { await setFamily({ groupPhoto: ph }); await log('cercle', 'Nouvelle photo de groupe des enfants', { icon: '📷' }); }, 'Photo enregistrée'); closeSheet(); }
      catch (e) { toast('Photo illisible', 'err'); }
    }));
  },
  'grp-photo-del': async () => { await guard(async () => { await setFamily({ groupPhoto: null }); await log('cercle', 'Photo de groupe retirée', { icon: '📷' }); }, 'Pictogramme rétabli'); closeSheet(); },
  // accès d'un proche : proposé par un parent, validé par l'autre (le proche n'est prévenu qu'après validation)
  'perm-open': el => {
    const m = S.members.find(x => x.uid === el.dataset.id); if (!m || !isParent()) return;
    const pend = m.pendingPerms, cur = m.perms || {}, mine = pend && pend.by === uid();
    openSheet(`<h3 class="sh-title">👁️ Accès de ${esc(m.prenom || m.name)}</h3>
      <p class="small muted">Toujours visible : l'agenda à jour (garde et événements), les souvenirs et les notes de liaison qui lui sont adressées.</p>
      ${pend ? `<div class="alert"><div class="ai">⏳</div><div class="f1"><div class="at">${esc(pend.byName || memberName(pend.by))} propose : ${esc(PERM_KEYS.filter(x => pend.perms?.[x.k]).map(x => x.l).join(', ') || 'aucune rubrique en plus')}</div>
        ${!mine ? `<div class="row gap mt"><button class="btn ok sm" data-act="perm-ok" data-id="${m.uid}">✓ Valider</button><button class="btn danger sm" data-act="perm-no" data-id="${m.uid}">✗ Refuser</button></div>` : `<div class="small muted">En attente de validation par l'autre parent.</div><button class="btn soft sm mt" data-act="perm-no" data-id="${m.uid}">Annuler ma proposition</button>`}</div></div>` : ''}
      <label class="lbl">Rubriques en plus</label>
      ${PERM_KEYS.map(x => `<label class="row gap" style="padding:8px 0"><span class="sw"><input type="checkbox" name="p_${x.k}" ${cur[x.k] ? 'checked' : ''}><span></span></span><span class="f1">${x.l}</span></label>`).join('')}
      <div class="hint">${hasOtherParent() ? "L'autre parent devra valider ; " + esc(m.prenom || 'le proche') + " ne sera prévenu(e) qu'après validation." : 'Appliqué immédiatement.'}</div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="perm-save" data-id="${m.uid}">Enregistrer</button></div>`);
  },
  'perm-save': async el => {
    const m = S.members.find(x => x.uid === el.dataset.id); if (!m) return;
    const f = readForm(el.closest('.sheet')), perms = {}; for (const x of PERM_KEYS) perms[x.k] = !!f['p_' + x.k];
    const list = PERM_KEYS.filter(x => perms[x.k]).map(x => x.l.replace(/^\S+\s/, '')).join(', ') || 'agenda et souvenirs uniquement';
    if (hasOtherParent()) await guard(async () => { await updItem('members', m.uid, { pendingPerms: { perms, by: uid(), byName: myName(), at: Date.now() } }); await log('cercle', `Accès de ${m.prenom || m.name} à valider`, { body: list, icon: '🔐' }); }, "Proposition envoyée à l'autre parent");
    else await guard(async () => { await updItem('members', m.uid, { perms, pendingPerms: null }); await log('cercle', `Accès de ${m.prenom || m.name} : ${list}`, { icon: '🔐', to: [m.uid] }); }, 'Accès enregistrés');
    closeSheet();
  },
  'perm-ok': async el => {
    const m = S.members.find(x => x.uid === el.dataset.id), pend = m?.pendingPerms; if (!pend) return;
    const list = PERM_KEYS.filter(x => pend.perms?.[x.k]).map(x => x.l.replace(/^\S+\s/, '')).join(', ') || 'agenda et souvenirs uniquement';
    await guard(async () => { await updItem('members', m.uid, { perms: pend.perms || {}, pendingPerms: null }); await log('cercle', `Accès de ${m.prenom || m.name} validés : ${list}`, { icon: '🔐', to: [m.uid] }); }, 'Accès validés');
    closeSheet();
  },
  'perm-no': async el => {
    const m = S.members.find(x => x.uid === el.dataset.id); if (!m?.pendingPerms) return;
    await guard(async () => { await updItem('members', m.uid, { pendingPerms: null }); await log('cercle', `Changement d'accès de ${m.prenom || m.name} ${m.pendingPerms.by === uid() ? 'annulé' : 'refusé'}`, { icon: '🔐' }); }, 'Proposition retirée');
    closeSheet();
  },
  'st-save': async () => {
    const v = S.ui.statusSel; if (!v || v === S.family.status) return;
    if (needsValidation()) await guard(async () => { await setFamily({ pendingStatus: { value: v, label: STATUS[v], by: uid(), byName: myName(), at: Date.now() } }); await log('cercle', `Changement de statut proposé : ${STATUS[v]}`); }, 'Proposition envoyée à l\'autre parent');
    else await guard(async () => { await setFamily({ status: v }); await log('cercle', `Statut mis à jour : ${STATUS[v]}`); }, 'Statut enregistré');
    S.ui.statusSel = null;
  },
  'st-validate': async () => { const p = S.family.pendingStatus; if (!p) return; await guard(async () => { await setFamily({ status: p.value, pendingStatus: null, statusValidatedBy: uid(), statusValidatedAt: Date.now() }); await log('cercle', `Statut validé : ${STATUS[p.value]}`); }, 'Statut validé'); S.ui.statusSel = null; },
  'st-refuse': async () => { const p = S.family.pendingStatus; if (!p) return; await guard(async () => { await setFamily({ pendingStatus: null }); await log('cercle', `Changement de statut refusé : ${STATUS[p.value]}`); }, 'Proposition refusée'); S.ui.statusSel = null; },
  'kid-check': el => { const s = new Set(S.ui.famSel || []); s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.add(el.dataset.id); S.ui.famSel = [...s]; S.render(); },
  'kid-add': () => kidSheet(),
  'kid-edit': el => kidSheet(S.children.find(c => c.id === el.dataset.id)),
  'kid-tab': (el) => {
    const sh = el.closest('.sheet'); sh.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b === el));
    sh.querySelector('[data-part="new"]').classList.toggle('hide', el.dataset.t !== 'new'); sh.querySelector('[data-part="exist"]').classList.toggle('hide', el.dataset.t !== 'exist');
    if (el.dataset.t === 'exist') loadOtherKids(sh);
  },
  'kid-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), id = el.dataset.id;
    if (!f.prenom) return toast('Le prénom est obligatoire.', 'warn');
    const data = { prenom: f.prenom.trim(), nom: (f.nom || '').toUpperCase(), birth: f.birth || '', emoji: f.emoji || '🧒', photo: sh._photo || null };
    if (id) {
      const old = S.children.find(c => c.id === id), det = {}; for (const [k] of KID_FIELDS) det[k] = f[k] || '';
      const photoChanged = (old?.photo || null) !== data.photo;
      await guard(async () => {
        await updItem('children', id, data); await S.be.db.set(fpath('childInfo', id), det, true);
        await log('cercle', photoChanged ? (data.photo ? `Nouvelle photo de ${data.prenom}` : `${data.prenom} : retour au pictogramme`) : `Fiche de ${data.prenom} mise à jour`, { icon: photoChanged ? '📷' : null });
      }, 'Fiche enregistrée');
      closeSheet(); return;
    }
    if (f.dest === 'new') { closeSheetsThen(() => createSheet(data)); return; }
    el.disabled = true;
    const fid = f.dest && f.dest !== 'cur' ? f.dest : S.fid;
    const ok = await guard(async () => {
      await S.be.db.set(`families/${fid}/children/${S.be.db.newId()}`, { ...data, createdAt: Date.now(), createdBy: uid() });
      if (fid === S.fid) await log('cercle', `Nouvel enfant : ${data.prenom}`); return true;
    }, fid === S.fid ? `${data.prenom} ajouté(e)` : `${data.prenom} ajouté(e) à l'autre cercle`);
    if (ok) closeSheet(); else el.disabled = false;
  },
  'kid-attach': async el => {
    const src = await S.be.db.get(`families/${el.dataset.fid}/children/${el.dataset.id}`); if (!src) return;
    const { id, ...data } = src;
    await guard(async () => { await addItem('children', { ...data, linkedFrom: { fid: el.dataset.fid, id } }); await log('cercle', `${data.prenom} rattaché(e) au cercle`); }, `${data.prenom} rattaché(e)`);
    closeSheet();
  },
  'kid-copy': el => {
    const c = S.children.find(x => x.id === el.dataset.id); if (!c) return;
    const fams = (S.profile?.familyIds || []).filter(id => id !== S.fid).map(id => S.families[id]).filter(Boolean);
    openSheet(`<h3 class="sh-title">📋 Rattacher ${esc(c.prenom)}</h3><p class="muted small">La fiche sera copiée dans le cercle choisi ; chaque cercle gère sa propre garde.</p>
      ${fams.map(f => `<button class="tile" style="width:100%;text-align:left" data-act="kid-copy-go" data-id="${c.id}" data-fid="${f.id}"><span class="f1 b">${esc(f.name)}</span><span class="lnk">›</span></button>`).join('')}`);
  },
  'kid-copy-go': async el => {
    const c = S.children.find(x => x.id === el.dataset.id); if (!c) return; const { id, ...data } = c;
    await guard(() => S.be.db.set(`families/${el.dataset.fid}/children/${S.be.db.newId()}`, { ...data, linkedFrom: { fid: S.fid, id }, createdAt: Date.now(), createdBy: uid() }), 'Fiche copiée');
    closeSheet();
  },
  'kid-del': async el => {
    const c = S.children.find(x => x.id === el.dataset.id); if (!c) return;
    if (!(await confirmBox(`Retirer ${c.prenom} ?`, 'La fiche est supprimée de ce cercle. Les plannings, dépenses et documents existants sont conservés.', 'Retirer', true))) return;
    await guard(async () => { await S.be.db.del(fpath('children', c.id)); await log('cercle', `${c.prenom} retiré(e) du cercle`); }, 'Enfant retiré');
    go('family');
  },
  'kid-multi': () => {
    const sel = (S.ui.famSel || []).filter(id => S.children.some(c => c.id === id));
    openSheet(`<h3 class="sh-title">✏️ Modifier ${sel.length} enfants</h3><p class="muted small">${esc(childNames(sel))} — seuls les champs remplis seront appliqués à tous.</p>
      ${KID_FIELDS.map(([k, l, t]) => `<label class="lbl">${l}</label><input class="in" ${t ? `type="${t}"` : ''} name="${k}">`).join('')}
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="kid-multi-go">Enregistrer</button></div>`);
  },
  'kid-multi-go': async el => {
    const f = readForm(el.closest('.sheet')), sel = (S.ui.famSel || []).filter(id => S.children.some(c => c.id === id));
    const data = {}; for (const [k] of KID_FIELDS) if (f[k]) data[k] = f[k];
    if (!Object.keys(data).length) return toast('Remplissez au moins un champ.', 'warn');
    await guard(async () => { for (const id of sel) await S.be.db.set(fpath('childInfo', id), data, true); await log('cercle', `Fiches mises à jour : ${childNames(sel)}`); }, 'Fiches enregistrées');
    closeSheet();
  },
  'par-edit': el => {
    const c = el.dataset.c, p = parents()[c];
    openSheet(`<h3 class="sh-title">✏️ ${esc(p.name)}</h3>
      <div class="two"><div><label class="lbl">Prénom affiché</label><input class="in" name="name" value="${esc(p.name)}"></div><div><label class="lbl">Appellation</label><input class="in" name="short" value="${esc(p.short)}" placeholder="Papa, Maman…"></div></div>
      <label class="lbl">Téléphone</label><input class="in" type="tel" name="phone" value="${esc(p.phone)}">
      <label class="lbl">E-mail</label><input class="in" type="email" name="email" value="${esc(p.email)}">
      <label class="lbl">Couleur sur le calendrier</label>${chips('color', PARENT_COLORS.map(x => ({ v: x, l: '&nbsp;', style: `background:${x};width:44px;height:36px` })), [p.color])}
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="par-save" data-c="${c}">Enregistrer</button></div>`);
  },
  'par-save': async el => {
    const c = el.dataset.c, f = readForm(el.closest('.sheet'));
    if (!f.name) return toast('Prénom obligatoire.', 'warn');
    await guard(async () => { await setFamily({ [`parents.${c}.name`]: f.name, [`parents.${c}.short`]: f.short || f.name, [`parents.${c}.phone`]: f.phone, [`parents.${c}.email`]: f.email, [`parents.${c}.color`]: f.color || PARENT_COLORS[c === 'A' ? 0 : 1] }); await log('cercle', `Informations de ${f.name} mises à jour`); }, 'Enregistré');
    closeSheet();
  },
  'inv-new': () => openSheet(`<h3 class="sh-title">✉️ Inviter</h3>
    <div class="two"><div><label class="lbl">Prénom</label><input class="in" name="prenom"></div><div><label class="lbl">Nom</label><input class="in" name="nom"></div></div>
    <label class="lbl">Rôle</label>${chips('role', [{ v: 'proche', l: '👵 Proche' }, ...(!parents().B.uid ? [{ v: 'parent', l: "👪 L'autre parent" }] : [])], ['proche'])}
    <label class="lbl">Lien</label><input class="in" name="relation" placeholder="Grand-mère, nounou…">
    <label class="lbl">Téléphone</label><input class="in" type="tel" name="phone" placeholder="06…"><label class="lbl">E-mail</label><input class="in" type="email" name="email">
    <div class="hint">La personne recevra un SMS ou un e-mail avec le lien et le code. Elle n'apparaîtra comme membre qu'après avoir créé son compte.</div>
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="inv-save">Enregistrer</button></div>`),
  'inv-save': async el => {
    const f = readForm(el.closest('.sheet'));
    if (!f.prenom || (!f.phone && !f.email)) return toast('Prénom et téléphone ou e-mail requis.', 'warn');
    const data = { prenom: f.prenom, nom: f.nom, role: f.role || 'proche', relation: f.relation, phone: f.phone, email: (f.email || '').toLowerCase(), state: 'pending', by: uid(), byName: myName(), at: Date.now() };
    const id = await guard(async () => { const i = await addItem('invites', data); await log('cercle', `Invitation envoyée à ${f.prenom}`); return i; });
    if (id) closeSheetsThen(() => sendInviteSheet(data));
  },
  'inv-send': el => { const i = S.invites.find(x => x.id === el.dataset.id); if (i) sendInviteSheet(i); },
  'inv-del': async el => { const i = S.invites.find(x => x.id === el.dataset.id); if (!i) return; if (!(await confirmBox('Supprimer cette invitation ?', esc(i.prenom), 'Supprimer', true))) return; await guard(() => S.be.db.del(fpath('invites', i.id)), 'Invitation supprimée'); },
  'inv-copy': async el => { (await copyText(el.dataset.msg)) ? toast('Message copié') : toast('Copie impossible', 'err'); },
  'code-copy': async () => { (await copyText(S.family.joinCode)) ? toast('Code copié') : toast('Copie impossible', 'err'); },
  'code-share': async () => {
    const msg = inviteMessage({ prenom: '' });
    if (navigator.share) { try { await navigator.share({ title: 'SJ Family', text: msg }); } catch (e) { /* annulé */ } }
    else { (await copyText(msg)) ? toast('Invitation copiée') : toast('Copie impossible', 'err'); }
  },
};
