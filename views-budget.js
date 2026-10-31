// ═══════════════ Budget : dépenses partagées (jamais supprimées : terminées puis archivées) ═══════════════
import * as E from './engine.js?v=6.4';
import { S, parents, pName, uid, myName, myCode, isParent, childNames, addItem, updItem, log, guard, fpath, go, selIds } from './core.js?v=6.4';
import { esc, openSheet, closeSheet, readForm, chips, confirmBox, toast, IC, fmtMoney, parseAmount, compressImage, fileToDataURL, dataURLtoBlob, download, fmtStamp } from './ui.js?v=6.4';

export const CATS = [
  { v: 'ecole', i: '🎒', l: 'Scolarité' }, { v: 'sante', i: '🩺', l: 'Santé' }, { v: 'activite', i: '⚽', l: 'Activités' }, { v: 'vetements', i: '👕', l: 'Vêtements' },
  { v: 'alim', i: '🍎', l: 'Alimentation' }, { v: 'loisirs', i: '🎡', l: 'Loisirs' }, { v: 'garde', i: '🧸', l: 'Garde / nounou' }, { v: 'transport', i: '🚗', l: 'Transport' }, { v: 'autre', i: '📦', l: 'Autre' },
];
const ci = c => CATS.find(x => x.v === c) || CATS[CATS.length - 1];
const r2 = x => Math.round(x * 100) / 100;
const pct = x => String(r2(x)).replace('.', ',') + ' %';
export function balance(list = S.expenses.filter(e => e.state !== 'archived')) {
  let bOwesA = 0, total = 0;
  for (const e of list) {
    const amt = +e.amount || 0; total += amt;
    const shA = (+e.shareA || 0) / 100, shB = 1 - shA;
    if (e.paidBy === 'A') bOwesA += amt * shB; else if (e.paidBy === 'B') bOwesA -= amt * shA;
  }
  return { net: r2(bOwesA), total: r2(total) };
}
function row(e) {
  const c = ci(e.cat), p = parents();
  const needOk = isParent() && !e.okBy && e.createdBy !== uid() && e.state !== 'archived';
  return `<button class="li" style="width:100%;text-align:left" data-act="exp-open" data-id="${e.id}"><div class="le">${c.i}</div><div class="f1"><div class="lt ell">${esc(e.title)}${e.receiptId ? ' 📎' : ''}</div>
    <div class="ls">${E.fmtDate(e.date, 'num')} · payé par ${esc(p[e.paidBy]?.name || '?')} · ${pct(e.shareA)} / ${pct(100 - e.shareA)}${e.childIds?.length ? ' · ' + esc(childNames(e.childIds)) : ''}</div>
    ${needOk ? '<span class="pill warn" style="margin-top:4px">À valider</span>' : ''}</div><div class="amt">${fmtMoney(e.amount)}</div></button>`;
}
export const views = {
  budget(params) {
    const tab = params.tab || 'cours', p = parents();
    const act = S.expenses.filter(e => e.state !== 'archived').sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt - a.createdAt));
    const arc = S.expenses.filter(e => e.state === 'archived').sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
    const { net, total } = balance(act);
    const msg = Math.abs(net) < 0.01 ? 'Comptes équilibrés ✓' : net > 0 ? `${p.B.name} doit ${fmtMoney(net)} à ${p.A.name}` : `${p.A.name} doit ${fmtMoney(-net)} à ${p.B.name}`;
    const y = new Date().getFullYear(), yearList = S.expenses.filter(e => (e.date || '').startsWith(String(y)));
    const byCat = CATS.map(c => ({ ...c, s: r2(yearList.filter(e => e.cat === c.v).reduce((a, e) => a + (+e.amount || 0), 0)) })).filter(c => c.s > 0).sort((a, b) => b.s - a.s);
    const maxC = Math.max(1, ...byCat.map(c => c.s));
    const list = tab === 'cours' ? act : arc;
    return {
      title: 'Budget', back: 'home',
      html: `<div class="bal"><div class="bs">Solde des dépenses en cours</div><div class="bv">${esc(msg)}</div><div class="bs mt">${act.length} dépense${act.length > 1 ? 's' : ''} en cours · total ${fmtMoney(total)}</div></div>
      ${isParent() ? `<div class="row gap mb"><button class="btn primary f1" data-act="exp-new">${IC.plus} Nouvelle dépense</button><button class="btn soft" data-act="exp-csv" title="Exporter">${IC.download}</button></div>` : '<div class="hint mb">Lecture seule : seuls les parents saisissent les dépenses.</div>'}
      ${byCat.length ? `<div class="card"><h3>📊 ${y} par catégorie</h3>${byCat.map(c => `<div class="row gap" style="margin:7px 0"><span style="width:26px">${c.i}</span><span class="f1"><div class="row between small"><b>${c.l}</b><span class="amt">${fmtMoney(c.s)}</span></div><div class="bar" style="height:8px"><span style="width:${c.s / maxC * 100}%;background:var(--navy2)"></span></div></span></div>`).join('')}</div>` : ''}
      <div class="seg"><button class="${tab === 'cours' ? 'on' : ''}" data-go="budget" data-params='{"tab":"cours"}'>En cours (${act.length})</button><button class="${tab === 'arch' ? 'on' : ''}" data-go="budget" data-params='{"tab":"arch"}'>Terminées (${arc.length})</button></div>
      <div class="card">${list.length ? list.map(row).join('') : `<div class="empty"><div class="e-i">💰</div>${tab === 'cours' ? 'Aucune dépense en cours.' : 'Aucune dépense terminée.'}</div>`}</div>
      <div class="hint center">Une dépense ne peut pas être supprimée : on la « termine » et elle est archivée avec la date et l'auteur.</div>`,
    };
  },
};
function expSheet(e = null) {
  const p = parents(), x = e || { date: E.todayISO(), cat: 'ecole', childIds: selIds(), paidBy: myCode() || 'A', shareA: 50, amount: '' };
  const sh = openSheet(`<h3 class="sh-title">${e ? '✏️ Modifier la dépense' : '💰 Nouvelle dépense'}</h3>
    <label class="lbl">Intitulé</label><input class="in" name="title" value="${esc(x.title || '')}" placeholder="Ex. Fournitures scolaires">
    <div class="two"><div><label class="lbl">Montant (€)</label><input class="in" name="amount" inputmode="decimal" value="${x.amount !== '' ? String(x.amount).replace('.', ',') : ''}" placeholder="0,00"></div><div><label class="lbl">Date</label><input class="in" type="date" name="date" value="${x.date}"></div></div>
    <label class="lbl">Catégorie</label>${chips('cat', CATS.map(c => ({ v: c.v, l: `${c.i} ${c.l}` })), [x.cat])}
    <label class="lbl">Enfants</label>${chips('childIds', S.children.map(c => ({ v: c.id, l: esc(c.prenom) })), x.childIds || [], { multi: true })}
    <label class="lbl">Payé par</label>${chips('paidBy', [{ v: 'A', l: esc(p.A.name) }, { v: 'B', l: esc(p.B.name) }], [x.paidBy])}
    <label class="lbl">Répartition</label>
    <div class="chips"><button type="button" class="chip sm" data-act="exp-split" data-a="50">50 / 50</button><button type="button" class="chip sm" data-act="exp-split" data-a="100">100 % ${esc(p.A.short)}</button><button type="button" class="chip sm" data-act="exp-split" data-a="0">100 % ${esc(p.B.short)}</button><button type="button" class="chip sm" data-act="exp-split" data-a="60">60 / 40</button><button type="button" class="chip sm" data-act="exp-split" data-a="40">40 / 60</button></div>
    <div class="split"><b>${esc(p.A.name)}</b><input class="in" name="pA" inputmode="decimal" value="${x.shareA}"><input class="in" name="eA" inputmode="decimal"></div>
    <div class="split"><b>${esc(p.B.name)}</b><input class="in" name="pB" inputmode="decimal" value="${100 - x.shareA}"><input class="in" name="eB" inputmode="decimal"></div>
    <div class="hint">Modifiez un pourcentage ou un montant : le reste se calcule tout seul.</div>
    <label class="lbl">Justificatif</label>
    <div class="row gap"><label class="btn soft f1">${IC.camera} Photo<input type="file" accept="image/*" capture="environment" class="hide" data-rc="1"></label><label class="btn soft f1">${IC.file} Fichier<input type="file" accept="image/*,application/pdf" class="hide" data-rc="1"></label></div>
    <div data-part="rc">${x.receiptId ? '<div class="small muted mt">📎 Justificatif déjà joint (un nouveau le remplacera)</div>' : ''}</div>
    <label class="lbl">Note</label><textarea class="in" name="note" rows="2">${esc(x.note || '')}</textarea>
    <div class="sh-actions"><button class="btn ghost f1" data-act="close-sheet">Annuler</button><button class="btn primary f1" data-act="exp-save" data-id="${e?.id || ''}">Enregistrer</button></div>`);
  const q = n => sh.querySelector(`[name="${n}"]`);
  const fmt = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
  const amt = () => parseAmount(q('amount').value);
  const fromPct = (src) => { let a = Math.min(100, Math.max(0, parseAmount(q(src).value))); if (src === 'pB') a = 100 - a; q('pA').value = String(r2(a)).replace('.', ','); q('pB').value = String(r2(100 - a)).replace('.', ','); q('eA').value = fmt(amt() * a / 100); q('eB').value = fmt(amt() * (100 - a) / 100); };
  const fromEur = (src) => { const t = amt(); if (!t) return; let ea = Math.min(t, Math.max(0, parseAmount(q(src).value))); if (src === 'eB') ea = t - ea; const a = ea / t * 100; q('pA').value = String(r2(a)).replace('.', ','); q('pB').value = String(r2(100 - a)).replace('.', ','); if (src === 'eA') q('eB').value = fmt(t - ea); else q('eA').value = fmt(ea); };
  q('pA').addEventListener('input', () => fromPct('pA')); q('pB').addEventListener('input', () => fromPct('pB'));
  q('eA').addEventListener('input', () => fromEur('eA')); q('eB').addEventListener('input', () => fromEur('eB'));
  q('amount').addEventListener('input', () => fromPct('pA'));
  sh._split = a => { q('pA').value = a; fromPct('pA'); };
  fromPct('pA');
  sh.querySelectorAll('[data-rc]').forEach(inp => inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    try {
      let data;
      if (file.type === 'application/pdf') { if (file.size > 700000) return toast('PDF trop lourd (700 Ko max). Prenez plutôt une photo.', 'warn', 4000); data = await fileToDataURL(file); }
      else data = await compressImage(file, 1400, 0.7);
      sh._receipt = { data, mime: file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg', name: file.name };
      sh.querySelector('[data-part="rc"]').innerHTML = sh._receipt.mime.startsWith('image') ? `<img class="receipt" src="${data}">` : `<div class="tile mt">📄 ${esc(file.name)}</div>`;
    } catch (err) { toast('Fichier illisible', 'err'); }
  }));
  return sh;
}
async function showReceipt(e, box) {
  const b = await S.be.db.get(fpath('blobs', e.receiptId));
  if (!b) { box.innerHTML = '<div class="small muted">Justificatif introuvable.</div>'; return; }
  if (b.mime === 'application/pdf') { const url = URL.createObjectURL(dataURLtoBlob(b.data)); box.innerHTML = `<a class="btn soft block mt" href="${url}" target="_blank" rel="noopener">📄 Ouvrir le PDF</a>`; }
  else box.innerHTML = `<img class="receipt" src="${b.data}" alt="Justificatif">`;
}
export const actions = {
  'exp-new': () => expSheet(),
  'exp-split': el => { const sh = el.closest('.sheet'); sh._split?.(el.dataset.a); },
  'exp-save': async el => {
    const sh = el.closest('.sheet'), f = readForm(sh), id = el.dataset.id;
    const amount = r2(parseAmount(f.amount));
    if (!f.title) return toast("Indiquez l'intitulé.", 'warn');
    if (!(amount > 0)) return toast('Montant invalide.', 'warn');
    const shareA = r2(Math.min(100, Math.max(0, parseAmount(f.pA))));
    const data = { title: f.title, amount, date: f.date || E.todayISO(), cat: f.cat || 'autre', childIds: f.childIds, paidBy: f.paidBy || 'A', shareA, note: f.note };
    el.disabled = true;
    const ok = await guard(async () => {
      if (sh._receipt) { const bid = S.be.db.newId(); await S.be.db.set(fpath('blobs', bid), { ...sh._receipt, at: Date.now(), by: uid() }); data.receiptId = bid; data.receiptMime = sh._receipt.mime; }
      if (id) { await updItem('expenses', id, { ...data, okBy: null }); await log('budget', `Dépense modifiée : ${f.title} ${fmtMoney(amount)}`); }
      else { await addItem('expenses', { ...data, state: 'active' }); await log('budget', `Nouvelle dépense : ${f.title} ${fmtMoney(amount)}`, { body: `Payée par ${pName(data.paidBy)} · ${pct(shareA)} / ${pct(100 - shareA)}` }); }
      return true;
    }, 'Dépense enregistrée');
    if (ok) closeSheet(); else el.disabled = false;
  },
  'exp-open': el => {
    const e = S.expenses.find(x => x.id === el.dataset.id); if (!e) return;
    const p = parents(), c = ci(e.cat), shA = +e.shareA, archived = e.state === 'archived';
    const sh = openSheet(`<h3 class="sh-title">${c.i} ${esc(e.title)}</h3>
      <div class="row between"><span class="muted">${E.fmtDate(e.date)} · ${c.l}</span><span class="amt" style="font-size:24px">${fmtMoney(e.amount)}</span></div>
      <div class="hr"></div>
      <div class="prow"><span>Payé par</span><b>${esc(p[e.paidBy]?.name)}</b></div>
      <div class="prow"><span>Part ${esc(p.A.name)}</span><b>${pct(shA)} · ${fmtMoney(e.amount * shA / 100)}</b></div>
      <div class="prow"><span>Part ${esc(p.B.name)}</span><b>${pct(100 - shA)} · ${fmtMoney(e.amount * (100 - shA) / 100)}</b></div>
      ${e.childIds?.length ? `<div class="prow"><span>Enfants</span><b>${esc(childNames(e.childIds))}</b></div>` : ''}
      ${e.note ? `<div class="note mt"><div class="nx">${esc(e.note)}</div></div>` : ''}
      <div class="small muted mt">Ajoutée par ${esc(e.createdByName || '—')} le ${fmtStamp(e.createdAt)}${e.okBy ? ` · validée par ${esc(e.okByName)} le ${fmtStamp(e.okAt)}` : ''}${archived ? ` · terminée par ${esc(e.archivedByName)} le ${fmtStamp(e.archivedAt)}` : ''}</div>
      <div data-part="rc">${e.receiptId ? '<div class="boot" style="height:80px"><div class="spin"></div></div>' : ''}</div>
      <div class="sh-actions">${!isParent() ? '<button class="btn primary f1" data-act="close-sheet">Fermer</button>' : !archived ? `${isParent() && !e.okBy && e.createdBy !== uid() ? `<button class="btn ok f1" data-act="exp-ok" data-id="${e.id}">✓ Valider</button>` : ''}<button class="btn soft f1" data-act="exp-edit" data-id="${e.id}">${IC.edit} Modifier</button><button class="btn primary f1" data-act="exp-close" data-id="${e.id}">${IC.archive} Terminer</button>`
        : `<button class="btn soft f1" data-act="exp-reopen" data-id="${e.id}">↩️ Rouvrir</button><button class="btn primary f1" data-act="close-sheet">Fermer</button>`}</div>`);
    if (e.receiptId) showReceipt(e, sh.querySelector('[data-part="rc"]'));
  },
  'exp-edit': el => { const e = S.expenses.find(x => x.id === el.dataset.id); if (e) { closeSheet(); setTimeout(() => expSheet(e), 280); } },
  'exp-ok': async el => { const e = S.expenses.find(x => x.id === el.dataset.id); if (!e) return; await guard(async () => { await updItem('expenses', e.id, { okBy: uid(), okByName: myName(), okAt: Date.now() }); await log('budget', `Dépense validée : ${e.title} ${fmtMoney(e.amount)}`); }, 'Dépense validée'); closeSheet(); },
  'exp-close': async el => {
    const e = S.expenses.find(x => x.id === el.dataset.id); if (!e) return;
    if (!(await confirmBox('Terminer cette dépense ?', `${esc(e.title)} · ${fmtMoney(e.amount)}<br>Elle sera archivée (non supprimée) et sortira du solde.`, 'Terminer'))) return;
    await guard(async () => { await updItem('expenses', e.id, { state: 'archived', archivedBy: uid(), archivedByName: myName(), archivedAt: Date.now() }); await log('budget', `Dépense terminée : ${e.title} ${fmtMoney(e.amount)}`); }, 'Dépense terminée et archivée');
    closeSheet();
  },
  'exp-reopen': async el => {
    const e = S.expenses.find(x => x.id === el.dataset.id); if (!e) return;
    await guard(async () => { await updItem('expenses', e.id, { state: 'active', reopenedBy: uid(), reopenedAt: Date.now() }); await log('budget', `Dépense rouverte : ${e.title}`); }, 'Dépense rouverte');
    closeSheet();
  },
  'exp-csv': () => {
    const p = parents(), rows = [['Date', 'Intitulé', 'Catégorie', 'Montant', 'Payé par', `Part ${p.A.name} %`, `Part ${p.B.name} %`, 'Enfants', 'État', 'Note']];
    for (const e of [...S.expenses].sort((a, b) => a.date.localeCompare(b.date))) rows.push([e.date, e.title, ci(e.cat).l, String(e.amount).replace('.', ','), p[e.paidBy]?.name, e.shareA, r2(100 - e.shareA), childNames(e.childIds), e.state === 'archived' ? 'Terminée' : 'En cours', e.note || '']);
    download(`SJ-Family-depenses-${E.todayISO()}.csv`, '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  },
};
