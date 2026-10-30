// ═══════════════════════════════════════════════════════════════
//  SJ Family — utilitaires d'interface
// ═══════════════════════════════════════════════════════════════
import { MOIS_C, JOURS_C, pad } from './engine.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => v === true ? k : `${k}="${esc(v)}"`).join(' ');

export function fmtMoney(x) { return (Math.round((+x || 0) * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
export function fmtStamp(ms) {
  if (!ms) return '';
  const d = new Date(typeof ms === 'number' ? ms : ms.seconds ? ms.seconds * 1000 : ms);
  const wd = JOURS_C[(d.getDay() + 6) % 7];
  return `${wd} ${d.getDate()} ${MOIS_C[d.getMonth()]} ${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "à l'instant"; if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`; return fmtStamp(ms);
}
export function initials(n) { return String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(); }
export function parseAmount(v) { const x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; }

// ───── Toasts
export function toast(msg, type = 'ok', ms = 2600) {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
}

// ───── Feuilles (bottom sheets) avec gestion du bouton retour
const stack = [];
export function sheetDepth() { return stack.length; }
export function openSheet(html, { onMount, cls = '', onClose } = {}) {
  const ov = document.createElement('div');
  ov.className = 'sheet-ov';
  ov.innerHTML = `<div class="sheet ${cls}" role="dialog"><div class="grab"></div>${html}</div>`;
  document.body.appendChild(ov);
  stack.push({ ov, onClose });
  history.pushState({ sheet: stack.length }, '');
  requestAnimationFrame(() => ov.classList.add('in'));
  ov.addEventListener('click', e => { if (e.target === ov) closeSheet(); });
  const sh = ov.firstElementChild;
  if (onMount) onMount(sh);
  const f = sh.querySelector('[autofocus]'); if (f && window.innerWidth > 700) f.focus();
  return sh;
}
function removeTop() {
  const it = stack.pop(); if (!it) return;
  it.ov.classList.remove('in'); setTimeout(() => it.ov.remove(), 250);
  if (it.onClose) try { it.onClose(); } catch (e) { console.warn(e); }
}
export function closeSheet() {
  if (!stack.length) return;
  if (history.state && history.state.sheet === stack.length) history.back(); else removeTop();
}
export function closeAllSheets() { while (stack.length) removeTop(); }
let afterPop = null;
/** Ferme toutes les feuilles proprement (historique compris) puis exécute fn */
export function closeSheetsThen(fn) {
  const n = stack.length;
  if (n && history.state && history.state.sheet === n) { afterPop = fn; history.go(-n); }
  else { closeAllSheets(); fn && fn(); }
}
window.addEventListener('popstate', e => {
  const want = (e.state && e.state.sheet) || 0;
  while (stack.length > want) removeTop();
  if (afterPop && stack.length === 0) { const f = afterPop; afterPop = null; setTimeout(f, 0); }
});
export function topSheet() { return stack.length ? stack[stack.length - 1].ov.firstElementChild : null; }

export function confirmBox(title, text = '', ok = 'Confirmer', danger = false) {
  return new Promise(res => {
    let done = false;
    const sh = openSheet(`<h3 class="sh-title">${esc(title)}</h3>${text ? `<p class="muted">${text}</p>` : ''}
      <div class="row gap mt"><button class="btn ghost f1" data-x="no">Annuler</button><button class="btn ${danger ? 'danger' : 'primary'} f1" data-x="yes">${esc(ok)}</button></div>`,
      { onClose: () => { if (!done) res(false); } });
    sh.addEventListener('click', e => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      done = true; res(b.dataset.x === 'yes'); closeSheet();
    });
  });
}
export function promptBox(title, { label = '', value = '', placeholder = '', ok = 'Enregistrer', type = 'text', textarea = false } = {}) {
  return new Promise(res => {
    let done = false;
    const field = textarea ? `<textarea class="in" rows="4" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input class="in" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
    const sh = openSheet(`<h3 class="sh-title">${esc(title)}</h3>${label ? `<label class="lbl">${esc(label)}</label>` : ''}${field}
      <div class="row gap mt"><button class="btn ghost f1" data-x="no">Annuler</button><button class="btn primary f1" data-x="yes">${esc(ok)}</button></div>`,
      { onClose: () => { if (!done) res(null); } });
    sh.addEventListener('click', e => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      done = true; const v = sh.querySelector('.in').value; res(b.dataset.x === 'yes' ? v : null); closeSheet();
    });
  });
}

// ───── Formulaires : lit les champs [name] et les groupes de puces [data-group]
export function readForm(root) {
  const o = {};
  for (const el of root.querySelectorAll('[name]')) {
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  }
  for (const g of root.querySelectorAll('[data-group]')) {
    const on = [...g.querySelectorAll('.on[data-val]')].map(b => b.dataset.val);
    o[g.dataset.group] = g.dataset.multi ? on : (on[0] ?? '');
  }
  return o;
}
export function chips(group, items, selected = [], { multi = false, cls = '' } = {}) {
  const sel = new Set(Array.isArray(selected) ? selected : [selected]);
  return `<div class="chips ${cls}" data-group="${group}" ${multi ? 'data-multi="1"' : ''}>${items.map(i =>
    `<button type="button" class="chip ${sel.has(String(i.v)) ? 'on' : ''}" data-act="chip" data-val="${esc(i.v)}" ${i.style ? `style="${i.style}"` : ''}>${i.l}</button>`).join('')}</div>`;
}

// ───── Images & fichiers
export function fileToDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
export async function compressImage(file, maxSide = 1400, quality = 0.72) {
  const url = await fileToDataURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let q = quality, out = c.toDataURL('image/jpeg', q);
  while (out.length > 900000 && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
  return out;
}
export function dataURLtoBlob(d) {
  const [h, b] = d.split(','); const mime = h.match(/:(.*?);/)[1]; const bin = atob(b);
  const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
}
export function download(name, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (x) { /* */ }
    ta.remove(); return ok;
  }
}

// ───── Icônes (traits SVG)
const sv = (p, w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const IC = {
  back: sv('<path d="M15 18l-6-6 6-6"/>'),
  next: sv('<path d="M9 18l6-6-6-6"/>'),
  close: sv('<path d="M18 6L6 18M6 6l12 12"/>'),
  plus: sv('<path d="M12 5v14M5 12h14"/>'),
  bell: sv('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  home: sv('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  cal: sv('<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'),
  swap: sv('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>', 26),
  users: sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.6"/><path d="M17 14.6c2.6.2 4.5 1.9 4.5 4.9"/>'),
  check: sv('<path d="M20 6L9 17l-5-5"/>'),
  edit: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: sv('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  share: sv('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  copy: sv('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  phone: sv('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  mail: sv('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3 6.5l9 6.5 9-6.5"/>'),
  sms: sv('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  pin: sv('<path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  camera: sv('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  file: sv('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
  download: sv('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
  widget: sv('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/>'),
  chart: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  lock: sv('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  logout: sv('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>'),
  refresh: sv('<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>'),
  eye: sv('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
  print: sv('<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/>'),
  archive: sv('<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v13h16V8M10 12h4"/>'),
};
