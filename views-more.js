// ═══════════════ Tâches, liaison, documents, répertoire, souvenirs, notifications, réglages, profil, widgets ═══════════════
import * as E from './engine.js';
import { randomId } from './backend.js';
import { S, engine, parents, pName, pShort, uid, me, myName, myCode, isParent, childName, childNames, settings, addItem, updItem, log, guard, fpath, go, needsValidation, setFamily, selIds, selChildren, CATS, APP_URL, APK_URL, SCRIPT_URL, FEED_URL, VERSION, syncFeed, ntfyPublish, avatar, LS } from './core.js';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, IC, fmtStamp, fmtAgo, compressImage, fileToDataURL, dataURLtoBlob, copyText, closeSheetsThen } from './ui.js';
import { kidChips, countdown } from './views-home.js';

const kidChipsForm = (sel = selIds()) => chips('childIds', S.children.map(c => ({ v: c.id, l: `${c.emoji || ''} ${esc(c.prenom)}` })), sel, { multi: true });
const matchKids = item => { const ids = selIds(); return !item.childIds?.length || item.childIds.some(i => ids.includes(i)); };

// ───────────── Notifications & historique
export function unreadCount() {
  const last = S.profile?.lastSeen?.[S.fid] || 0, me = uid();
  return S.activity.filter(a => a.by !== me && a.at > last).length;
}
// ───────────── Tâches
const TCATS = [{ v: 'admin', l: '🗂️ Administratif' }, { v: 'ecole', l: '📚 École' }, { v: 'sante', l: '🩺 Santé' }, { v: 'maison', l: '🏠 Maison' }, { v: 'courses', l: '🛒 Courses' }, { v: 'relais', l: '🎒 Valise du relais' }, { v: 'autre', l: '📌 Autre' }];
function assigneeLabel(a) { if (a === 'all') return 'Tout le monde'; const m = S.members.find(x => x.uid === a); return m ? (m.uid === uid() ? 'Moi' : m.prenom || m.name) : '—'; }
function taskSheet(t = null) {
  const x = t || { childIds: selIds(), assignee: 'all', cat: 'autre' };
  openSheet(`<h3 class="sh-title">${t ? '✏️ Modifier la tâche' : '✅ Nouvelle tâche'}</h3>
    <label class="lbl">Tâche</label><input class="in" name="title" value="${esc(x.title || '')}" placeholder="Ex. Renouveler la carte d'identité">
    <label class="lbl">Échéance</label><input class="in" type="date" name="due" value="${x.due || ''}">
    <label class="lbl">Catégorie</label>${chips('cat', TCATS, [x.cat])}
    <label class="lbl">Confiée à</label>${chips('assignee', [{ v: 'all', l: '👪 Tout le monde' }, ...S.members.map(m => ({ v: m.uid, l: m.uid === uid() ? '🙋 Moi' : esc(m.prenom || m.name) }))], [x.assignee])}
    <label class="lbl">Enfants</label>${kidChipsForm(x.childIds)}
    <label class="lbl">Note</label><textarea class="in" name="note" rows="2">${esc(x.note || '')}</textarea>
    <div class="sh-actions">${t ? `<button class="btn danger" data-act="task-del" data-id="${t.id}">${IC.trash}</button>` : ''}<button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="task-save" data-id="${t?.id || ''}">Enregistrer</button></div>`);
}
function taskRow(t) {
  const late = t.due && !t.done && t.due < E.todayISO();
  return `<div class="li"><button class="ck ${t.done ? 'on' : ''}" data-act="task-done" data-id="${t.id}">${t.done ? '✓' : ''}</button>
    <button class="f1" style="text-align:left" data-act="task-open" data-id="${t.id}"><div class="lt" style="${t.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(t.title)}</div>
    <div class="ls">${t.due ? `<span style="${late ? 'color:var(--err);font-weight:800' : ''}">📅 ${E.fmtDate(t.due, 'wdm')}</span> · ` : ''}${esc(assigneeLabel(t.assignee))}${t.childIds?.length ? ' · ' + esc(childNames(t.childIds)) : ''}${t.done ? ` · fait par ${esc(t.doneByName || '')}` : ''}</div></button></div>`;
}

// ───────────── Liaison
const NTAGS = [{ v: 'sante', l: '🤒 Santé' }, { v: 'ecole', l: '📚 École / devoirs' }, { v: 'humeur', l: '🙂 Humeur' }, { v: 'repas', l: '🍽️ Repas' }, { v: 'sommeil', l: '😴 Sommeil' }, { v: 'affaires', l: '🎒 Affaires' }, { v: 'autre', l: '💬 Autre' }];
// ───────────── Documents
const DCATS = [{ v: 'sante', l: '🩺 Santé' }, { v: 'ecole', l: '📚 École' }, { v: 'identite', l: '🪪 Identité' }, { v: 'juridique', l: '⚖️ Juridique' }, { v: 'assurance', l: '🛡️ Assurance' }, { v: 'autre', l: '📄 Autre' }];
// ───────────── Répertoire
const CCATS = [{ v: 'sante', l: '🩺 Santé' }, { v: 'ecole', l: '🏫 École' }, { v: 'garde', l: '🧸 Garde' }, { v: 'famille', l: '👵 Famille' }, { v: 'activite', l: '⚽ Activités' }, { v: 'urgence', l: '🚨 Urgence' }, { v: 'autre', l: '📇 Autre' }];

async function saveBlob(data, mime, name) { const id = S.be.db.newId(); await S.be.db.set(fpath('blobs', id), { data, mime, name: name || '', at: Date.now(), by: uid() }); return id; }
async function openBlob(id, title) {
  const sh = openSheet(`<h3 class="sh-title">${esc(title)}</h3><div data-part="b"><div class="boot" style="height:140px"><div class="spin"></div></div></div><button class="btn primary block mt" data-act="close-sheet">Fermer</button>`);
  const b = await S.be.db.get(fpath('blobs', id)), box = sh.querySelector('[data-part="b"]');
  if (!b) { box.innerHTML = '<p class="muted">Fichier introuvable.</p>'; return; }
  if ((b.mime || '').startsWith('image')) box.innerHTML = `<img class="receipt" style="max-height:70vh" src="${b.data}">`;
  else { const url = URL.createObjectURL(dataURLtoBlob(b.data)); box.innerHTML = `<a class="btn soft block" href="${url}" target="_blank" rel="noopener">📄 Ouvrir le document</a><a class="btn ghost block mt" href="${url}" download="${esc(b.name || title)}">${IC.download} Télécharger</a>`; }
}

function iphoneLoader(token) {
  return `// SJ Family — widget iPhone (Scriptable)\n// Paramètre du widget : Selman, Jandal ou Tous (+ ;semaine ;mois ;programme)\nconst TOKEN = "${token}";\nconst SRC = "${SCRIPT_URL}";\nconst fm = FileManager.local(), path = fm.joinPath(fm.documentsDirectory(), "sjfamily-widget.js");\nlet code = null;\ntry { const r = new Request(SRC + "?t=" + Date.now()); r.timeoutInterval = 12; const c = await r.loadString(); if (c && c.includes("SJF_WIDGET")) { code = c; fm.writeString(path, c); } } catch (e) {}\nif (!code && fm.fileExists(path)) code = fm.readString(path);\nif (!code) throw new Error("Ouvrez ce script une première fois avec internet.");\nawait (new Function("TOKEN", "args", "config", "return (async () => {\\n" + code + "\\n})()"))(TOKEN, args, config);\n`;
}
function widgetPreview() {
  const k = selChildren()[0]; if (!k) return '';
  const eng = engine(), today = E.todayISO(), who = eng.presence(k.id, today, E.nowMin()), nx = eng.nextHandovers([k.id], today, E.nowMin(), 1)[0];
  const mon = E.mondayOf(today);
  const col = c => c === 'A' ? parents().A.color : c === 'B' ? parents().B.color : c === 'a' ? '#DCEAF6' : c === 'b' ? '#FDEADB' : '#ddd';
  return `<div class="wprev"><div class="wbox s"><div class="wn">${esc(k.emoji || '')} ${esc(k.prenom)}</div><div class="wb">Chez ${esc(who ? pShort(who) : '—')}</div>
    ${nx ? `<div class="wsm">🔁 ${esc(E.relDay(nx.date))} ${E.fmtTime(nx.time)}<br>→ ${esc(pShort(nx.to))} · ${countdown(nx.date, nx.time)}</div>` : ''}</div>
    <div class="wbox m"><div class="row between"><div class="wn">${esc(k.prenom)} · semaine</div><div class="wn">${esc(who ? 'Chez ' + pShort(who) : '')}</div></div>
    <div class="wweek">${[...Array(7)].map((_, i) => { const d = E.addDays(mon, i), c = eng.code(k.id, d); return `<div style="background:${col(c)};${d === today ? 'outline:2px solid #fff' : ''}">${E.JOURS_L[i]}<br>${+d.slice(8)}</div>`; }).join('')}</div>
    ${nx ? `<div class="wsm">🔁 Relais ${esc(E.relDay(nx.date))} à ${E.fmtTime(nx.time)} → ${esc(pName(nx.to))}</div>` : ''}</div></div>`;
}

export const views = {
  tasks() {
    const open = S.tasks.filter(t => !t.done && matchKids(t)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const done = S.tasks.filter(t => t.done && matchKids(t)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    return {
      title: 'Tâches', back: 'home',
      html: `${kidChips()}<button class="btn primary block mb mt" data-act="task-new">${IC.plus} Nouvelle tâche</button>
      <div class="card">${open.length ? open.map(taskRow).join('') : '<div class="empty"><div class="e-i">🎉</div>Rien à faire pour le moment.</div>'}</div>
      ${done.length ? `<details class="card"><summary class="b">Terminées (${done.length})</summary>${done.slice(0, 60).map(taskRow).join('')}</details>` : ''}`,
    };
  },
  liaison() {
    const notes = S.notes.filter(matchKids).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at);
    const me = uid();
    return {
      title: 'Cahier de liaison', back: 'home',
      html: `${kidChips()}<button class="btn primary block mb mt" data-act="note-new">✍️ Écrire une note</button>
      <div class="hint mb">Transmettez les informations utiles au relais : santé, devoirs, humeur, affaires à rendre…</div>
      ${notes.length ? notes.map(n => {
        const ack = Object.entries(n.ackBy || {}).filter(([u]) => u !== n.createdBy);
        return `<div class="note"><div class="nh">${avatar(n.createdByName, '#C9A24A', 28)}<b style="color:var(--text)">${esc(n.createdByName)}</b><span>${fmtStamp(n.at)}</span>${n.pinned ? '<span>📌</span>' : ''}</div>
          ${(n.tags || []).length ? `<div class="row wrap gap6 mb">${n.tags.map(t => `<span class="pill">${NTAGS.find(x => x.v === t)?.l || t}</span>`).join('')}${n.childIds?.length ? `<span class="pill navy">${esc(childNames(n.childIds))}</span>` : ''}</div>` : (n.childIds?.length ? `<div class="mb"><span class="pill navy">${esc(childNames(n.childIds))}</span></div>` : '')}
          <div class="nx">${esc(n.text)}</div>
          <div class="row between mt"><span class="tiny muted">${ack.length ? '✓ Lu par ' + ack.map(([u, t]) => `${esc(S.members.find(m => m.uid === u)?.prenom || '?')} (${fmtAgo(t)})`).join(', ') : n.createdBy === me ? 'Pas encore lu' : ''}</span>
          ${n.createdBy === me ? `<span class="row gap6"><button class="ib" data-act="note-pin" data-id="${n.id}">📌</button><button class="ib" data-act="note-del" data-id="${n.id}">${IC.trash}</button></span>` : ''}</div></div>`;
      }).join('') : '<div class="card empty"><div class="e-i">📒</div>Aucune note pour le moment.</div>'}`,
    };
  },
  docs(p) {
    const cat = p.cat || '', list = S.docs.filter(d => (!cat || d.cat === cat) && matchKids(d)).sort((a, b) => b.createdAt - a.createdAt);
    return {
      title: 'Documents', back: 'home',
      html: `${kidChips()}<button class="btn primary block mb mt" data-act="doc-new">${IC.plus} Ajouter un document</button>
      <div class="chips scroll mb"><button class="chip sm ${!cat ? 'on' : ''}" data-go="docs">Tous</button>${DCATS.map(c => `<button class="chip sm ${cat === c.v ? 'on' : ''}" data-go="docs" data-params='{"cat":"${c.v}"}'>${c.l}</button>`).join('')}</div>
      <div class="card">${list.length ? list.map(d => `<div class="li"><button class="le" data-act="doc-open" data-id="${d.id}">${(d.mime || '').startsWith('image') ? '🖼️' : '📄'}</button><button class="f1" style="text-align:left" data-act="doc-open" data-id="${d.id}"><div class="lt">${esc(d.title)}</div><div class="ls">${DCATS.find(c => c.v === d.cat)?.l || ''}${d.childIds?.length ? ' · ' + esc(childNames(d.childIds)) : ''} · ${E.fmtDate(new Date(d.createdAt).toISOString().slice(0, 10), 'num')} · ${esc(d.createdByName || '')}</div></button>
        <button class="ib" data-act="doc-del" data-id="${d.id}">${IC.trash}</button></div>`).join('') : '<div class="empty"><div class="e-i">📁</div>Coffre-fort vide. Ajoutez carnet de santé, certificats, jugement…</div>'}</div>
      <div class="hint center">Photos compressées automatiquement · PDF jusqu'à 700 Ko.</div>`,
    };
  },
  contacts(p) {
    const cat = p.cat || '', list = S.contacts.filter(c => !cat || c.cat === cat).sort((a, b) => a.name.localeCompare(b.name));
    return {
      title: 'Répertoire', back: 'home',
      html: `<button class="btn primary block mb" data-act="ct-new">${IC.plus} Nouveau contact</button>
      <div class="chips scroll mb"><button class="chip sm ${!cat ? 'on' : ''}" data-go="contacts">Tous</button>${CCATS.map(c => `<button class="chip sm ${cat === c.v ? 'on' : ''}" data-go="contacts" data-params='{"cat":"${c.v}"}'>${c.l}</button>`).join('')}</div>
      <div class="card">${list.length ? list.map(c => `<div class="li"><div class="le">${(CCATS.find(x => x.v === c.cat)?.l || '📇').split(' ')[0]}</div><button class="f1" style="text-align:left" data-act="ct-open" data-id="${c.id}"><div class="lt">${esc(c.name)}</div><div class="ls">${esc(c.role || '')}${c.childIds?.length ? ' · ' + esc(childNames(c.childIds)) : ''}${c.phone ? ' · ' + esc(c.phone) : ''}</div></button>
        ${c.phone ? `<a class="ib" href="tel:${esc(c.phone)}">${IC.phone}</a>` : ''}${c.email ? `<a class="ib" href="mailto:${esc(c.email)}">${IC.mail}</a>` : ''}</div>`).join('') : '<div class="empty"><div class="e-i">📞</div>Ajoutez médecin, école, nounou, grands-parents…</div>'}</div>`,
    };
  },
  memories() {
    const list = S.memories.filter(matchKids).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
    return {
      title: 'Souvenirs', back: 'home',
      html: `${kidChips()}<button class="btn primary block mb mt" data-act="mem-new">📸 Ajouter des photos</button>
      ${list.length ? `<div class="grid3">${list.map(m => `<button class="ph" data-act="mem-open" data-id="${m.id}">${m.thumb ? `<img src="${m.thumb}" alt="">` : '📷'}<span>${esc(m.title || E.fmtDate(m.date, 'short'))}</span></button>`).join('')}</div>` : '<div class="card empty"><div class="e-i">📸</div>Partagez les beaux moments avec l\'autre parent.</div>'}`,
    };
  },
  notifs(p) {
    const tab = p.tab || 'notifs', cat = p.cat || '', me = uid(), last = S.profile?.lastSeen?.[S.fid] || 0;
    let list = tab === 'notifs' ? S.activity.filter(a => a.by !== me) : S.activity;
    const counts = {}; for (const a of list) counts[a.cat] = (counts[a.cat] || 0) + 1;
    if (cat) list = list.filter(a => a.cat === cat);
    // regroupement par jour
    let html = '', day = '';
    for (const a of list) {
      const d = new Date(a.at), iso = E.todayISO(d);
      if (iso !== day) { day = iso; html += `<div class="lbl">${E.fmtDate(iso, 'wdmy')}</div>`; }
      html += `<div class="card tight" style="margin-bottom:8px;${a.at > last && a.by !== me ? 'border-left:5px solid var(--coral)' : ''}"><div class="row gap"><div style="font-size:28px">${a.icon || CATS[a.cat]?.i || '🔔'}</div><div class="f1"><div class="b">${esc(a.title)}</div>
        <div class="small muted">${esc(a.byName || '')}${a.body ? ' — ' + esc(a.body) : ''}</div><div class="tiny muted">${fmtStamp(a.at)}</div></div></div></div>`;
    }
    return {
      title: 'Notifications',
      html: `<div class="seg"><button class="${tab === 'notifs' ? 'on' : ''}" data-go="notifs" data-params='{"tab":"notifs"}'>🔔 Notifications</button><button class="${tab === 'hist' ? 'on' : ''}" data-go="notifs" data-params='{"tab":"hist"}'>📜 Historique complet</button></div>
      <div class="chips scroll mb"><button class="chip sm ${!cat ? 'on' : ''}" data-go="notifs" data-params='{"tab":"${tab}"}'>Tout</button>${Object.entries(CATS).filter(([k]) => counts[k]).map(([k, c]) => `<button class="chip sm ${cat === k ? 'on' : ''}" data-go="notifs" data-params='{"tab":"${tab}","cat":"${k}"}'>${c.i} ${c.n} (${counts[k]})</button>`).join('')}</div>
      ${html || `<div class="card empty"><div class="e-i">🔕</div>${tab === 'notifs' ? 'Aucune notification. Vos propres actions apparaissent dans l\'historique.' : 'Aucune activité.'}</div>`}`,
    };
  },
  settings() {
    const st = settings(), f = S.family, ps = f.pendingSettings, m = me(), u = uid();
    return {
      title: 'Réglages', back: 'home',
      html: `<div class="card"><h3>🔁 Relais <a class="act" data-act="set-relais">${isParent() ? 'Modifier' : ''}</a></h3>
        <div class="prow"><span>Relais du soir</span><b>${E.fmtTime(st.handoverTime)}</b></div><div class="prow"><span>Relais de mi-journée (demi-journées)</span><b>${E.fmtTime(st.middayTime)}</b></div>
        <div class="hint">Une garde commençant un jour = récupération la veille à ${E.fmtTime(st.handoverTime)}. Le dernier jour, remise à l'autre parent à ${E.fmtTime(st.handoverTime)} sauf accord différent.</div>
        ${ps ? `<div class="alert mt"><div class="ai">⏳</div><div class="f1"><div class="at">${esc(ps.byName)} propose : soir ${E.fmtTime(ps.handoverTime)} · mi-journée ${E.fmtTime(ps.middayTime)}</div>
          ${ps.by !== u && isParent() ? `<div class="row gap mt"><button class="btn ok sm" data-act="set-relais-ok">✓ Valider</button><button class="btn danger sm" data-act="set-relais-no">✗ Refuser</button></div>` : '<div class="small muted">En attente de validation.</div>'}</div></div>` : ''}</div>
      <div class="card"><h3>🏖️ Vacances scolaires <a class="act" data-act="set-zone">Modifier</a></h3><div class="prow"><span>Zone</span><b>${st.zone}</b></div>
        <div class="prow"><span>Périodes personnalisées</span><b>${(st.customHolidays || []).length}</b></div></div>
      <div class="card"><h3>📲 Notifications push</h3>
        <div class="prow"><span>Alertes sur ce téléphone</span><b>${m.ntfyOn ? '✅ Activées' : '⏸️ Désactivées'}</b></div>
        <div class="prow"><span>Rappel avant chaque relais</span><b>${m.remind === 'off' ? 'Aucun' : (m.remind || 120) >= 60 ? ((m.remind || 120) / 60) + ' h avant' : m.remind + ' min avant'}</b></div>
        <button class="btn primary block mt" data-act="push-setup">Configurer</button>
        <div class="hint">Gratuit, sans compte, sur iPhone et Samsung, via l'application « ntfy ». Vous n'êtes jamais notifié de vos propres actions.</div></div>
      <div class="card"><h3>📱 Widgets</h3><p class="small muted" style="margin-top:0">Garde du jour, semaine, mois et programme sur l'écran d'accueil.</p><button class="btn ghost block" data-go="widgets">Configurer les widgets</button></div>
      <div class="card"><h3>📤 Exporter</h3><button class="btn soft block" data-act="ics-sheet">📅 Vers Google Agenda / Samsung / iPhone (.ics)</button><button class="btn soft block mt" data-act="exp-csv">💰 Dépenses (tableur .csv)</button><button class="btn soft block mt" data-act="print-year">🖨️ Imprimer le calendrier annuel</button></div>
      <div class="card"><h3>ℹ️ Application</h3><div class="prow"><span>Version</span><b>SJ Family ${VERSION}${S.be.mode === 'demo' ? ' (démo)' : ''}</b></div>
        <button class="btn soft block mt" data-act="app-refresh">${IC.refresh} Mettre à jour / vider le cache</button>
        ${S.be.mode === 'demo' ? `<button class="btn soft block mt" data-act="demo-off">Quitter le mode démo</button>` : ''}
        <button class="btn soft block mt" style="color:var(--err)" data-act="logout">${IC.logout} Se déconnecter</button></div>`,
    };
  },
  profile() {
    const p = S.profile || {};
    return {
      title: 'Mon profil', back: 'home',
      html: `<div class="card center">${avatar(p.prenom, 'var(--navy2)', 80)}<h2 class="mt">${esc(p.prenom || '')} ${esc(p.nom || '')}</h2><div class="muted">${esc(p.email || S.user?.email || '')}</div><div class="muted">${esc(p.phone || '')}</div>
        <button class="btn primary block mt" data-act="prof-edit">${IC.edit} Modifier mes informations</button></div>
      <div class="card"><button class="btn soft block" data-act="prof-pw">${IC.lock} Changer de mot de passe</button><button class="btn soft block mt" style="color:var(--err)" data-act="logout">${IC.logout} Se déconnecter</button></div>`,
    };
  },
  widgets() {
    const f = S.family, tok = f.widgetToken;
    const kids = S.children.map(c => c.prenom).join(', ');
    const intent = tok ? `intent://link?t=${tok}#Intent;scheme=sjfamily;package=fr.sjfamily.widgets;end` : '';
    return {
      title: 'Widgets', back: 'home',
      html: `<div class="alert info"><div class="ai">📱</div><div class="small">Les widgets affichent la garde du jour, la semaine, le mois ou le programme d'un enfant ou des deux. Ils se mettent à jour automatiquement à chaque modification, sans ouvrir l'application.</div></div>
      ${!tok ? `<div class="card center"><div style="font-size:46px">🔐</div><p>Activez le flux sécurisé des widgets (lien secret, impossible à deviner, que vous seuls connaissez).</p><button class="btn primary block" data-act="w-enable">Activer les widgets</button></div>` : `
      ${kidChips()}<div class="card"><h3>👁️ Aperçu</h3>${widgetPreview()}</div>
      <div class="card"><h3>🤖 Samsung / Android</h3>
        <div class="steps"><div class="st"><span class="sn">1</span><span class="f1">Installez l'app <b>SJ Widgets</b> (Android, gratuite). Autorisez « installer des applis inconnues » si demandé.</span></div>
        <div class="st"><span class="sn">2</span><span class="f1">Revenez ici et touchez <b>Connecter mes widgets</b> (ou collez le code dans l'app).</span></div>
        <div class="st"><span class="sn">3</span><span class="f1">Appui long sur l'écran d'accueil → <b>Widgets</b> → <b>SJ Widgets</b> → choisissez Garde, Semaine, Mois ou Programme puis l'enfant (${esc(kids)} ou Tous).</span></div></div>
        <div class="row gap wrap mt"><a class="btn primary f1" href="${APK_URL}">${IC.download} Télécharger l'APK</a><a class="btn coral f1" href="${intent}">🔗 Connecter mes widgets</a></div>
        <button class="btn soft block mt" data-act="w-copy" data-v="${tok}">${IC.copy} Copier le code de connexion</button>
        <div class="hint">L'app SJ Widgets vous rappelle aussi chaque relais par une notification (2 h avant, réglable).</div></div>
      <div class="card"><h3>🍏 iPhone</h3>
        <div class="steps"><div class="st"><span class="sn">1</span><span class="f1">Installez l'app gratuite <a class="lnk" href="https://apps.apple.com/fr/app/scriptable/id1405459188" target="_blank" rel="noopener">Scriptable</a> (App Store).</span></div>
        <div class="st"><span class="sn">2</span><span class="f1">Touchez <b>Copier le script</b> ci-dessous, ouvrez Scriptable → <b>+</b> → collez → nommez-le <b>SJ Family</b> → ▶︎ une fois.</span></div>
        <div class="st"><span class="sn">3</span><span class="f1">Écran d'accueil : appui long → <b>+</b> → <b>Scriptable</b> → choisissez la taille → touchez le widget → Script : <b>SJ Family</b> · Paramètre : <b>${esc(S.children[0]?.prenom || 'Selman')}</b>, <b>Tous</b>… ajoutez <b>;semaine</b>, <b>;mois</b> ou <b>;programme</b> pour changer de vue.</span></div>
        <div class="st"><span class="sn">4</span><span class="f1">Écran verrouillé : même principe (widgets rectangulaires ou en ligne).</span></div></div>
        <button class="btn primary block mt" data-act="w-script">${IC.copy} Copier le script</button></div>
      <div class="card"><h3>⚙️ Options</h3>
        <label class="row gap"><span class="sw"><input type="checkbox" id="w-health" ${f.widgetHealth ? 'checked' : ''}><span></span></span><span class="f1 small">Afficher les infos santé (médecin, allergies) dans les widgets</span></label>
        <button class="btn primary block mt" data-act="w-save">Enregistrer</button>
        <div class="row gap mt"><button class="btn soft f1" data-act="w-sync">${IC.refresh} Actualiser maintenant</button><button class="btn soft f1" data-act="w-regen">🔐 Nouveau lien secret</button></div>
        <div class="hint">« Nouveau lien secret » déconnecte les widgets existants (à reconnecter ensuite).</div></div>`}`,
    };
  },
};
export const after = {
  notifs() {
    clearTimeout(S._seenT);
    S._seenT = setTimeout(() => { if (S.route.view === 'notifs' && unreadCount()) S.be.db.update(`users/${uid()}`, { [`lastSeen.${S.fid}`]: Date.now() }).catch(() => { }); }, 1500);
  },
  liaison() {
    const me = uid(), un = S.notes.filter(n => n.createdBy !== me && !(n.ackBy || {})[me]);
    if (un.length) setTimeout(() => { for (const n of un) updItem('notes', n.id, { [`ackBy.${me}`]: Date.now() }).catch(() => { }); }, 1200);
  },
};
export const actions = {
  // tâches
  'task-new': () => taskSheet(),
  'task-open': el => taskSheet(S.tasks.find(t => t.id === el.dataset.id)),
  'task-save': async el => {
    const f = readForm(el.closest('.sheet')), id = el.dataset.id;
    if (!f.title) return toast('Décrivez la tâche.', 'warn');
    const data = { title: f.title, due: f.due, cat: f.cat, assignee: f.assignee || 'all', childIds: f.childIds, note: f.note };
    el.disabled = true;
    const ok = await guard(async () => { if (id) await updItem('tasks', id, data); else { await addItem('tasks', { ...data, done: false }); await log('taches', `Nouvelle tâche : ${f.title}`, { body: `${assigneeLabel(data.assignee)}${f.due ? ' · ' + E.fmtDate(f.due, 'wdm') : ''}` }); } return true; }, 'Tâche enregistrée');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'task-done': async el => {
    const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    await guard(async () => { await updItem('tasks', t.id, t.done ? { done: false, doneBy: null, doneByName: null, doneAt: null } : { done: true, doneBy: uid(), doneByName: myName(), doneAt: Date.now() }); if (!t.done) await log('taches', `Tâche terminée : ${t.title}`); });
  },
  'task-del': async el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return; if (!(await confirmBox('Supprimer la tâche ?', esc(t.title), 'Supprimer', true))) return; await guard(() => S.be.db.del(fpath('tasks', t.id)), 'Tâche supprimée'); closeSheet(); },
  // liaison
  'note-new': () => openSheet(`<h3 class="sh-title">✍️ Note de liaison</h3><label class="lbl">Message</label><textarea class="in" name="text" rows="5" placeholder="Ex. Selman a eu un peu de fièvre, Doliprane donné à 18h. Devoirs de maths à finir."></textarea>
    <label class="lbl">Enfants</label>${kidChipsForm()}<label class="lbl">Sujets</label>${chips('tags', NTAGS, [], { multi: true })}
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="note-save">Enregistrer</button></div>`),
  'note-save': async el => {
    const f = readForm(el.closest('.sheet')); if (!f.text) return toast('Écrivez un message.', 'warn');
    el.disabled = true;
    const ok = await guard(async () => { await addItem('notes', { text: f.text, childIds: f.childIds, tags: f.tags, at: Date.now(), ackBy: {} }); await log('liaison', 'Nouvelle note de liaison', { body: f.text.slice(0, 80) }); return true; }, 'Note enregistrée');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'note-pin': async el => { const n = S.notes.find(x => x.id === el.dataset.id); if (n) await guard(() => updItem('notes', n.id, { pinned: !n.pinned })); },
  'note-del': async el => { const n = S.notes.find(x => x.id === el.dataset.id); if (!n) return; if (!(await confirmBox('Supprimer cette note ?', '', 'Supprimer', true))) return; await guard(() => S.be.db.del(fpath('notes', n.id)), 'Note supprimée'); },
  // documents
  'doc-new': () => {
    const sh = openSheet(`<h3 class="sh-title">📁 Nouveau document</h3><label class="lbl">Titre</label><input class="in" name="title" placeholder="Ex. Carnet de vaccination">
      <label class="lbl">Catégorie</label>${chips('cat', DCATS, ['sante'])}<label class="lbl">Enfants</label>${kidChipsForm()}
      <label class="lbl">Fichier</label><div class="row gap"><label class="btn soft f1">${IC.camera} Photo<input type="file" accept="image/*" capture="environment" class="hide" data-f="1"></label><label class="btn soft f1">${IC.file} Fichier<input type="file" accept="image/*,application/pdf" class="hide" data-f="1"></label></div>
      <div data-part="pv"></div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="doc-save">Enregistrer</button></div>`);
    sh.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('change', async () => {
      const file = inp.files[0]; if (!file) return;
      try {
        let data; if (file.type === 'application/pdf') { if (file.size > 700000) return toast('PDF trop lourd (700 Ko max).', 'warn'); data = await fileToDataURL(file); } else data = await compressImage(file, 1600, 0.75);
        sh._file = { data, mime: file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg', name: file.name };
        const t = sh.querySelector('[name="title"]'); if (!t.value) t.value = file.name.replace(/\.[^.]+$/, '');
        sh.querySelector('[data-part="pv"]').innerHTML = sh._file.mime.startsWith('image') ? `<img class="receipt" src="${data}">` : `<div class="tile mt">📄 ${esc(file.name)}</div>`;
      } catch (e) { toast('Fichier illisible', 'err'); }
    }));
  },
  'doc-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh);
    if (!sh._file) return toast('Choisissez un fichier ou prenez une photo.', 'warn'); if (!f.title) return toast('Donnez un titre.', 'warn');
    el.disabled = true;
    const ok = await guard(async () => { const bid = await saveBlob(sh._file.data, sh._file.mime, sh._file.name); await addItem('docs', { title: f.title, cat: f.cat, childIds: f.childIds, blobId: bid, mime: sh._file.mime, size: sh._file.data.length }); await log('documents', `Nouveau document : ${f.title}`); return true; }, 'Document enregistré');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'doc-open': el => { const d = S.docs.find(x => x.id === el.dataset.id); if (d) openBlob(d.blobId, d.title); },
  'doc-del': async el => { const d = S.docs.find(x => x.id === el.dataset.id); if (!d) return; if (!(await confirmBox('Supprimer ce document ?', esc(d.title), 'Supprimer', true))) return; await guard(async () => { await S.be.db.del(fpath('docs', d.id)); await S.be.db.del(fpath('blobs', d.blobId)); await log('documents', `Document supprimé : ${d.title}`); }, 'Document supprimé'); },
  // répertoire
  'ct-new': () => ctSheet(),
  'ct-open': el => ctSheet(S.contacts.find(c => c.id === el.dataset.id)),
  'ct-save': async el => {
    const f = readForm(el.closest('.sheet')), id = el.dataset.id; if (!f.name) return toast('Nom obligatoire.', 'warn');
    const data = { name: f.name, role: f.role, cat: f.cat, phone: f.phone, email: f.email, address: f.address, childIds: f.childIds, notes: f.notes };
    el.disabled = true;
    const ok = await guard(async () => { if (id) await updItem('contacts', id, data); else { await addItem('contacts', data); await log('contacts', `Nouveau contact : ${f.name}`); } return true; }, 'Contact enregistré');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'ct-del': async el => { const c = S.contacts.find(x => x.id === el.dataset.id); if (!c) return; if (!(await confirmBox('Supprimer ce contact ?', esc(c.name), 'Supprimer', true))) return; await guard(() => S.be.db.del(fpath('contacts', c.id)), 'Contact supprimé'); closeSheet(); },
  // souvenirs
  'mem-new': () => {
    const sh = openSheet(`<h3 class="sh-title">📸 Nouveaux souvenirs</h3><label class="btn soft block">${IC.camera} Choisir des photos<input type="file" accept="image/*" multiple class="hide" data-m="1"></label><div class="grid3 mt" data-part="pv"></div>
      <label class="lbl">Titre</label><input class="in" name="title" placeholder="Ex. Anniversaire de Jandal"><label class="lbl">Date</label><input class="in" type="date" name="date" value="${E.todayISO()}">
      <label class="lbl">Texte</label><textarea class="in" name="text" rows="3"></textarea><label class="lbl">Enfants</label>${kidChipsForm()}
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="mem-save">Enregistrer</button></div>`);
    sh.querySelector('[data-m]').addEventListener('change', async e => {
      sh._photos = [];
      for (const file of [...e.target.files].slice(0, 12)) { try { sh._photos.push({ full: await compressImage(file, 1400, 0.72), thumb: await compressImage(file, 320, 0.6) }); } catch (x) { /* */ } }
      sh.querySelector('[data-part="pv"]').innerHTML = sh._photos.map(p => `<div class="ph"><img src="${p.thumb}"></div>`).join('');
    });
  },
  'mem-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh); if (!sh._photos?.length) return toast('Choisissez au moins une photo.', 'warn');
    el.disabled = true; toast('Envoi des photos…', 'ok', 1500);
    const ok = await guard(async () => { for (const p of sh._photos) { const bid = await saveBlob(p.full, 'image/jpeg', 'photo.jpg'); await addItem('memories', { title: f.title, date: f.date, text: f.text, childIds: f.childIds, thumb: p.thumb, blobId: bid }); } await log('souvenirs', `${sh._photos.length} nouveau${sh._photos.length > 1 ? 'x' : ''} souvenir${sh._photos.length > 1 ? 's' : ''}${f.title ? ' : ' + f.title : ''}`); return true; }, 'Souvenirs enregistrés');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'mem-open': async el => {
    const m = S.memories.find(x => x.id === el.dataset.id); if (!m) return;
    const sh = openSheet(`<h3 class="sh-title">${esc(m.title || 'Souvenir')}</h3><div class="muted small">${E.fmtDate(m.date)} · ${esc(m.createdByName || '')}${m.childIds?.length ? ' · ' + esc(childNames(m.childIds)) : ''}</div>
      <div data-part="b"><img class="receipt" src="${m.thumb}"></div>${m.text ? `<p>${esc(m.text)}</p>` : ''}
      <div class="sh-actions">${m.createdBy === uid() ? `<button class="btn danger" data-act="mem-del" data-id="${m.id}">${IC.trash}</button>` : ''}<button class="btn primary f1" data-act="close-sheet">Fermer</button></div>`);
    const b = await S.be.db.get(fpath('blobs', m.blobId)); if (b) sh.querySelector('[data-part="b"]').innerHTML = `<img class="receipt" style="max-height:70vh" src="${b.data}">`;
  },
  'mem-del': async el => { const m = S.memories.find(x => x.id === el.dataset.id); if (!m) return; if (!(await confirmBox('Supprimer ce souvenir ?', '', 'Supprimer', true))) return; await guard(async () => { await S.be.db.del(fpath('memories', m.id)); await S.be.db.del(fpath('blobs', m.blobId)); }, 'Souvenir supprimé'); closeSheet(); },
  // réglages
  'set-relais': () => {
    if (!isParent()) return;
    const st = settings();
    openSheet(`<h3 class="sh-title">🔁 Horaires de relais</h3><label class="lbl">Relais du soir</label><input class="in" type="time" name="ht" value="${st.handoverTime}">
      <label class="lbl">Relais de mi-journée (Aïd, demi-journées)</label><input class="in" type="time" name="mt" value="${st.middayTime}">
      <div class="hint">${needsValidation() ? "L'autre parent devra valider ce changement." : 'Appliqué immédiatement.'} Pour un seul jour, utilisez plutôt un échange « horaire de relais ».</div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="set-relais-save">Enregistrer</button></div>`);
  },
  'set-relais-save': async el => {
    const f = readForm(el.closest('.sheet')); if (!f.ht || !f.mt) return toast('Horaires invalides.', 'warn');
    if (needsValidation()) await guard(async () => { await setFamily({ pendingSettings: { handoverTime: f.ht, middayTime: f.mt, by: uid(), byName: myName(), at: Date.now() } }); await log('garde', `Horaires de relais proposés : ${E.fmtTime(f.ht)}`); }, 'Proposition envoyée');
    else await guard(async () => { await setFamily({ settings: { ...settings(), handoverTime: f.ht, middayTime: f.mt } }); await log('garde', `Horaires de relais : soir ${E.fmtTime(f.ht)}, mi-journée ${E.fmtTime(f.mt)}`); }, 'Horaires enregistrés');
    closeSheet();
  },
  'set-relais-ok': async () => { const p = S.family.pendingSettings; if (!p) return; await guard(async () => { await setFamily({ settings: { ...settings(), handoverTime: p.handoverTime, middayTime: p.middayTime }, pendingSettings: null }); await log('garde', `Horaires de relais validés : ${E.fmtTime(p.handoverTime)}`); }, 'Horaires validés'); },
  'set-relais-no': async () => { const p = S.family.pendingSettings; if (!p) return; await guard(async () => { await setFamily({ pendingSettings: null }); await log('garde', 'Changement d\'horaires refusé'); }, 'Proposition refusée'); },
  'set-zone': () => {
    const st = settings();
    openSheet(`<h3 class="sh-title">🏖️ Vacances scolaires</h3><label class="lbl">Zone</label>${chips('zone', ['A', 'B', 'C'].map(z => ({ v: z, l: 'Zone ' + z })), [st.zone])}
      <div class="hint">A : ${esc(E.ACADEMIES.A)}<br>B : ${esc(E.ACADEMIES.B)}<br>C : ${esc(E.ACADEMIES.C)}</div>
      <label class="lbl">Périodes personnalisées</label>${(st.customHolidays || []).map(h => `<div class="per"><div class="pi">${h.i || '📌'}</div><div class="f1"><div class="pn">${esc(h.n)}</div><div class="pd">${E.fmtDate(h.s)} → ${E.fmtDate(h.e)}</div></div><button class="ib" data-act="set-hol-del" data-id="${h.id}">${IC.trash}</button></div>`).join('') || '<p class="muted small">Aucune.</p>'}
      <div class="two"><input class="in" name="hn" placeholder="Titre"><span></span></div><div class="two mt"><input class="in" type="date" name="hs"><input class="in" type="date" name="he"></div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="set-zone-save">Enregistrer</button></div>`);
  },
  'set-zone-save': async el => {
    const f = readForm(el.closest('.sheet')), st = settings(), ch = [...(st.customHolidays || [])];
    if (f.hn && f.hs && f.he && f.he >= f.hs) ch.push({ id: 'perso' + Date.now().toString(36), n: f.hn, s: f.hs, e: f.he, i: '📌', kind: 'perso' });
    await guard(async () => { await setFamily({ settings: { ...st, zone: f.zone || st.zone, customHolidays: ch } }); await log('garde', `Vacances : zone ${f.zone || st.zone}`); }, 'Enregistré');
    closeSheet();
  },
  'set-hol-del': async el => { const st = settings(); await guard(() => setFamily({ settings: { ...st, customHolidays: (st.customHolidays || []).filter(h => h.id !== el.dataset.id) } }), 'Période supprimée'); el.closest('.per')?.remove(); },
  'push-setup': () => {
    const m = me(), topic = m.ntfyTopic || ('sjf-' + randomId(14).toLowerCase());
    openSheet(`<h3 class="sh-title">📲 Notifications push</h3>
      <div class="steps"><div class="st"><span class="sn">1</span><span class="f1">Installez l'app gratuite <b>ntfy</b> : <a class="lnk" href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener">Samsung / Android</a> · <a class="lnk" href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener">iPhone</a></span></div>
      <div class="st"><span class="sn">2</span><span class="f1">Dans ntfy, touchez <b>+</b> et abonnez-vous à ce sujet secret :</span></div></div>
      <code class="tok">${esc(topic)}</code><button class="btn soft block mt" data-act="w-copy" data-v="${esc(topic)}">${IC.copy} Copier le sujet</button>
      <label class="row gap mt2"><span class="sw"><input type="checkbox" name="on" ${m.ntfyOn ? 'checked' : ''}><span></span></span><span class="f1"><b>Recevoir les alertes</b> (échanges, dépenses, agenda, liaison… des autres membres)</span></label>
      <label class="lbl">Rappel avant chaque relais</label><select class="in" name="remind">${[['off', 'Aucun rappel'], ['30', '30 min avant'], ['60', '1 h avant'], ['120', '2 h avant'], ['240', '4 h avant'], ['1440', 'La veille (24 h avant)']].map(([v, l]) => `<option value="${v}" ${String(m.remind || '120') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input type="hidden" name="topic" value="${esc(topic)}">
      <div class="sh-actions"><button class="btn soft f1" data-act="push-test" data-t="${esc(topic)}">Tester</button><button class="btn primary f1" data-act="push-save">Enregistrer</button></div>`);
  },
  'push-save': async el => {
    const f = readForm(el.closest('.sheet'));
    await guard(async () => { await updItem('members', uid(), { ntfyTopic: f.topic, ntfyOn: !!f.on, remind: f.remind }); }, 'Notifications enregistrées');
    closeSheet();
  },
  'push-test': async el => { await ntfyPublish(el.dataset.t, { title: '✅ SJ Family', message: 'Les notifications fonctionnent sur ce téléphone.', tags: ['tada'] }); toast('Notification de test envoyée'); },
  'print-year': () => { closeSheetsThen(() => { go('agenda', { mode: 'annee', y: String(new Date().getFullYear()) }); setTimeout(() => window.print(), 700); }); },
  'app-refresh': async () => {
    try { const rs = await navigator.serviceWorker?.getRegistrations(); for (const r of rs || []) await r.unregister(); const ks = await caches.keys(); for (const k of ks) await caches.delete(k); } catch (e) { /* */ }
    location.reload();
  },
  'demo-off': () => { LS.set('demo', false); location.href = location.pathname; },
  // profil
  'prof-edit': () => {
    const p = S.profile || {};
    openSheet(`<h3 class="sh-title">✏️ Mes informations</h3><div class="two"><div><label class="lbl">Prénom</label><input class="in" name="prenom" value="${esc(p.prenom || '')}"></div><div><label class="lbl">Nom</label><input class="in" name="nom" value="${esc(p.nom || '')}"></div></div>
      <label class="lbl">Téléphone</label><input class="in" type="tel" name="phone" value="${esc(p.phone || '')}">
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="prof-save">Enregistrer</button></div>`);
  },
  'prof-save': async el => {
    const f = readForm(el.closest('.sheet')); if (!f.prenom) return toast('Prénom obligatoire.', 'warn');
    if (f.phone.replace(/\D/g, '').length < 10) return toast('Numéro de téléphone invalide.', 'warn');
    await guard(async () => {
      await S.be.db.update(`users/${uid()}`, { prenom: f.prenom, nom: f.nom.toUpperCase(), phone: f.phone });
      if (S.fid) await updItem('members', uid(), { prenom: f.prenom, nom: f.nom.toUpperCase(), name: f.prenom, phone: f.phone });
      const c = myCode(); if (c) await setFamily({ [`parents.${c}.phone`]: f.phone });
    }, 'Profil enregistré');
    closeSheet();
  },
  'prof-pw': async () => { await guard(() => S.be.auth.reset(S.profile?.email || S.user.email), 'E-mail de changement de mot de passe envoyé'); },
  // widgets
  'w-enable': async () => { const t = randomId(32); await guard(async () => { await setFamily({ widgetToken: t, widgetHealth: false }); }); setTimeout(() => syncFeed(true), 600); toast('Widgets activés'); },
  'w-save': async () => { const v = document.getElementById('w-health')?.checked; await guard(() => setFamily({ widgetHealth: !!v }), 'Enregistré'); setTimeout(() => syncFeed(true), 600); },
  'w-sync': async () => { await syncFeed(true); toast('Widgets actualisés'); },
  'w-regen': async () => {
    if (!(await confirmBox('Générer un nouveau lien secret ?', 'Les widgets déjà installés devront être reconnectés.', 'Générer'))) return;
    const old = S.family.widgetToken, t = randomId(32);
    await guard(async () => { await setFamily({ widgetToken: t }); if (old) await S.be.db.del(`widgets/${old}`).catch(() => { }); });
    setTimeout(() => syncFeed(true), 600);
  },
  'w-copy': async el => { (await copyText(el.dataset.v)) ? toast('Copié') : toast('Copie impossible', 'err'); },
  'w-script': async () => { (await copyText(iphoneLoader(S.family.widgetToken))) ? toast('Script copié — collez-le dans Scriptable') : toast('Copie impossible', 'err'); },
};
function ctSheet(c = null) {
  const x = c || { cat: 'sante', childIds: [] };
  openSheet(`<h3 class="sh-title">${c ? '✏️ Contact' : '📇 Nouveau contact'}</h3>
    <label class="lbl">Nom</label><input class="in" name="name" value="${esc(x.name || '')}" placeholder="Dr Martin, École Jean Jaurès…">
    <label class="lbl">Fonction / lien</label><input class="in" name="role" value="${esc(x.role || '')}" placeholder="Pédiatre, maîtresse de CE1…">
    <label class="lbl">Catégorie</label>${chips('cat', CCATS, [x.cat])}
    <label class="lbl">Téléphone</label><input class="in" type="tel" name="phone" value="${esc(x.phone || '')}">
    <label class="lbl">E-mail</label><input class="in" type="email" name="email" value="${esc(x.email || '')}">
    <label class="lbl">Adresse</label><input class="in" name="address" value="${esc(x.address || '')}">
    ${x.address ? `<a class="btn soft block mt" href="https://maps.google.com/?q=${encodeURIComponent(x.address)}" target="_blank" rel="noopener">${IC.pin} Itinéraire</a>` : ''}
    <label class="lbl">Enfants</label>${kidChipsForm(x.childIds)}
    <label class="lbl">Notes</label><textarea class="in" name="notes" rows="2">${esc(x.notes || '')}</textarea>
    <div class="sh-actions">${c ? `<button class="btn danger" data-act="ct-del" data-id="${c.id}">${IC.trash}</button>` : ''}<button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="ct-save" data-id="${c?.id || ''}">Enregistrer</button></div>`);
}
