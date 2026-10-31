// ═══════════════ Tâches, liaison, documents, répertoire, souvenirs, notifications, réglages, profil, widgets ═══════════════
import * as E from './engine.js?v=6.6';
import { randomId } from './backend.js?v=6.6';
import { S, engine, parents, pName, pShort, uid, me, myName, myCode, isParent, childName, childNames, settings, addItem, updItem, log, guard, fpath, go, needsValidation, setFamily, selIds, selChildren, setSel, CATS, APP_URL, APK_URL, SCRIPT_URL, FEED_URL, VERSION, syncFeed, ntfyPublish, avatar, LS, can, widgetToken, memberName, otherParentUid, noteForMe, needApproval, canApprove, approvalText, isProche } from './core.js?v=6.6';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, IC, fmtStamp, fmtAgo, compressImage, fileToDataURL, dataURLtoBlob, copyText, closeSheetsThen, makeThumb, topSheet, compressVideo, blobToBase64, base64ToBlob, VIDEO_MAX } from './ui.js?v=6.6';
import { kidChips, countdown, pendingItems } from './views-home.js?v=6.6';
import { createFamily } from './views-family.js?v=6.6';
import { openPrint } from './print.js?v=6.6';

const kidChipsForm = (sel = selIds()) => chips('childIds', S.children.map(c => ({ v: c.id, l: `${c.emoji || ''} ${esc(c.prenom)}` })), sel, { multi: true });
const matchKids = item => { const ids = selIds(); return !item.childIds?.length || item.childIds.some(i => ids.includes(i)); };

// ───────────── Notifications & historique
export function unreadCount() {
  const last = S.profile?.lastSeen?.[S.fid] || 0, me = uid();
  return S.activity.filter(a => a.by !== me && a.at > last).length;
}
export function unreadNotes() { const me = uid(); return S.notes.filter(n => n.createdBy !== me && noteForMe(n) && !(n.ackBy || {})[me]).length; }
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
function noteCard(n) {
  const me = uid(), ack = Object.entries(n.ackBy || {}).filter(([u]) => u !== n.createdBy);
  const to = n.to ? (n.to.filter(u => u !== n.createdBy).map(memberName).join(', ') || 'Moi') : 'Les parents';
  const a = n.att;
  return `<div class="note"><div class="nh">${avatar(n.createdByName, '#C9A24A', 28)}<b style="color:var(--text)">${esc(n.createdByName)}</b><span>${fmtStamp(n.at)}</span>${n.pinned ? '<span>📌</span>' : ''}</div>
    <div class="tiny muted" style="margin:-2px 0 6px 36px">À : ${esc(to)}</div>
    ${(n.tags || []).length || n.childIds?.length ? `<div class="row wrap gap6 mb">${(n.tags || []).map(t => `<span class="pill">${NTAGS.find(x => x.v === t)?.l || t}</span>`).join('')}${n.childIds?.length ? `<span class="pill navy">${esc(childNames(n.childIds))}</span>` : ''}</div>` : ''}
    ${n.text ? `<div class="nx">${esc(n.text)}</div>` : ''}
    ${a ? `<button class="att" data-act="note-att" data-id="${n.id}">${thumbHtml(a.thumb, a.mime)}<span class="f1" style="text-align:left"><b>📎 ${esc(a.name)}</b><br><span class="tiny muted">${a.filed ? '📁 Rangé dans Documents' : 'Pièce jointe · touchez pour ouvrir'}</span></span></button>
      ${isParent() && !a.filed ? `<button class="btn soft sm mt" data-act="note-file" data-id="${n.id}">📁 Ranger dans Documents</button>` : ''}` : ''}
    <div class="row between mt"><span class="tiny muted">${ack.length ? '✓ Lu par ' + ack.map(([u, t]) => `${esc(memberName(u))} (${fmtAgo(t)})`).join(', ') : n.createdBy === me ? 'Pas encore lu' : ''}</span>
    ${n.createdBy === me ? `<span class="row gap6"><button class="ib" data-act="note-pin" data-id="${n.id}">📌</button><button class="ib" data-act="note-del" data-id="${n.id}">${IC.trash}</button></span>` : ''}</div></div>`;
}
function noteSheet() {
  const par = isParent(), p = parents(), me = uid();
  const opts = par ? S.members.filter(m => m.uid !== me).map(m => ({ v: m.uid, l: `${m.parentCode ? '👪' : '👵'} ${esc(m.prenom || m.name)}` }))
    : ['A', 'B'].filter(c => p[c].uid).map(c => ({ v: p[c].uid, l: `👪 ${esc(p[c].name)}` }));
  const def = par ? [otherParentUid()].filter(u => opts.some(o => o.v === u)) : opts.map(o => o.v);
  const sh = openSheet(`<h3 class="sh-title">✍️ Note de liaison</h3><label class="lbl">Message</label><textarea class="in" name="text" rows="5" placeholder="Ex. Selman a eu un peu de fièvre, Doliprane donné à 18h. Devoirs de maths à finir."></textarea>
    <label class="lbl">À qui ?</label>${opts.length ? chips('to', opts, def, { multi: true }) : '<p class="small muted">Personne d\'autre dans le cercle pour l\'instant : la note reste dans votre cahier.</p>'}
    ${par ? '<div class="hint">L\'autre parent voit toujours la note, même s\'il n\'est pas destinataire.</div>' : '<div class="hint">Les deux parents voient toutes vos notes.</div>'}
    <label class="lbl">Enfants</label>${kidChipsForm()}<label class="lbl">Sujets</label>${chips('tags', NTAGS, [], { multi: true })}
    <label class="lbl">Pièce jointe (PDF ou photo)</label><div class="row gap"><label class="btn soft f1">${IC.camera} Photo<input type="file" accept="image/*" capture="environment" class="hide" data-f="1"></label><label class="btn soft f1">${IC.file} Fichier<input type="file" accept="image/*,application/pdf" class="hide" data-f="1"></label></div>
    <div data-part="pv"></div>
    <div data-part="cat" class="hide"><label class="lbl">${par ? 'Rangé dans Documents, catégorie' : 'Catégorie proposée pour Documents'}</label>${chips('dcat', DCATS, ['autre'])}</div>
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="note-save">Envoyer</button></div>`);
  sh.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    try {
      const x = await readPicked(file); if (!x) return; sh._file = x;
      sh.querySelector('[data-part="pv"]').innerHTML = `<div class="att mt">${thumbHtml(x.thumb, x.mime)}<span class="f1"><b>📎 ${esc(x.name)}</b></span></div>`;
      sh.querySelector('[data-part="cat"]').classList.remove('hide');
      const tags = readForm(sh).tags || [], g = sh.querySelector('[data-group="dcat"]'), want = tags.includes('sante') ? 'sante' : tags.includes('ecole') ? 'ecole' : null;
      if (want) g.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.val === want));
    } catch (e) { toast('Fichier illisible', 'err'); }
  }));
}
// ───────────── Documents
const DCATS = [{ v: 'sante', l: '🩺 Santé' }, { v: 'ecole', l: '📚 École' }, { v: 'identite', l: '🪪 Identité' }, { v: 'juridique', l: '⚖️ Juridique' }, { v: 'assurance', l: '🛡️ Assurance' }, { v: 'autre', l: '📄 Autre' }];
// ───────────── Répertoire
const CCATS = [{ v: 'sante', l: '🩺 Santé' }, { v: 'ecole', l: '🏫 École' }, { v: 'garde', l: '🧸 Garde' }, { v: 'famille', l: '👵 Famille' }, { v: 'activite', l: '⚽ Activités' }, { v: 'urgence', l: '🚨 Urgence' }, { v: 'autre', l: '📇 Autre' }];

async function saveBlob(data, mime, name, kind = 'doc', extra = {}) { const id = S.be.db.newId(); await S.be.db.set(fpath('blobs', id), { data, mime, name: name || '', kind, ...extra, at: Date.now(), by: uid() }); return id; }
/** Range un fichier dans Documents (copie indépendante : supprimer l'un ne touche pas l'autre) */
async function fileDoc(file, { title, cat, childIds, fromNote = null }) {
  const db = S.be.db, bid = db.newId(), id = db.newId(), now = Date.now();
  await Promise.all([
    db.set(fpath('docs', id), { title, cat: cat || 'autre', childIds: childIds || [], blobId: bid, mime: file.mime, size: (file.data || '').length, thumb: file.thumb || null, fromNote, pub: !needApproval(), createdAt: now, createdBy: uid(), createdByName: myName() }),
    db.set(fpath('blobs', bid), { data: file.data, mime: file.mime, name: file.name || '', kind: 'doc', at: now, by: uid() }),
  ]);
  return id;
}
const baseName = n => String(n || 'Document').replace(/\.[^.]+$/, '');
/** Lecture d'un fichier choisi : photo compressée ou PDF (700 Ko max) + miniature */
async function readPicked(file) {
  let data;
  if (file.type === 'application/pdf') { if (file.size > 700000) { toast('PDF trop lourd (700 Ko max).', 'warn'); return null; } data = await fileToDataURL(file); }
  else data = await compressImage(file, 1600, 0.75);
  const thumb = await makeThumb(file, 260).catch(() => null);
  return { data, mime: file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg', name: file.name || 'photo.jpg', thumb };
}
const thumbHtml = (t, mime, cls = 'dthumb') => `<span class="${cls}">${t ? `<img src="${t}" alt="">` : `<span>${(mime || '').startsWith('image') ? '🖼️' : '📄'}</span>`}</span>`;
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
    return {
      title: 'Liaison', back: isParent() ? 'home' : null,
      html: `${kidChips()}<button class="btn primary block mb mt" data-act="note-new">✍️ Écrire une note</button>
      <div class="hint mb">${isParent() ? 'Adressez la note à un ou plusieurs membres du cercle : seuls eux (et l\'autre parent) la verront. Joignez un PDF ou une photo : il est rangé dans Documents.' : 'Écrivez à un parent ou aux deux. Seules les notes qui vous sont adressées apparaissent ici.'}</div>
      ${notes.length ? notes.map(noteCard).join('') : '<div class="card empty"><div class="e-i">📒</div>Aucune note pour le moment.</div>'}`,
    };
  },
  docs(p) {
    const cat = p.cat || '', list = S.docs.filter(d => (!cat || d.cat === cat) && matchKids(d)).sort((a, b) => b.createdAt - a.createdAt);
    return {
      title: 'Documents', back: 'home',
      html: `${kidChips()}${can('docs') ? `<button class="btn primary block mb mt" data-act="doc-new">${IC.plus} Ajouter un document</button>` : ''}
      <div class="chips scroll mb"><button class="chip sm ${!cat ? 'on' : ''}" data-go="docs">Tous</button>${DCATS.map(c => `<button class="chip sm ${cat === c.v ? 'on' : ''}" data-go="docs" data-params='{"cat":"${c.v}"}'>${c.l}</button>`).join('')}</div>
      <div class="card">${list.length ? list.map(d => `<div class="li"><button data-act="doc-open" data-id="${d.id}">${thumbHtml(d.thumb, d.mime)}</button><button class="f1" style="text-align:left" data-act="doc-open" data-id="${d.id}"><div class="lt">${esc(d.title)}</div>${d.pub === false ? `<div class="ls" style="color:var(--warn)">${esc(approvalText(d))}</div>` : ''}<div class="ls">${DCATS.find(c => c.v === d.cat)?.l || ''}${d.childIds?.length ? ' · ' + esc(childNames(d.childIds)) : ''} · ${E.fmtDate(E.todayISO(new Date(d.createdAt || Date.now())), 'num')} · ${esc(d.createdByName || '')}${d.fromNote ? ' · 📒 note' : ''}</div></button>
        ${canApprove(d) ? `<button class="ib" style="background:var(--ok-l);color:var(--ok)" data-act="appr-ok" data-c="docs" data-id="${d.id}">✓</button><button class="ib" style="background:var(--err-l);color:var(--err)" data-act="appr-no" data-c="docs" data-id="${d.id}">✗</button>` : ''}
        ${isParent() || d.createdBy === uid() ? `<button class="ib" data-act="doc-del" data-id="${d.id}">${IC.trash}</button>` : ''}</div>`).join('') : '<div class="empty"><div class="e-i">📁</div>Coffre-fort vide. Ajoutez carnet de santé, certificats, jugement…</div>'}</div>
      <div class="hint center">Photos compressées automatiquement · PDF jusqu'à 700 Ko.</div>`,
    };
  },
  contacts(p) {
    const cat = p.cat || '', list = S.contacts.filter(c => !cat || c.cat === cat).sort((a, b) => a.name.localeCompare(b.name));
    return {
      title: 'Répertoire', back: 'home',
      html: `${can('contacts') ? `<button class="btn primary block mb" data-act="ct-new">${IC.plus} Nouveau contact</button>` : ''}
      <div class="chips scroll mb"><button class="chip sm ${!cat ? 'on' : ''}" data-go="contacts">Tous</button>${CCATS.map(c => `<button class="chip sm ${cat === c.v ? 'on' : ''}" data-go="contacts" data-params='{"cat":"${c.v}"}'>${c.l}</button>`).join('')}</div>
      <div class="card">${list.length ? list.map(c => `<div class="li"><div class="le">${(CCATS.find(x => x.v === c.cat)?.l || '📇').split(' ')[0]}</div><button class="f1" style="text-align:left" data-act="ct-open" data-id="${c.id}"><div class="lt">${esc(c.name)}</div><div class="ls">${esc(c.role || '')}${c.childIds?.length ? ' · ' + esc(childNames(c.childIds)) : ''}${c.phone ? ' · ' + esc(c.phone) : ''}</div></button>
        ${c.phone ? `<a class="ib" href="tel:${esc(c.phone)}">${IC.phone}</a>` : ''}${c.email ? `<a class="ib" href="mailto:${esc(c.email)}">${IC.mail}</a>` : ''}</div>`).join('') : '<div class="empty"><div class="e-i">📞</div>Ajoutez médecin, école, nounou, grands-parents…</div>'}</div>`,
    };
  },
  memories() {
    const list = S.memories.filter(matchKids).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
    const todo = list.filter(canApprove);
    return {
      title: 'Souvenirs', back: isParent() ? 'home' : null,
      html: `${kidChips()}<button class="btn primary block mb mt" data-act="mem-new">📸 Ajouter des photos ou des vidéos</button>
      ${todo.length ? `<div class="alert"><div class="ai">⏳</div><div class="f1"><div class="at">${todo.length} souvenir${todo.length > 1 ? 's' : ''} à valider</div><div class="small">Visibles par tout le cercle après votre accord (publiés automatiquement 48 h après l'ajout sans refus).</div>
        <div class="row gap mt"><button class="btn ok sm" data-act="appr-all" data-c="memories">✓ Tout valider</button></div></div></div>` : ''}
      ${list.length ? `<div class="grid3">${list.map(m => `<button class="ph ${m.pub === false ? 'pend' : ''}" data-act="mem-open" data-id="${m.id}">${m.thumb ? `<img src="${m.thumb}" alt="">` : '📷'}${m.type === 'video' ? '<i class="play">▶</i>' : ''}${m.pub === false ? `<b class="pb">${m.refused ? '❌' : '⏳'}</b>` : ''}<span>${esc(m.title || E.fmtDate(m.date, 'short'))}</span></button>`).join('')}</div>` : '<div class="card empty"><div class="e-i">📸</div>Partagez les beaux moments avec l\'autre parent.</div>'}
      <div class="hint center">Chaque photo ou vidéo ajoutée est validée par l'autre parent (sous 48 h) avant d'être visible par les proches.</div>`,
    };
  },
  notifs(p) {
    const tab = p.tab || 'notifs', cat = p.cat || '', me = uid(), last = S.profile?.lastSeen?.[S.fid] || 0;
    const all = [...S.activity, ...S.legacy].sort((a, b) => b.at - a.at);
    let list = tab === 'notifs' ? all.filter(a => a.by !== me) : all;
    const counts = {}; for (const a of list) counts[a.cat] = (counts[a.cat] || 0) + 1;
    if (cat) list = list.filter(a => a.cat === cat);
    let html = '', day = '';
    for (const a of list.slice(0, 250)) {
      const d = new Date(a.at), iso = E.todayISO(d);
      if (iso !== day) { day = iso; html += `<div class="lbl">${E.fmtDate(iso, 'wdmy')}</div>`; }
      html += `<div class="card tight" style="margin-bottom:8px;${a.at > last && a.by !== me ? 'border-left:5px solid var(--coral)' : ''}"><div class="row gap"><div style="font-size:28px">${a.icon || CATS[a.cat]?.i || '🔔'}</div><div class="f1"><div class="b">${esc(a.title)}</div>
        <div class="small muted">${esc(a.by === me ? 'Moi' : a.byName || '')}${a.body ? ' — ' + esc(a.body) : ''}</div><div class="tiny muted">${fmtStamp(a.at)}</div></div></div></div>`;
    }
    const pend = pendingItems();
    return {
      title: 'Notifications', back: 'home',
      html: `${pend.length ? `<div class="lbl" style="margin-top:0">⏳ À valider (${pend.length})</div>${pend.map(x => `<div class="alert" data-go="${x.go}" style="cursor:pointer"><div class="ai">${x.i}</div><div class="f1"><div class="at">${esc(x.t)}</div><div class="small">${esc(x.s)}</div></div><span class="lnk">›</span></div>`).join('')}` : ''}
      <div class="seg"><button class="${tab === 'notifs' ? 'on' : ''}" data-go="notifs" data-params='{"tab":"notifs"}'>🔔 Reçues</button><button class="${tab === 'hist' ? 'on' : ''}" data-go="notifs" data-params='{"tab":"hist"}'>📜 Mon historique</button></div>
      <div class="chips scroll mb"><button class="chip sm ${!cat ? 'on' : ''}" data-go="notifs" data-params='{"tab":"${tab}"}'>Tout</button>${Object.entries(CATS).filter(([k]) => counts[k]).map(([k, c]) => `<button class="chip sm ${cat === k ? 'on' : ''}" data-go="notifs" data-params='{"tab":"${tab}","cat":"${k}"}'>${c.i} ${c.n} (${counts[k]})</button>`).join('')}</div>
      ${html || `<div class="card empty"><div class="e-i">🔕</div>${tab === 'notifs' ? 'Aucune notification. Vos propres actions apparaissent dans votre historique.' : 'Aucune activité.'}</div>`}
      <div class="hint center">${isParent() ? 'Vos réglages personnels n\'apparaissent que dans votre historique ; tout ajout partagé (document, note, budget, tâche, agenda…) prévient l\'autre parent.' : 'Vous êtes prévenu(e) des nouveaux souvenirs et des notes qui vous sont adressées.'}</div>`,
    };
  },
  settings() {
    const st = settings(), f = S.family, ps = f.pendingSettings, m = me(), u = uid(), par = isParent();
    const rules = st.relayRules || [];
    return {
      title: 'Réglages', back: 'home',
      html: `<div class="card"><h3>🔁 Relais ${par ? '<a class="act" data-act="set-relais">Modifier</a>' : ''}</h3>
        <div class="prow"><span>Relais du soir (par défaut)</span><b>${E.fmtTime(st.handoverTime)}</b></div><div class="prow"><span>Relais de mi-journée (demi-journées)</span><b>${E.fmtTime(st.middayTime)}</b></div>
        ${rules.length ? `<div class="lbl">Horaires réguliers</div>${rules.map(r => `<div class="per"><div class="pi">🕓</div><div class="f1 small b">${esc(ruleText(r))}</div></div>`).join('')}` : ''}
        <div class="hint">Une garde commençant un jour = récupération la veille ; le dernier jour, remise à l'autre parent. Heure : ${rules.length ? 'horaire régulier s’il s’applique, sinon ' : ''}${E.fmtTime(st.handoverTime)}. Pour un seul jour : un échange « horaire de relais » (au cas par cas).</div>
        ${ps ? `<div class="alert mt"><div class="ai">⏳</div><div class="f1"><div class="at">${esc(ps.byName)} propose : soir ${E.fmtTime(ps.handoverTime)} · mi-journée ${E.fmtTime(ps.middayTime)}</div>
          ${(ps.relayRules || []).map(r => `<div class="small">• ${esc(ruleText(r))}</div>`).join('')}
          ${ps.by !== u && par ? `<div class="row gap mt"><button class="btn ok sm" data-act="set-relais-ok">✓ Valider</button><button class="btn danger sm" data-act="set-relais-no">✗ Refuser</button></div>` : '<div class="small muted">En attente de validation.</div>'}</div></div>` : ''}</div>
      <div class="card"><h3>🏖️ Vacances scolaires ${par ? '<a class="act" data-act="set-zone">Modifier</a>' : ''}</h3><div class="prow"><span>Zone</span><b>${st.zone}</b></div>
        <div class="prow"><span>Périodes personnalisées</span><b>${(st.customHolidays || []).length}</b></div></div>
      <div class="card"><h3>📲 Notifications push</h3>
        <div class="prow"><span>Alertes sur ce téléphone</span><b>${m.ntfyOn ? '✅ Activées' : '⏸️ Désactivées'}</b></div>
        ${par ? `<div class="prow"><span>Rappel avant chaque relais</span><b>${m.remind === 'off' ? 'Aucun' : (m.remind || 120) >= 60 ? ((m.remind || 120) / 60) + ' h avant' : m.remind + ' min avant'}</b></div>` : ''}
        <button class="btn primary block mt" data-act="push-setup">Configurer</button>
        <div class="hint">Gratuit, sans compte, sur iPhone et Samsung, via l'application « ntfy ». Vous n'êtes jamais notifié de vos propres actions.</div></div>
      <div class="card"><h3>📱 Widgets</h3><p class="small muted" style="margin-top:0">Garde du jour, semaine, mois, pleine page et programme sur l'écran d'accueil.</p><button class="btn ghost block" data-go="widgets">Configurer les widgets</button></div>
      <div class="card"><h3>📤 Exporter</h3><button class="btn soft block" data-act="print-year">🖨️ Imprimer le calendrier annuel</button><button class="btn soft block mt" data-act="ics-sheet">📅 Vers Google Agenda / Samsung / iPhone (.ics)</button>${can('expenses') ? '<button class="btn soft block mt" data-act="exp-csv">💰 Dépenses (tableur .csv)</button>' : ''}</div>
      ${par ? testCard() : ''}
      <div class="card"><h3>ℹ️ Application</h3>
        <button class="btn soft block" data-act="app-refresh">${IC.refresh} Mettre à jour / vider le cache</button>
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
    const f = S.family, tok = widgetToken(), par = isParent();
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
        <div class="st"><span class="sn">3</span><span class="f1">Appui long sur l'écran d'accueil → <b>Widgets</b> → <b>SJ Widgets</b> → choisissez Garde, Semaine, Mois, <b>Pleine page</b> ou Programme puis l'enfant (${esc(kids)} ou Tous).</span></div>
        <div class="st"><span class="sn">4</span><span class="f1">Sur le widget : <b>‹ ›</b> pour passer au jour, à la semaine ou au mois précédent/suivant ; touchez une case pour ouvrir ce jour dans l'agenda ; touchez le titre pour revenir à aujourd'hui.</span></div></div>
        <div class="row gap wrap mt"><a class="btn primary f1" href="${APK_URL}">${IC.download} Télécharger l'APK</a><a class="btn coral f1" href="${intent}">🔗 Connecter mes widgets</a></div>
        <button class="btn soft block mt" data-act="w-copy" data-v="${tok}">${IC.copy} Copier le code de connexion</button>
        <div class="hint">L'app SJ Widgets vous rappelle aussi chaque relais par une notification (2 h avant, réglable).</div></div>
      <div class="card"><h3>🍏 iPhone</h3>
        <div class="steps"><div class="st"><span class="sn">1</span><span class="f1">Installez l'app gratuite <a class="lnk" href="https://apps.apple.com/fr/app/scriptable/id1405459188" target="_blank" rel="noopener">Scriptable</a> (App Store).</span></div>
        <div class="st"><span class="sn">2</span><span class="f1">Touchez <b>Copier le script</b> ci-dessous, ouvrez Scriptable → <b>+</b> → collez → nommez-le <b>SJ Family</b> → ▶︎ une fois.</span></div>
        <div class="st"><span class="sn">3</span><span class="f1">Écran d'accueil : appui long → <b>+</b> → <b>Scriptable</b> → choisissez la taille → touchez le widget → Script : <b>SJ Family</b> · Paramètre : <b>${esc(S.children[0]?.prenom || 'Selman')}</b>, <b>Tous</b>… ajoutez <b>;semaine</b>, <b>;mois</b> ou <b>;programme</b> pour changer de vue.</span></div>
        <div class="st"><span class="sn">4</span><span class="f1">Sur le widget : compte à rebours jusqu'au prochain relais ; touchez une case pour ouvrir ce jour dans l'agenda (Safari). Écran verrouillé : même principe (widgets rectangulaires ou en ligne).</span></div></div>
        <button class="btn primary block mt" data-act="w-script">${IC.copy} Copier le script</button></div>
      <div class="card"><h3>⚙️ Options</h3>
        ${par ? `<label class="row gap"><span class="sw"><input type="checkbox" id="w-health" ${S.priv?.widgetHealth ? 'checked' : ''}><span></span></span><span class="f1 small">Afficher les infos santé (médecin, allergies) dans les widgets</span></label>
        <button class="btn primary block mt" data-act="w-save">Enregistrer</button>` : ''}
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
  settings(v, p) {
    if (p.preset === 'vendredi' && isParent()) {
      history.replaceState(null, '', '#/settings'); S.route = { view: 'settings', params: {} };
      const st = settings(), rules = [...(st.relayRules || [])];
      if (!rules.some(r => r.kind === 'dow' && +r.dow === 4)) rules.push({ id: 'rven', kind: 'dow', dow: 4, every: 1, parity: 'pair', school: true, date: '', to: '', time: '16:30', place: 'École' });
      setTimeout(() => relaisEditor({ handoverTime: '18:30', middayTime: st.middayTime, relayRules: rules }), 300);
    }
  },
  liaison() {
    const me = uid(), un = S.notes.filter(n => n.createdBy !== me && noteForMe(n) && !(n.ackBy || {})[me]);
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
  'note-new': () => noteSheet(),
  'note-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), par = isParent(), me = uid();
    if (!f.text && !sh._file) return toast('Écrivez un message ou joignez un fichier.', 'warn');
    const to = (f.to || []).filter(Boolean);
    if (!par && !to.length) return toast('Choisissez au moins un parent.', 'warn');
    el.disabled = true;
    const ok = await guard(async () => {
      const db = S.be.db, id = db.newId(), now = Date.now();
      let att = null;
      if (sh._file) {
        const x = sh._file, bid = await saveBlob(x.data, x.mime, x.name, 'note', { to: [...new Set([...to, me])] });
        att = { blobId: bid, name: x.name, mime: x.mime, thumb: x.thumb || null, cat: f.dcat || 'autre', filed: false };
        if (par) { await fileDoc(x, { title: baseName(x.name), cat: f.dcat, childIds: f.childIds, fromNote: id }); att.filed = true; }
      }
      await db.set(fpath('notes', id), { text: f.text || '', childIds: f.childIds, tags: f.tags, to, att, at: now, ackBy: {}, createdAt: now, createdBy: me, createdByName: myName() });
      await log('liaison', 'Nouvelle note de liaison', { body: (f.text || '').slice(0, 80) + (att ? ` 📎 ${att.name}${att.filed ? ' (rangé dans Documents)' : ''}` : ''), to });
      return true;
    }, 'Note envoyée');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'note-att': el => { const n = S.notes.find(x => x.id === el.dataset.id); if (n?.att) openBlob(n.att.blobId, n.att.name); },
  'note-file': async el => {
    const n = S.notes.find(x => x.id === el.dataset.id); if (!n?.att || !isParent()) return;
    el.disabled = true;
    const ok = await guard(async () => {
      const b = await S.be.db.get(fpath('blobs', n.att.blobId)); if (!b) throw new Error('Fichier introuvable');
      await fileDoc({ data: b.data, mime: b.mime, name: b.name, thumb: n.att.thumb }, { title: baseName(n.att.name), cat: n.att.cat, childIds: n.childIds, fromNote: n.id });
      await updItem('notes', n.id, { 'att.filed': true });
      await log('documents', `Nouveau document : ${baseName(n.att.name)}`, { body: `depuis une note de ${n.createdByName || ''}` });
      return true;
    }, 'Rangé dans Documents');
    if (ok) go('docs', { cat: n.att.cat || 'autre' }); else el.disabled = false;
  },
  'note-pin': async el => { const n = S.notes.find(x => x.id === el.dataset.id); if (n) await guard(() => updItem('notes', n.id, { pinned: !n.pinned })); },
  'note-del': async el => { const n = S.notes.find(x => x.id === el.dataset.id); if (!n) return; if (!(await confirmBox('Supprimer cette note ?', n.att?.filed ? 'Le document rangé dans Documents est conservé.' : '', 'Supprimer', true))) return; await guard(async () => { await S.be.db.del(fpath('notes', n.id)); if (n.att?.blobId) await S.be.db.del(fpath('blobs', n.att.blobId)).catch(() => { }); }, 'Note supprimée'); },
  // documents
  'doc-new': () => {
    const sh = openSheet(`<h3 class="sh-title">📁 Nouveau document</h3><label class="lbl">Titre</label><input class="in" name="title" placeholder="Ex. Carnet de vaccination">
      <label class="lbl">Catégorie</label>${chips('cat', DCATS, [S.route.params.cat || 'sante'])}<label class="lbl">Enfants</label>${kidChipsForm()}
      <label class="lbl">Fichier</label><div class="row gap"><label class="btn soft f1">${IC.camera} Photo<input type="file" accept="image/*" capture="environment" class="hide" data-f="1"></label><label class="btn soft f1">${IC.file} Fichier<input type="file" accept="image/*,application/pdf" class="hide" data-f="1"></label></div>
      <div data-part="pv"></div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="doc-save">Enregistrer</button></div>`);
    sh.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('change', async () => {
      const file = inp.files[0]; if (!file) return;
      try {
        const x = await readPicked(file); if (!x) return; sh._file = x;
        const t = sh.querySelector('[name="title"]'); if (!t.value) t.value = baseName(file.name);
        sh.querySelector('[data-part="pv"]').innerHTML = x.mime.startsWith('image') ? `<img class="receipt" src="${x.data}">` : `<div class="att mt">${thumbHtml(x.thumb, x.mime)}<span class="f1"><b>📄 ${esc(x.name)}</b></span></div>`;
      } catch (e) { toast('Fichier illisible', 'err'); }
    }));
  },
  'doc-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), x = sh._file;
    if (!x) return toast('Choisissez un fichier ou prenez une photo.', 'warn'); if (!f.title) return toast('Donnez un titre.', 'warn');
    el.disabled = true;
    // affichage immédiat : la page Documents s'ouvre sur la bonne catégorie pendant l'envoi
    if (f.childIds?.length && !f.childIds.some(id => selIds().includes(id))) setSel([]);
    const job = guard(async () => { await fileDoc(x, { title: f.title, cat: f.cat, childIds: f.childIds }); await log('documents', `Nouveau document : ${f.title}`, { body: `${DCATS.find(c => c.v === f.cat)?.l || ''}${f.childIds?.length ? ' · ' + childNames(f.childIds) : ''}` }); return true; }, 'Document enregistré ✓');
    closeSheetsThen(() => go('docs', { cat: f.cat }));
    await job;
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
    const sh = openSheet(`<h3 class="sh-title">📸 Nouveaux souvenirs</h3>
      <div class="row gap wrap"><label class="btn soft f1">${IC.camera} Photo<input type="file" accept="image/*" capture="environment" class="hide" data-m="1"></label>
        <label class="btn soft f1">🎥 Filmer<input type="file" accept="video/*" capture="environment" class="hide" data-m="1"></label></div>
      <label class="btn soft block mt">🖼️ Galerie : photos et vidéos<input type="file" accept="image/*,video/*" multiple class="hide" data-m="1"></label>
      <div class="grid3 mt" data-part="pv"></div><div class="hint" data-part="st"></div>
      <label class="lbl">Titre</label><input class="in" name="title" placeholder="Ex. Anniversaire de Jandal"><label class="lbl">Date</label><input class="in" type="date" name="date" value="${E.todayISO()}">
      <label class="lbl">Texte</label><textarea class="in" name="text" rows="3"></textarea><label class="lbl">Enfants</label>${kidChipsForm()}
      <div class="hint">${needApproval() ? "L'autre parent valide sous 48 h avant que les proches les voient." : 'Visibles tout de suite par le cercle.'} Vidéos : 3 minutes maximum, compressées automatiquement.</div>
      <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="mem-save">Enregistrer</button></div>`);
    sh._media = [];
    const render = () => { sh.querySelector('[data-part="pv"]').innerHTML = sh._media.map(p => `<div class="ph">${p.thumb ? `<img src="${p.thumb}">` : ''}${p.type === 'video' ? '<i class="play">▶</i>' : ''}</div>`).join(''); };
    sh.querySelectorAll('[data-m]').forEach(inp => inp.addEventListener('change', async e => {
      const st = sh.querySelector('[data-part="st"]'), save = sh.querySelector('[data-act="mem-save"]');
      save.disabled = true;
      for (const file of [...e.target.files].slice(0, 12)) {
        try {
          if ((file.type || '').startsWith('video')) {
            st.textContent = '🎥 Préparation de la vidéo… 0 %';
            const v = await compressVideo(file, k => { st.textContent = `🎥 Préparation de la vidéo… ${Math.round(k * 100)} % (gardez l'écran allumé)`; });
            sh._media.push({ type: 'video', blob: v.blob, mime: v.mime, thumb: v.poster, dur: v.dur });
          } else sh._media.push({ type: 'photo', full: await compressImage(file, 1400, 0.72), thumb: await compressImage(file, 320, 0.6) });
          render();
        } catch (x) { toast(x.message || 'Fichier illisible', 'err', 5000); }
      }
      st.textContent = sh._media.length ? `${sh._media.length} élément${sh._media.length > 1 ? 's' : ''} prêt${sh._media.length > 1 ? 's' : ''}` : '';
      save.disabled = false;
    }));
  },
  'mem-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh); if (!sh._media?.length) return toast('Choisissez au moins une photo ou une vidéo.', 'warn');
    el.disabled = true; toast('Envoi…', 'ok', 1500);
    const pub = !needApproval();
    const ok = await guard(async () => {
      const db = S.be.db;
      for (const p of sh._media) {
        const id = db.newId(), base = { title: f.title, date: f.date, text: f.text, childIds: f.childIds, thumb: p.thumb, bk: 1, pub, createdAt: Date.now(), createdBy: uid(), createdByName: myName() };
        if (p.type === 'video') {
          const b64 = await blobToBase64(p.blob), CH = 700000, n = Math.ceil(b64.length / CH);
          for (let i = 0; i < n; i++) await db.set(fpath('blobs', `${id}_v${i}`), { data: b64.slice(i * CH, (i + 1) * CH), i, kind: 'mem', at: Date.now(), by: uid() });
          await db.set(fpath('memories', id), { ...base, type: 'video', mime: p.mime, chunks: n, size: p.blob.size, dur: Math.round(p.dur || 0) });
        } else {
          const bid = await saveBlob(p.full, 'image/jpeg', 'photo.jpg', 'mem');
          await db.set(fpath('memories', id), { ...base, type: 'photo', blobId: bid });
        }
      }
      const n = sh._media.length, what = `${n} nouveau${n > 1 ? 'x' : ''} souvenir${n > 1 ? 's' : ''}${f.title ? ' : ' + f.title : ''}`;
      if (pub) await log('souvenirs', what, { to: 'all', icon: '📸' });
      else await log('souvenirs', `${what} — à valider`, { icon: '⏳', body: 'Visible par les proches après validation (48 h max)' });
      return true;
    }, pub ? 'Souvenirs enregistrés' : 'Souvenirs envoyés pour validation');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'mem-open': async el => {
    const m = S.memories.find(x => x.id === el.dataset.id); if (!m) return;
    const sh = openSheet(`<h3 class="sh-title">${esc(m.title || 'Souvenir')}</h3><div class="muted small">${E.fmtDate(m.date)} · ${esc(m.createdByName || '')}${m.childIds?.length ? ' · ' + esc(childNames(m.childIds)) : ''}</div>
      ${m.pub === false ? `<div class="alert mt"><div class="ai">${m.refused ? '❌' : '⏳'}</div><div class="f1 small">${esc(approvalText(m))}${canApprove(m) ? `<div class="row gap mt"><button class="btn ok sm" data-act="appr-ok" data-c="memories" data-id="${m.id}">✓ Valider</button><button class="btn danger sm" data-act="appr-no" data-c="memories" data-id="${m.id}">✗ Refuser</button></div>` : ''}</div></div>` : ''}
      <div data-part="b">${m.type === 'video' ? `<div class="vidwait"><img class="receipt" src="${m.thumb}"><div class="small muted center">Chargement de la vidéo…</div></div>` : `<img class="receipt" src="${m.thumb}">`}</div>${m.text ? `<p>${esc(m.text)}</p>` : ''}
      <div class="sh-actions">${m.createdBy === uid() || isParent() ? `<button class="btn danger" data-act="mem-del" data-id="${m.id}">${IC.trash}</button>` : ''}<button class="btn primary f1" data-act="close-sheet">Fermer</button></div>`);
    const box = sh.querySelector('[data-part="b"]');
    if (m.type === 'video') {
      try {
        const parts = []; for (let i = 0; i < (m.chunks || 0); i++) { const c = await S.be.db.get(fpath('blobs', `${m.id}_v${i}`)); if (!c) throw new Error('morceau manquant'); parts.push(c.data); }
        const url = URL.createObjectURL(base64ToBlob(parts, m.mime || 'video/mp4'));
        box.innerHTML = `<video class="receipt" style="max-height:70vh;background:#000" src="${url}" poster="${m.thumb}" controls playsinline></video>`;
      } catch (e) { box.innerHTML = '<p class="muted">Vidéo indisponible.</p>'; }
    } else { const b = await S.be.db.get(fpath('blobs', m.blobId)).catch(() => null); if (b) box.innerHTML = `<img class="receipt" style="max-height:70vh" src="${b.data}">`; }
  },
  'mem-del': async el => {
    const m = S.memories.find(x => x.id === el.dataset.id); if (!m) return; if (!(await confirmBox('Supprimer ce souvenir ?', '', 'Supprimer', true))) return;
    await guard(async () => {
      await S.be.db.del(fpath('memories', m.id));
      if (m.type === 'video') { for (let i = 0; i < (m.chunks || 0); i++) await S.be.db.del(fpath('blobs', `${m.id}_v${i}`)).catch(() => { }); }
      else if (m.blobId) await S.be.db.del(fpath('blobs', m.blobId)).catch(() => { });
    }, 'Souvenir supprimé'); closeSheet();
  },
  // ───── validation des importations par l'autre parent (souvenirs, documents)
  'appr-ok': async el => {
    const c = el.dataset.c, it = S[c].find(x => x.id === el.dataset.id); if (!canApprove(it)) return;
    await guard(async () => {
      await updItem(c, it.id, { pub: true, okBy: uid(), okByName: myName(), okAt: Date.now() });
      await log(c === 'memories' ? 'souvenirs' : 'documents', c === 'memories' ? `📸 Nouveau souvenir${it.title ? ' : ' + it.title : ''}` : `Document validé : ${it.title}`, { to: c === 'memories' ? 'all' : 'parents', icon: c === 'memories' ? '📸' : '✅', body: `ajouté par ${it.createdByName || ''}` });
    }, 'Validé ✓');
    if (el.closest('.sheet')) closeSheet();
  },
  'appr-no': async el => {
    const c = el.dataset.c, it = S[c].find(x => x.id === el.dataset.id); if (!canApprove(it)) return;
    if (!(await confirmBox('Refuser ?', 'Il ne sera pas visible par les proches. La personne qui l\'a ajouté pourra le supprimer.', 'Refuser', true))) return;
    await guard(async () => { await updItem(c, it.id, { refused: true, refusedBy: uid(), refusedByName: myName(), refusedAt: Date.now() }); await log(c === 'memories' ? 'souvenirs' : 'documents', `${c === 'memories' ? 'Souvenir' : 'Document'} refusé${it.title ? ' : ' + it.title : ''}`, { icon: '❌' }); }, 'Refusé');
    if (el.closest('.sheet')) closeSheet();
  },
  'appr-all': async el => {
    const c = el.dataset.c, items = S[c].filter(canApprove); if (!items.length) return;
    await guard(async () => { for (const it of items) await updItem(c, it.id, { pub: true, okBy: uid(), okByName: myName(), okAt: Date.now() }); await log('souvenirs', `📸 ${items.length} nouveau${items.length > 1 ? 'x' : ''} souvenir${items.length > 1 ? 's' : ''}`, { to: 'all', icon: '📸' }); }, 'Tout est validé ✓');
  },
  // réglages
  'set-relais': () => relaisEditor(),
  'rl-add': () => ruleSheet(),
  'rl-del': el => { const ed = S.ui.relEdit; if (!ed) return; ed.rules.splice(+el.dataset.i, 1); renderRules(); },
  'rl-save': el => {
    const f = readForm(el.closest('.sheet')), ed = S.ui.relEdit; if (!ed) return;
    if (!f.time) return toast("Indiquez l'heure.", 'warn');
    const kind = f.kind || 'dow';
    if (kind === 'date' && !f.date) return toast('Choisissez la date.', 'warn');
    ed.rules.push({ id: 'r' + Date.now().toString(36), kind: kind === 'dow2' ? 'dow' : kind, dow: +(f.dow ?? 4), every: kind === 'dow2' ? 2 : 1, parity: f.parity || 'pair', school: !!f.school, date: f.date || '', to: f.to || '', time: f.time, place: f.place || '' });
    closeSheet(); setTimeout(renderRules, 50);
  },
  'set-relais-save': async el => {
    const f = readForm(el.closest('.sheet')), ed = S.ui.relEdit; if (!f.ht || !f.mt) return toast('Horaires invalides.', 'warn');
    const data = { handoverTime: f.ht, middayTime: f.mt, relayRules: ed?.rules || [] };
    const desc = `soir ${E.fmtTime(f.ht)}${data.relayRules.length ? ' · ' + data.relayRules.map(ruleText).join(' ; ') : ''}`;
    if (needsValidation()) await guard(async () => { await setFamily({ pendingSettings: { ...data, by: uid(), byName: myName(), at: Date.now() } }); await log('garde', 'Horaires de relais proposés', { body: desc }); }, 'Proposition envoyée');
    else await guard(async () => { await setFamily({ settings: { ...settings(), ...data } }); await log('garde', 'Horaires de relais mis à jour', { body: desc }); }, 'Horaires enregistrés');
    S.ui.relEdit = null; closeSheet();
  },
  'set-relais-ok': async () => { const p = S.family.pendingSettings; if (!p) return; await guard(async () => { await setFamily({ settings: { ...settings(), handoverTime: p.handoverTime, middayTime: p.middayTime, relayRules: p.relayRules || settings().relayRules || [] }, pendingSettings: null }); await log('garde', 'Horaires de relais validés', { body: `soir ${E.fmtTime(p.handoverTime)}` }); }, 'Horaires validés'); },
  'set-relais-no': async () => { const p = S.family.pendingSettings; if (!p) return; await guard(async () => { await setFamily({ pendingSettings: null }); await log('garde', p.by === uid() ? 'Proposition d\'horaires annulée' : 'Changement d\'horaires refusé'); }, 'Proposition retirée'); },
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
      <label class="row gap mt2"><span class="sw"><input type="checkbox" name="on" ${m.ntfyOn ? 'checked' : ''}><span></span></span><span class="f1"><b>Recevoir les alertes</b> ${isParent() ? '(échanges, dépenses, agenda, liaison… des autres membres)' : '(nouveaux souvenirs, notes qui vous sont adressées)'}</span></label>
      ${isParent() ? `<label class="lbl">Rappel avant chaque relais</label><select class="in" name="remind">${[['off', 'Aucun rappel'], ['30', '30 min avant'], ['60', '1 h avant'], ['120', '2 h avant'], ['240', '4 h avant'], ['1440', 'La veille (24 h avant)']].map(([v, l]) => `<option value="${v}" ${String(m.remind || '120') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
      <input type="hidden" name="topic" value="${esc(topic)}">
      <div class="sh-actions"><button class="btn soft f1" data-act="push-test" data-t="${esc(topic)}">Tester</button><button class="btn primary f1" data-act="push-save">Enregistrer</button></div>`);
  },
  'push-save': async el => {
    const f = readForm(el.closest('.sheet'));
    await guard(async () => { await updItem('members', uid(), { ntfyTopic: f.topic, ntfyOn: !!f.on, remind: f.remind || '120' }); await log('cercle', `Notifications push ${f.on ? 'activées' : 'désactivées'} sur ce téléphone`, { to: 'self', icon: '📲' }); }, 'Notifications enregistrées');
    closeSheet();
  },
  'push-test': async el => { await ntfyPublish(el.dataset.t, { title: '✅ SJ Family', message: 'Les notifications fonctionnent sur ce téléphone.', tags: ['tada'] }); toast('Notification de test envoyée'); },
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
  'w-enable': async () => {
    const t = randomId(32);
    await guard(async () => { if (isParent()) await S.be.db.set(fpath('private', 'main'), { widgetToken: t, widgetHealth: false }, true); else await updItem('members', uid(), { widgetToken: t }); });
    setTimeout(() => syncFeed(true), 800); toast('Widgets activés');
  },
  'w-save': async () => { const v = document.getElementById('w-health')?.checked; await guard(() => S.be.db.set(fpath('private', 'main'), { widgetHealth: !!v }, true), 'Enregistré'); setTimeout(() => syncFeed(true), 800); },
  'w-sync': async () => { await syncFeed(true); toast('Widgets actualisés'); },
  'w-regen': async () => {
    if (!(await confirmBox('Générer un nouveau lien secret ?', 'Les widgets déjà installés devront être reconnectés.', 'Générer'))) return;
    const old = widgetToken(), t = randomId(32);
    await guard(async () => { if (isParent()) await S.be.db.set(fpath('private', 'main'), { widgetToken: t }, true); else await updItem('members', uid(), { widgetToken: t }); if (old) await S.be.db.del(`widgets/${old}`).catch(() => { }); });
    setTimeout(() => syncFeed(true), 800);
  },
  'w-copy': async el => { (await copyText(el.dataset.v)) ? toast('Copié') : toast('Copie impossible', 'err'); },
  'w-script': async () => { (await copyText(iphoneLoader(widgetToken()))) ? toast('Script copié — collez-le dans Scriptable') : toast('Copie impossible', 'err'); },
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

// ───────────── Horaires de relais : horaire par défaut + horaires réguliers (jour, semaine paire/impaire, vacances, date)
const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
export function ruleText(r) {
  const p = parents(), who = r.to ? ` · ${p[r.to]?.short || ''} récupère` : '';
  let when;
  if (r.kind === 'date') when = E.fmtDate(r.date, 'wdmy');
  else if (r.kind === 'vacStart') when = 'veille des vacances scolaires';
  else if (r.kind === 'vacEnd') when = 'dernier jour des vacances scolaires';
  else when = `${+r.every === 2 ? 'un ' : 'chaque '}${E.JOURS[+r.dow]}${+r.every === 2 ? ` sur deux (semaines ${r.parity === 'pair' ? 'paires' : 'impaires'})` : ''}${r.school ? ' en période scolaire' : ''}`;
  return `${cap(when)} · ${E.fmtTime(r.time)}${r.place ? ' · 📍 ' + r.place : ''}${who}`;
}
function relaisEditor(init = null) {
  if (!isParent()) return;
  const st = init || settings();
  S.ui.relEdit = { rules: JSON.parse(JSON.stringify(st.relayRules || [])) };
  const sh = openSheet(`<h3 class="sh-title">🔁 Horaires de relais</h3>
    <label class="lbl">Relais du soir — horaire par défaut</label><input class="in" type="time" name="ht" value="${st.handoverTime || '18:30'}">
    <label class="lbl">Relais de mi-journée (Aïd, demi-journées)</label><input class="in" type="time" name="mt" value="${st.middayTime || '14:00'}">
    <label class="lbl">Horaires réguliers (prioritaires sur l'horaire par défaut)</label><div data-part="rules"></div>
    <button class="btn soft block mt" data-act="rl-add">${IC.plus} Ajouter un horaire régulier</button>
    <div class="hint">Ex. : « chaque vendredi en période scolaire · 16h30 · École ». Le plus précis l'emporte : date précise › vacances › jour de la semaine › horaire par défaut. Un échange « horaire de relais » reste possible au cas par cas.</div>
    <div class="hint">${needsValidation() ? "L'autre parent devra valider ce changement." : 'Appliqué immédiatement.'}</div>
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="set-relais-save">Enregistrer</button></div>`, { onClose: () => { S.ui.relSheet = null; } });
  S.ui.relSheet = sh; renderRules();
}
function renderRules() {
  const sh = S.ui.relSheet, ed = S.ui.relEdit; if (!sh || !ed) return;
  sh.querySelector('[data-part="rules"]').innerHTML = ed.rules.length ? ed.rules.map((r, i) => `<div class="per"><div class="pi">🕓</div><div class="f1 small b">${esc(ruleText(r))}</div><button class="ib" data-act="rl-del" data-i="${i}">${IC.trash}</button></div>`).join('') : '<p class="small muted">Aucun : l\'horaire par défaut s\'applique à tous les relais.</p>';
}
function ruleSheet() {
  const p = parents();
  const sh = openSheet(`<h3 class="sh-title">🕓 Horaire régulier</h3>
    <label class="lbl">Quand ?</label>${chips('kind', [{ v: 'dow', l: '📅 Chaque semaine' }, { v: 'dow2', l: '🔁 Une semaine sur deux' }, { v: 'vacStart', l: '🎒 Veille des vacances' }, { v: 'vacEnd', l: '🏁 Fin des vacances' }, { v: 'date', l: '📌 Une date' }], ['dow'])}
    <div data-part="dow"><label class="lbl">Jour du relais</label>${chips('dow', E.JOURS.map((j, i) => ({ v: String(i), l: cap(j) })), ['4'])}
      <label class="row gap mt"><span class="sw"><input type="checkbox" name="school" checked><span></span></span><span class="f1">Seulement en période scolaire (pas pendant les vacances)</span></label></div>
    <div data-part="par" class="hide"><label class="lbl">Semaines</label>${chips('parity', [{ v: 'pair', l: 'Paires' }, { v: 'impair', l: 'Impaires' }], ['pair'])}</div>
    <div data-part="date" class="hide"><label class="lbl">Date</label><input class="in" type="date" name="date" value="${E.todayISO()}"></div>
    <label class="lbl">Qui récupère les enfants ?</label>${chips('to', [{ v: '', l: 'Peu importe' }, { v: 'A', l: esc(p.A.name) }, { v: 'B', l: esc(p.B.name) }], [''])}
    <div class="two"><div><label class="lbl">Heure</label><input class="in" type="time" name="time" value="16:30"></div><div><label class="lbl">Lieu</label><input class="in" name="place" placeholder="École, domicile…"></div></div>
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="rl-save">Ajouter</button></div>`);
  const upd = () => { const k = readForm(sh).kind || 'dow'; sh.querySelector('[data-part="dow"]').classList.toggle('hide', !k.startsWith('dow')); sh.querySelector('[data-part="par"]').classList.toggle('hide', k !== 'dow2'); sh.querySelector('[data-part="date"]').classList.toggle('hide', k !== 'date'); };
  sh.addEventListener('chipchange', upd);
}

// ───────────── Mode test : un cercle d'essai « 🧪 Famille TEST » avec une maman TEST (aucun lien avec le vrai cercle)
const testAcc = () => LS.get('testAcc', null);
function testCard() {
  const t = testAcc(), inTest = t && S.fid === t.fid;
  return `<div class="card"><h3>🧪 Mode test</h3>
    <p class="small muted" style="margin-top:0">Un cercle d'essai séparé avec une <b>Maman TEST</b>, pour tout essayer (validations, listes des vacances, notes…) sans toucher à votre vrai cercle ni prévenir l'autre parent.</p>
    ${t ? `<div class="prow"><span>Compte Maman TEST</span><b class="small">${esc(t.email)}</b></div>
      <div class="row gap mt"><button class="btn primary f1" data-act="test-switch">👩 Passer en Maman TEST</button><button class="btn soft f1" data-act="test-creds">🔑 Identifiants</button></div>
      <button class="btn soft block mt" data-act="fam-switch" data-id="${inTest ? (t.realFid || '') : t.fid}">${inTest ? '🏠 Revenir à mon vrai cercle' : '🧪 Ouvrir le cercle de test'}</button>`
    : `<button class="btn primary block" data-act="test-create">🧪 Créer le cercle de test avec une Maman TEST</button>`}</div>`;
}
function credsSheet(t) {
  openSheet(`<h3 class="sh-title">🔑 Maman TEST</h3><p class="small muted">Compte d'essai (adresse fictive, aucun e-mail envoyé). Pour l'utiliser : <b>Passer en Maman TEST</b>, ou connectez-vous avec ces identifiants dans un autre navigateur (Samsung Internet) pour avoir les deux parents en même temps.</p>
    <div class="prow"><span>E-mail</span><b>${esc(t.email)}</b></div><div class="prow"><span>Mot de passe</span><b>${esc(t.pw)}</b></div>
    <div class="row gap mt"><button class="btn soft f1" data-act="w-copy" data-v="${esc(t.email + ' / ' + t.pw)}">${IC.copy} Copier</button><button class="btn primary f1" data-act="test-switch">👩 Passer en Maman TEST</button></div>`);
}
Object.assign(actions, {
  'test-create': async el => {
    if (!(await confirmBox('Créer le cercle de test ?', "Un cercle « 🧪 Famille TEST » est créé avec une copie de vos enfants, de leurs photos et plannings, et un compte « Maman TEST » (adresse fictive). Votre vrai cercle n'est pas modifié et personne n'est prévenu.", 'Créer'))) return;
    await new Promise(r => setTimeout(r, 400)); // laisse la fenêtre de confirmation se fermer
    el.disabled = true; toast('Création du cercle de test…', 'ok', 2500);
    const realFid = S.fid, db = S.be.db, rnd = randomId(6).toLowerCase();
    const t = { email: `maman.test.${rnd}@example.com`, pw: 'Test-' + randomId(6), realFid, mainEmail: S.user.email, ownerUid: uid() };
    const kids = [...S.children], infos = [...S.childInfo], pls = S.plannings.filter(x => x.state === 'active'), st = settings(), short = parents()[myCode() || 'A'].short || 'Papa';
    const ok = await guard(async () => {
      const fid = await createFamily({ name: '🧪 Famille TEST', mine: short, oprenom: 'Maman', onom: 'TEST', noInvite: true, zone: st.zone, ht: st.handoverTime });
      await db.update(`families/${fid}`, { settings: { ...st }, testCircle: true });
      const map = {};
      for (const c of kids) {
        const id = db.newId(); map[c.id] = id;
        await db.set(`families/${fid}/children/${id}`, { prenom: c.prenom, nom: c.nom || '', birth: c.birth || '', emoji: c.emoji || '🧒', photo: c.photo || null, createdAt: Date.now(), createdBy: uid() });
        const info = infos.find(x => x.id === c.id); if (info) { const { id: _i, ...rest } = info; await db.set(`families/${fid}/childInfo/${id}`, rest, true); }
      }
      for (const p of pls) { const { id: _p, ...rest } = p; await db.set(`families/${fid}/plannings/${db.newId()}`, { ...rest, childIds: (p.childIds || []).map(k => map[k]).filter(Boolean) }); }
      const fam = await db.get(`families/${fid}`);
      await S.be.auth.side(t.email, t.pw, async ({ uid: mu, db: d2 }) => {
        await d2.set(`users/${mu}`, { prenom: 'Maman', nom: 'TEST', email: t.email, phone: '0600000000', familyIds: [fid], currentFamily: fid, createdAt: Date.now() }, true);
        await d2.set(`families/${fid}/members/${mu}`, { uid: mu, prenom: 'Maman', nom: 'TEST', name: 'Maman', email: t.email, phone: '0600000000', role: 'parent', relation: '', parentCode: null, joinCode: fam.joinCode, joinedAt: Date.now() });
        await d2.update(`families/${fid}`, { 'parents.B.uid': mu, 'parents.B.name': 'Maman', 'parents.B.phone': '0600000000', 'parents.B.email': t.email });
        await d2.update(`families/${fid}/members/${mu}`, { parentCode: 'B' });
        await d2.update(`families/${fid}`, { memberUids: d2.arrayUnion(mu) });
        const aid = d2.newId();
        for (const r of [mu, t.ownerUid || null].filter(Boolean)) await d2.set(`families/${fid}/inbox/${r}/items/${aid}`, { cat: 'cercle', title: 'Maman TEST a rejoint le cercle de test (parent)', body: '', icon: '🧪', by: mu, byName: 'Maman', at: Date.now() });
      });
      t.fid = fid; LS.set('testAcc', t);
      return true;
    }, 'Cercle de test prêt 🧪');
    el.disabled = false;
    if (ok) credsSheet(t);
  },
  'test-creds': () => { const t = testAcc(); if (t) credsSheet(t); },
  'test-switch': async () => {
    const t = testAcc(); if (!t) return;
    LS.set('testBackEmail', S.user?.email || t.mainEmail || '');
    await guard(async () => { await S.be.auth.signOut(); await S.be.auth.signIn(t.email, t.pw); });
    location.hash = '#/home';
  },
  'test-back': async () => {
    const back = LS.get('testBackEmail', '') || testAcc()?.mainEmail || '';
    await guard(() => S.be.auth.signOut()); S.authEmail = back; S.authMode = 'login'; location.hash = '';
  },
});
