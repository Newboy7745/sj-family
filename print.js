// ═══════════════ Calendrier annuel imprimable — même organisation que les plannings officiels (PLANNING GARDE … 2026 / 2027) ═══════════════
// 12 tableaux mensuels (N° · S. · Jour · Garde · Commentaire), totaux par mois et par an, à jour de tous les changements validés.
import * as E from './engine.js?v=6.6';
import { S, engine, parents, selIds, isParent, setFamily, guard } from './core.js?v=6.6';
import { esc, openSheet, closeSheet, readForm, chips, toast, IC, download } from './ui.js?v=6.6';

const MO = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
const JR = ['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'];
const W = 2063, H = 1792, TW = 327, GAP = (W - 6 * TW) / 5, RH = 21.75;
const CX = [0, 33, 66, 101, 148, TW]; // N° · S. · Jour · Garde · Commentaire
const GREY_T = '#BFBFBF', GREY_H = '#D9D9D9', GREY_C = '#E4E4E4', WK_ODD = '#C8C8C8', WK_EVEN = '#ECECEC', EMPTY = '#F2F2F2', LINE = '#A9A9A9', INK = '#111111';

function lighten(hex, k) {
  const n = parseInt(String(hex).replace('#', ''), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k);
  return `rgb(${r},${g},${b})`;
}
const fmtJ = x => `${Number.isInteger(x) ? x : String(x).replace('.', ',')} j`;
/** Initiales d'un parent pour le calendrier (KA, JE…) : réglables dans la fenêtre d'impression */
export function initials(c) {
  const p = S.family?.parents?.[c] || {}, P = parents()[c];
  if (p.ini) return p.ini;
  const m = S.members.find(x => x.uid && x.uid === P.uid);
  const nom = p.nom || m?.nom || (P.uid && P.uid === S.user?.uid ? S.profile?.nom : '') || '';
  const pre = (P.name || '').trim();
  return ((pre[0] || '') + (nom.trim()[0] || pre[1] || '')).toUpperCase() || c;
}
function yearsAvailable() {
  const ys = new Set([new Date().getFullYear()]);
  for (const p of S.plannings) if (p.state === 'active' && p.start && p.days) { const a = +p.start.slice(0, 4), b = +E.addDays(p.start, p.days.length - 1).slice(0, 4); for (let y = a; y <= b; y++) ys.add(y); }
  return [...ys].sort();
}

/** Dessine l'année sur un canvas (k = échelle de netteté) */
export function drawYear(cv, { year, kidId, title, ini, k = 1.4 }) {
  const eng = engine(), pr = parents(), colA = pr.A.color, colB = pr.B.color;
  const ecoleA = lighten(colA, 0.55), ecoleB = lighten(colB, 0.55);
  cv.width = Math.round(W * k); cv.height = Math.round(H * k);
  const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
  const F = (w, px, it = false) => `${it ? 'italic ' : ''}${w} ${px}px Arial, Helvetica, sans-serif`;
  const rect = (x, y, w, h, fill, stroke = LINE) => { if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.7; g.strokeRect(x + .35, y + .35, w - .7, h - .7); } };
  const split = (x, y, w, h, c1, c2) => { g.fillStyle = c1; g.fillRect(x, y, w / 2, h); g.fillStyle = c2; g.fillRect(x + w / 2, y, w / 2, h); rect(x, y, w, h, null); };
  const text = (s, x, y, { font = F('normal', 10), color = INK, align = 'center', max = 0 } = {}) => {
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.font = font;
    let t = String(s);
    if (max) { let px = parseFloat(font.match(/(\d+(\.\d+)?)px/)[1]); while (g.measureText(t).width > max && px > 7) { px -= .5; g.font = font.replace(/\d+(\.\d+)?px/, px + 'px'); } while (g.measureText(t).width > max && t.length > 2) t = t.slice(0, -2) + '…'; }
    g.fillText(t, x, y);
  };
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  // titre
  g.fillStyle = GREY_T; g.fillRect(0, 0, W, 42);
  text(title, W / 2, 22, { font: F('bold', 21) });
  // légende
  const leg = [[colB, `Garde ${pr.B.name} — ${ini.B}`, 22], [colA, `Garde ${pr.A.name} — ${ini.A}`, 262], [ecoleB, "Jours d'école", 487], ['#000', 'Férié', 678], ['split', 'Aïd - 0,5 j chacun', 800]];
  for (const [c, l, x] of leg) {
    if (c === 'split') split(x, 56, 34, 20, colA, colB); else rect(x, 56, 34, 20, c, c === '#000' ? '#000' : '#C9C9C9');
    text(l, x + 42, 66, { font: F('bold', 11), align: 'left' });
  }
  const tot = { A: 0, B: 0 };
  for (let m = 0; m < 12; m++) {
    const x0 = (m % 6) * (TW + GAP), y0 = m < 6 ? 93 : 878, mm = String(m + 1).padStart(2, '0'), nd = E.monthDays(year, m + 1);
    rect(x0, y0, TW, 31, GREY_H); text(MO[m], x0 + TW / 2, y0 + 16, { font: F('bold', 14) });
    ['N°', 'S.', 'Jour', 'Garde', 'Commentaire'].forEach((h, i) => { rect(x0 + CX[i], y0 + 31, CX[i + 1] - CX[i], 25, GREY_C); text(h, x0 + (CX[i] + CX[i + 1]) / 2, y0 + 44, { font: F('bold', 10) }); });
    const cnt = { A: 0, B: 0 };
    for (let d = 1; d <= 31; d++) {
      const y = y0 + 56 + (d - 1) * RH, cell = i => [x0 + CX[i], y, CX[i + 1] - CX[i], RH];
      if (d > nd) { for (let i = 0; i < 5; i++) rect(...cell(i), EMPTY); continue; }
      const iso = `${year}-${mm}-${String(d).padStart(2, '0')}`, c = eng.code(kidId, iso), info = eng.dayInfo(iso), wd = E.dow(iso), wk = E.isoWeek(iso).week;
      const fer = !!info.ferie, half = E.isHalf(c), counted = c === 'A' || c === 'B';
      if (c === 'A') cnt.A++; else if (c === 'B') cnt.B++; else if (half) { cnt.A += .5; cnt.B += .5; }
      const dayCol = c === 'A' ? colA : c === 'B' ? colB : c === 'a' ? ecoleA : c === 'b' || half ? ecoleB : '#fff';
      // N°
      rect(...cell(0), '#fff'); text(d, x0 + 16.5, y + RH / 2 + .5, { font: F('bold', 10) });
      // S. (semaines impaires foncées) — numéro le 1er du mois et chaque lundi
      rect(...cell(1), wk % 2 ? WK_ODD : WK_EVEN); if (d === 1 || wd === 0) text(wk, x0 + 49.5, y + RH / 2 + .5, { font: F('normal', 9.5, true), color: '#555' });
      // Jour
      rect(...cell(2), dayCol); text(JR[wd], x0 + 83.5, y + RH / 2 + .5, { font: F('normal', 10) });
      // Garde
      const code = c === 'A' ? ini.A : c === 'B' ? ini.B : c === 'X' ? `${ini.A}/${ini.B}` : c === 'Y' ? `${ini.B}/${ini.A}` : '';
      if (half) { split(...cell(3), c === 'X' ? colA : colB, c === 'X' ? colB : colA); text(code, x0 + 124.5, y + RH / 2 + .5, { font: F('bold', 9.5) }); }
      else if (fer && (counted || E.isDefault(c))) { rect(...cell(3), '#000', '#000'); text(code, x0 + 124.5, y + RH / 2 + .5, { font: F('bold', 10), color: '#fff' }); }
      else { rect(...cell(3), counted ? dayCol : c === '.' ? '#fff' : dayCol); text(code, x0 + 124.5, y + RH / 2 + .5, { font: F('bold', 10) }); }
      // Commentaire
      const ov = eng.isOverridden(kidId, iso);
      const com = info.comment || info.ferie || (ov ? 'Échange validé' : '');
      const [cx, , cw] = cell(4);
      if (half) { split(...cell(4), c === 'X' ? colA : colB, c === 'X' ? colB : colA); text(com, cx + cw / 2, y + RH / 2 + .5, { font: F('bold', 9.5), max: cw - 8 }); }
      else if (fer) { rect(...cell(4), '#000', '#000'); text(com, cx + 5, y + RH / 2 + .5, { font: F('bold', 9.5), color: '#fff', align: 'left', max: cw - 10 }); }
      else { rect(...cell(4), counted ? dayCol : '#fff'); if (com) text(com, cx + 5, y + RH / 2 + .5, { font: F(ov && !info.comment ? 'normal' : 'normal', 9.5, ov && !info.comment), align: 'left', max: cw - 10 }); }
    }
    const fy = y0 + 56 + 31 * RH;
    rect(x0, fy, TW / 2, 30, colB); text(`${ini.B} : ${fmtJ(cnt.B)}`, x0 + TW / 4, fy + 15.5, { font: F('bold', 11) });
    rect(x0 + TW / 2, fy, TW / 2, 30, colA); text(`${ini.A} : ${fmtJ(cnt.A)}`, x0 + TW * 3 / 4, fy + 15.5, { font: F('bold', 11) });
    tot.A += cnt.A; tot.B += cnt.B;
  }
  // parité des week-ends de chaque parent (sem. paires / impaires)
  const par = { A: [0, 0], B: [0, 0] };
  for (const iso of E.eachDay(`${year}-01-01`, `${year}-12-31`)) { if (E.dow(iso) < 5) continue; const c = eng.code(kidId, iso); if ((c === 'A' || c === 'B') && !eng.dayInfo(iso).holiday) par[c][E.isoWeek(iso).week % 2]++; }
  const lab = c => par[c][0] + par[c][1] > 4 ? (par[c][0] > par[c][1] * 2 ? ' (sem. paires)' : par[c][1] > par[c][0] * 2 ? ' (sem. impaires)' : '') : '';
  text(`TOTAL JOURS DE GARDE ${year}`, 22, 1672, { font: F('bold', 14), align: 'left' });
  rect(22, 1686, 465, 32, colB); text(`Garde ${pr.B.name}${lab('B')} : ${String(tot.B).replace('.', ',')} jours`, 22 + 232, 1702.5, { font: F('bold', 11.5) });
  rect(508, 1686, 465, 32, colA); text(`Garde ${pr.A.name}${lab('A')} : ${String(tot.A).replace('.', ',')} jours`, 508 + 232, 1702.5, { font: F('bold', 11.5) });
  rect(995, 1686, 296, 32, GREY_C); text(`TOTAL : ${String(tot.A + tot.B).replace('.', ',')} jours`, 995 + 148, 1702.5, { font: F('bold', 11.5) });
  text(`Édité le ${E.fmtDate(E.todayISO(), 'num')} avec SJ Family · changements validés inclus`, W - 22, 1770, { font: F('normal', 9.5, true), color: '#888', align: 'right' });
  return { tot };
}

// ───── Fenêtre d'impression
let last = null;
function sameSchedule(ids, year) {
  const eng = engine(); if (ids.length < 2) return true;
  for (const iso of E.eachDay(`${year}-01-01`, `${year}-12-31`)) { const c = eng.code(ids[0], iso); if (ids.some(id => eng.code(id, iso) !== c)) return false; }
  return true;
}
function render(sh) {
  const f = readForm(sh), year = +(f.year || new Date().getFullYear()), kidId = f.kid || S.children[0]?.id;
  if (!kidId) { sh.querySelector('[data-part="pv"]').innerHTML = '<p class="muted">Ajoutez un enfant et un planning.</p>'; return; }
  const all = S.children.map(c => c.id), same = sameSchedule(all, year);
  const kids = f.kid === '*' || (same && (!f.kid || f.kid === '*')) ? S.children : S.children.filter(c => c.id === kidId);
  const ini = { A: (f.iniA || initials('A')).toUpperCase(), B: (f.iniB || initials('B')).toUpperCase() };
  const title = `PLANNING GARDE ${kids.map(c => c.prenom.toUpperCase()).join(' & ')} ${year}`;
  const cv = document.createElement('canvas');
  drawYear(cv, { year, kidId: kids[0].id, title, ini });
  last = { cv, year, title, ini };
  const url = cv.toDataURL('image/png');
  sh.querySelector('[data-part="pv"]').innerHTML = `<img class="print-pv" src="${url}" alt="Aperçu">`;
  sh.querySelector('[data-part="warn"]').innerHTML = !same && f.kid === '*' ? '<div class="hint">Les enfants n\'ont pas exactement le même planning cette année : choisissez un enfant.</div>' : '';
}
export function openPrint(year = null) {
  const ys = yearsAvailable(), y = year || (ys.includes(new Date().getFullYear()) ? new Date().getFullYear() : ys[0]);
  const ids = S.children.map(c => c.id), same = sameSchedule(ids, y), sel = selIds();
  const kidOpts = [...(S.children.length > 1 ? [{ v: '*', l: 'Tous' }] : []), ...S.children.map(c => ({ v: c.id, l: esc(c.prenom) }))];
  const kidSel = S.children.length > 1 && same && sel.length === ids.length ? '*' : sel[0] || ids[0];
  const sh = openSheet(`<h3 class="sh-title">🖨️ Calendrier annuel</h3>
    <p class="small muted" style="margin-top:0">Même présentation que vos plannings officiels, avec tous les changements validés (échanges, plannings).</p>
    <label class="lbl">Année</label>${chips('year', ys.map(v => ({ v: String(v), l: String(v) })), [String(y)])}
    <label class="lbl">Enfants</label>${chips('kid', kidOpts, [kidSel])}
    <div class="two"><div><label class="lbl">Initiales ${esc(parents().A.name)}</label><input class="in" name="iniA" maxlength="4" value="${esc(initials('A'))}"></div><div><label class="lbl">Initiales ${esc(parents().B.name)}</label><input class="in" name="iniB" maxlength="4" value="${esc(initials('B'))}"></div></div>
    <div data-part="warn"></div><div data-part="pv" class="mt"><div class="boot" style="height:120px"><div class="spin"></div></div></div>
    <div class="sh-actions"><button class="btn soft f1" data-act="print-share">${IC.share} Partager</button><button class="btn primary f1" data-act="print-go">${IC.print} Imprimer</button></div>`, { cls: 'full' });
  const upd = () => setTimeout(() => render(sh), 30);
  sh.addEventListener('chipchange', upd); sh.addEventListener('change', upd);
  upd();
}
async function saveIni(sh) {
  if (!isParent()) return;
  const f = readForm(sh), fam = S.family?.parents || {}, data = {};
  for (const c of ['A', 'B']) { const v = (f['ini' + c] || '').toUpperCase(); if (v && v !== (fam[c]?.ini || '')) data[`parents.${c}.ini`] = v; }
  if (Object.keys(data).length) await guard(() => setFamily(data));
}
export const actions = {
  'print-go': async el => {
    const sh = el.closest('.sheet'); render(sh); if (!last) return; saveIni(sh);
    let box = document.getElementById('printpage'); if (!box) { box = document.createElement('div'); box.id = 'printpage'; document.body.appendChild(box); }
    box.innerHTML = `<img src="${last.cv.toDataURL('image/png')}" alt="">`;
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { try { window.print(); } catch (e) { toast('Impression indisponible : utilisez « Partager ».', 'warn'); done(); } }, 250);
    setTimeout(done, 60000);
  },
  'print-share': async el => {
    const sh = el.closest('.sheet'); render(sh); if (!last) return; saveIni(sh);
    const name = `${last.title.replace(/[^\wÀ-ÿ& -]/g, '').replace(/\s+/g, '-')}.png`;
    const blob = await new Promise(r => last.cv.toBlob(r, 'image/png'));
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: last.title }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    download(name, blob); toast('Image enregistrée');
  },
};
