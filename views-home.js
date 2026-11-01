// ═══════════════ Accueil ═══════════════
import * as E from './engine.js?v=6.8';
import { S, engine, parents, pName, pShort, pColor, selChildren, selIds, setSel, uid, myName, myCode, isParent, childNames, settings, avatar, needsValidation, countdown, kidAvatar, groupAvatar, can, widgetToken, memberName, noteForMe, canApprove, approvalGroups, subLabel, leftText, isMuted } from './core.js?v=6.8';
export { countdown };
import { esc, fmtAgo } from './ui.js?v=6.8';

export function kidChips() {
  if (S.children.length < 1) return '';
  const all = S.sel.size === 0 || S.children.every(c => S.sel.has(c.id));
  return `<div class="chips scroll kid-chips">${S.children.length > 1 ? `<button class="chip ${all ? 'on' : ''}" data-act="sel-kid" data-id="">${groupAvatar(24)}Tous</button>` : ''}
    ${S.children.map(c => `<button class="chip ${!all && S.sel.has(c.id) ? 'on' : S.children.length === 1 ? 'on' : ''}" data-act="sel-kid" data-id="${c.id}">${kidAvatar(c, 24)} ${esc(c.prenom)}</button>`).join('')}</div>`;
}
/** Passe à l'enfant suivant / précédent : Tous → 1er enfant → 2e… */
export function cycleKid(dir) {
  const order = ['', ...S.children.map(c => c.id)];
  const all = S.sel.size === 0 || S.children.every(c => S.sel.has(c.id));
  const cur = all ? 0 : Math.max(0, order.indexOf([...S.sel][0]));
  const nx = order[(cur + dir + order.length) % order.length];
  setSel(nx ? [nx] : []); S.render();
}
export function cellBg(codes) {
  // codes : liste des codes du jour pour les enfants sélectionnés
  const col = c => c === 'A' ? 'var(--pa)' : c === 'B' ? 'var(--pb)' : c === 'a' ? 'var(--pa-l)' : c === 'b' ? 'var(--pb-l)' : c === 'X' ? 'linear-gradient(90deg,var(--pa) 50%,var(--pb) 50%)' : c === 'Y' ? 'linear-gradient(90deg,var(--pb) 50%,var(--pa) 50%)' : '#F2F4F8';
  const u = [...new Set(codes)];
  if (u.length <= 1) return col(u[0]);
  const solid = c => c === 'A' ? 'var(--pa)' : c === 'B' ? 'var(--pb)' : c === 'a' ? 'var(--pa-l)' : c === 'b' ? 'var(--pb-l)' : '#ddd';
  return `linear-gradient(135deg,${solid(u[0])} 50%,${solid(u[1])} 50%)`;
}
function lastHandover(eng, ids, today, min) {
  const hs = eng.handovers(ids, E.addDays(today, -45), today).filter(h => h.date < today || E.t2m(h.time) <= min);
  return hs[hs.length - 1] || null;
}
function gardeCard(kids) {
  const eng = engine(), today = E.todayISO(), min = E.nowMin(), ids = kids.map(k => k.id);
  const who = eng.presence(ids[0], today, min);
  const label = kids.length === S.children.length && kids.length > 1 ? (kids.length === 2 ? childNames(ids) : 'les enfants') : childNames(ids);
  if (!who) return `<div class="garde"><div class="gt">Garde du jour · ${esc(label)}</div>
    <div class="gw"><span class="av" style="width:48px;height:48px;background:#B8C3D2;font-size:22px">?</span><div><div class="gn">Aucun planning ce jour</div>
    <div class="gs">${isParent() ? 'Importez vos plannings 2026–2027 ou créez un rythme.' : ''}</div></div></div>
    ${isParent() ? `<div class="row gap mt"><button class="btn primary sm" data-go="plannings">📅 Plannings</button></div>` : ''}</div>`;
  const P = parents()[who], prev = lastHandover(eng, ids, today, min), next = eng.nextHandovers(ids, today, min, 1)[0];
  const code = eng.code(ids[0], today);
  const sub = [];
  if (E.isDefault(code) && min < eng.HT) sub.push('Semaine d\'école');
  if (prev) sub.push(`depuis ${E.relDay(prev.date, today)} ${E.fmtTime(prev.time)}`);
  const mon = E.mondayOf(today);
  const week = [...Array(7)].map((_, i) => {
    const d = E.addDays(mon, i), codes = ids.map(id => eng.code(id, d));
    const ho = eng.handovers(ids, d, d).length;
    return `<button class="wd ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}" style="background:${cellBg(codes)}" data-act="open-day" data-d="${d}">${E.JOURS_L[i]}<b>${+d.slice(8)}</b>${ho ? '<span class="ho">🔁</span>' : ''}</button>`;
  }).join('');
  return `<div class="garde"><div class="gt"><span class="gk">${kids.map(k => kidAvatar(k, 26)).join('')}</span>Garde du jour · ${esc(label)}</div>
    <div class="gw">${avatar(P.name, who === 'A' ? 'var(--pa-d)' : 'var(--pb-d)', 50)}<div class="f1"><div class="gn">Chez ${esc(P.name)}${P.short && P.short !== P.name ? ` <span class="muted" style="font-weight:700">(${esc(P.short)})</span>` : ''}</div>
    <div class="gs">${esc(sub.join(' · '))}</div></div></div>
    ${next ? `<div class="next"><span style="font-size:24px">🔁</span><div class="f1"><div class="nt">Relais ${esc(E.relDay(next.date, today))} à ${E.fmtTime(next.time)}${next.custom ? ' <span class="pill warn">horaire convenu</span>' : ''}</div>
      <div class="small muted">${esc(pName(next.from))} → ${esc(pName(next.to))}${next.kind === 'midi' ? ' · mi-journée' : ''}${next.place ? ' · 📍 ' + esc(next.place) : ''}</div>
      <div class="count mt6">⏱ ${countdown(next.date, next.time)}</div></div></div>` : ''}
    <div class="week">${week}</div></div>`;
}
export function pendingItems() {
  const me = uid(), out = [];
  // mes envois non validés à temps : à renvoyer (tous les membres)
  for (const g of approvalGroups({ expired: true }).filter(g => g.by === me)) {
    const n = g.items.length;
    out.push({ i: '⌛', t: `${subLabel(g.sub, n)} non validé${n > 1 ? 's' : ''} dans les 48 h${g.title ? ' : ' + g.title : ''}`, s: 'Touchez pour renvoyer la demande ou supprimer', go: g.sub });
  }
  if (!isParent()) return out;
  for (const p of S.plannings) {
    if (p.state === 'pending' && p.createdBy !== me) out.push({ i: '📅', t: `Nouveau planning à valider : ${p.title}`, s: `Proposé par ${p.createdByName || 'l\'autre parent'} · ${childNames(p.childIds)}`, go: 'plannings' });
    if (p.state === 'pending-archive' && p.archiveBy !== me) out.push({ i: '🗄️', t: `Archivage demandé : ${p.title}`, s: 'À valider', go: 'plannings' });
  }
  const xs = S.exchanges.filter(x => x.state === 'pending' && x.proposedBy !== me);
  if (xs.length) out.push({ i: '🔄', t: `${xs.length} demande${xs.length > 1 ? 's' : ''} d'échange à traiter`, s: xs.map(x => x.summary || '').slice(0, 2).join(' · '), go: 'exchanges' });
  const f = S.family;
  if (f?.pendingSettings && f.pendingSettings.by !== me) out.push({ i: '⏰', t: 'Modification des horaires de relais à valider', s: `Par ${f.pendingSettings.byName}`, go: 'settings' });
  // importations à valider (un lot = les photos/vidéos envoyées ensemble) : elles disparaissent après 48 h sans validation
  for (const g of approvalGroups()) {
    const todo = g.items.filter(canApprove); if (!todo.length) continue;
    const n = todo.length, quiet = todo.every(isMuted);
    out.push({ i: g.sub === 'docs' ? '📁' : '📸', t: `${subLabel(g.sub, n)} de ${g.byName || 'un membre'} à valider`, s: `Disparaît dans ${leftText(g.exp - Date.now())} sans validation${quiet ? ' · 🔕 rappels coupés' : ''}`, go: g.sub, mute: quiet ? null : { c: g.sub, g: g.grp } });
  }
  for (const m of S.members.filter(x => x.pendingPerms && x.pendingPerms.by !== me)) out.push({ i: '🔐', t: `Accès de ${m.prenom || m.name} à valider`, s: `Proposé par ${m.pendingPerms.byName || memberName(m.pendingPerms.by)}`, go: 'family' });
  return out;
}
/** Carte « à valider » (accueil, notifications) : le bouton Sourdine ne déclenche pas la navigation */
export function pendHtml(x) {
  return `<div class="alert"><div class="ai" data-go="${x.go}" style="cursor:pointer">${x.i}</div><div class="f1" data-go="${x.go}" style="cursor:pointer"><div class="at">${esc(x.t)}</div><div class="small">${esc(x.s)}</div></div>${x.mute ? `<button class="btn ghost sm" style="flex:none" data-act="appr-mute" data-c="${x.mute.c}" data-g="${esc(x.mute.g)}" title="Couper les rappels">🔕</button>` : ''}<span class="lnk" data-go="${x.go}" style="cursor:pointer">›</span></div>`;
}
function setupSteps() {
  if (!isParent()) return '';
  const p = parents();
  const steps = [
    { ok: S.children.length > 0, t: 'Ajouter vos enfants', go: 'family' },
    { ok: S.plannings.some(x => x.state === 'active' || x.state === 'pending'), t: 'Planning de garde (import 2026-2027 ou assistant)', go: 'plannings' },
    { ok: !!p.B.uid || S.invites.length > 0, t: "Inviter l'autre parent", go: 'family' },
    { ok: !!widgetToken(), t: 'Installer les widgets sur vos téléphones', go: 'widgets' },
  ];
  if (steps.every(s => s.ok)) return '';
  return `<div class="card"><h3>🚀 Bien démarrer</h3><div class="steps">${steps.map((s, i) => `<button class="st ${s.ok ? 'done' : ''}" style="width:100%;text-align:left" data-go="${s.go}"><span class="sn">${s.ok ? '✓' : i + 1}</span><span class="f1 ${s.ok ? 'muted' : 'b'}">${s.t}</span>${s.ok ? '' : '<span class="lnk">›</span>'}</button>`).join('')}</div></div>`;
}
function todayAgenda() {
  const today = E.todayISO(), tom = E.addDays(today, 1), ids = new Set(selIds());
  const evs = E.expandEvents(S.events, today, tom).filter(e => !e.childIds?.length || e.childIds.some(i => ids.has(i)));
  const bdays = S.children.filter(c => c.birth && ids.has(c.id) && (c.birth.slice(5) === today.slice(5) || c.birth.slice(5) === tom.slice(5)));
  const tasks = can('tasks') ? S.tasks.filter(t => !t.done && t.due && t.due <= tom && (!t.childIds?.length || t.childIds.some(i => ids.has(i)))) : [];
  if (!evs.length && !tasks.length && !bdays.length) return '';
  const eng = engine();
  const row = (d, html) => `<div class="li"><div class="le">${html.i}</div><div class="f1"><div class="lt">${esc(html.t)}</div><div class="ls">${esc(html.s)}</div></div></div>`;
  return `<div class="card"><h3>🗓️ Aujourd'hui & demain <a class="act" data-go="agenda">Agenda ›</a></h3>
    ${bdays.map(c => row(0, { i: '🎂', t: `Anniversaire de ${c.prenom} (${E.age(c.birth, c.birth.slice(5) === today.slice(5) ? today : tom)} ans)`, s: c.birth.slice(5) === today.slice(5) ? "Aujourd'hui" : 'Demain' })).join('')}
    ${evs.map(e => {
      const resp = e.who && e.who !== 'custodian' ? (e.who === 'both' ? 'Les deux parents' : pName(e.who)) : (() => { const k = e.childIds?.[0] || selIds()[0]; const p = k ? eng.presence(k, e.occ, E.t2m(e.time) ?? 600) : null; return p ? `${pShort(p)} (parent de garde)` : ''; })();
      return row(0, { i: e.icon || '📌', t: e.title, s: `${E.relDay(e.occ, today)}${e.time ? ' · ' + E.fmtTime(e.time) : ''}${e.childIds?.length ? ' · ' + childNames(e.childIds) : ''}${resp ? ' · ' + resp : ''}` });
    }).join('')}
    ${tasks.map(t => row(0, { i: '✅', t: t.title, s: `Échéance ${E.relDay(t.due, today)}` })).join('')}</div>`;
}
function lastNotes() {
  const me = uid();
  const unread = S.notes.filter(n => n.createdBy !== me && noteForMe(n) && !(n.ackBy || {})[me]).sort((a, b) => b.at - a.at);
  if (!unread.length) return '';
  const n = unread[0];
  return `<div class="alert info" data-go="liaison" style="cursor:pointer"><div class="ai">📒</div><div class="f1"><div class="at">Cahier de liaison · ${unread.length} non lu${unread.length > 1 ? 's' : ''}</div>
    <div class="small">${esc(n.createdByName)} : « ${esc(String(n.text || '📎').slice(0, 110))}${(n.text || '').length > 110 ? '…' : ''} » <span class="muted">${fmtAgo(n.at)}</span></div></div></div>`;
}
const MODULES = [
  { go: 'plannings', i: '📅', bg: '#E8EEF6', t: 'Planning', s: 'Rythmes & calendriers', parent: true },
  { go: 'budget', i: '💰', bg: '#FBF3E2', t: 'Budget', s: 'Dépenses & solde', perm: 'expenses' },
  { go: 'tasks', i: '✅', bg: '#E5F5EC', t: 'Tâches', s: 'À faire', perm: 'tasks', badge: () => S.tasks.filter(t => !t.done && (t.assignee === uid() || t.assignee === 'all')).length },
  { go: 'docs', i: '📁', bg: '#EEF0F4', t: 'Documents', s: 'Coffre numérique', perm: 'docs' },
  { go: 'contacts', i: '📞', bg: '#FCEDE9', t: 'Répertoire', s: 'Contacts', perm: 'contacts' },
  { go: 'memories', i: '📸', bg: '#F7F1E6', t: 'Souvenirs', s: 'Moments partagés' },
  { go: 'liaison', i: '📒', bg: '#FFF6DA', t: 'Liaison', s: 'Notes de liaison', badge: () => S.notes.filter(n => n.createdBy !== uid() && noteForMe(n) && !(n.ackBy || {})[uid()]).length },
  { go: 'sac', i: '🎒', bg: '#F3ECFA', t: 'Sac', s: 'Affaires du relais', perm: 'sac', procheOnly: true },
  { go: 'agenda', i: '🗓️', bg: '#E8EEF6', t: 'Agenda', s: 'Garde & événements', procheOnly: true },
  { go: 'stats', i: '📊', bg: '#E9F1FB', t: 'Bilan', s: 'Jours par parent', parent: true },
  { go: 'vacances', i: '🏖️', bg: '#E4F4F4', t: 'Vacances', s: 'Qui a quoi ?', parent: true },
  { go: 'widgets', i: '📱', bg: '#EFE9F8', t: 'Widgets', s: 'iPhone & Samsung' },
];
const visibleModules = () => MODULES.filter(m => isParent() ? !m.procheOnly : !m.parent && (!m.perm || can(m.perm)));
export const views = {
  home() {
    const now = new Date(), today = E.todayISO(now);
    const prenom = S.profile?.prenom || '';
    const kids = selChildren(), eng = engine();
    let cards = '';
    if (!kids.length) cards = '';
    else {
      // regrouper les enfants qui sont au même endroit maintenant
      const groups = new Map();
      for (const k of kids) { const key = String(eng.presence(k.id, today, E.nowMin(now))) + '|' + (eng.nextHandovers([k.id], today, E.nowMin(now), 1)[0]?.date || ''); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(k); }
      cards = [...groups.values()].map(gardeCard).join('');
    }
    const pend = pendingItems();
    return {
      html: `<h1 class="hello">Bonjour ${esc(prenom)} 👋</h1><div class="date-l">${E.fmtDate(today, 'wdmy')}</div>
      ${kidChips()}
      ${pend.map(pendHtml).join('')}
      ${lastNotes()}
      ${cards}
      ${todayAgenda()}
      ${setupSteps()}
      <h2 class="sec-t">Modules</h2>
      <div class="modules">${visibleModules().map(m => { const b = m.badge ? m.badge() : 0; return `<button class="mod" data-go="${m.go}"><div class="mi" style="background:${m.bg}">${m.i}</div><div class="mt">${m.t}</div><div class="ms">${m.s}</div>${b ? `<span class="badge">${b}</span>` : ''}</button>`; }).join('')}</div>`,
    };
  },
};
export const actions = {
  // un prénom = cet enfant seul ; « Tous » = tous les enfants (plus besoin de repasser par « Tous »)
  'sel-kid'(el) { const id = el.dataset.id; setSel(id ? [id] : []); S.render(); },
};
// rafraîchit le compte à rebours chaque minute sur l'accueil
setInterval(() => { if (S.route?.view === 'home' && !document.hidden) S.render(); }, 60000);
