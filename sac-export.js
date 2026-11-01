// ═══════════════ Export d'une liste des vacances en JPG ou PDF (circuit complet : demande, envoi, réception, retour) ═══════════════
import { toast, download } from './ui.js?v=6.14';

const PW = 1240, PH = 1754, M = 48, TW = PW - 2 * M;
const COLW = [364, 156, 156, 156, 156, 156];
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const NAVY = '#0B3D6E', MUTED = '#5B6B82', ERR = '#C23B3B', LINE = '#D8DFEA';

function wrap(ctx, text, maxW, max = 99) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    let cur = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
  }
  if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/.{0,2}$/, '…'); }
  return out;
}
/**
 * doc = { title, lines:[…], cols:[6 libellés], rows:[{ name, sub:[…], cells:[[principal, détail, alerte]×5] }], notes:[…], stamp }
 * Renvoie une liste de pages (canvas A4 à 150 ppp).
 */
export function drawPages(doc) {
  const pages = [];
  let cv, c, y;
  const newPage = () => {
    cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, PW, PH);
    const first = !pages.length;
    c.fillStyle = NAVY; c.fillRect(0, 0, PW, first ? 150 : 74);
    c.fillStyle = '#F1DFA8'; c.font = `700 20px ${FONT}`; c.fillText('SJ FAMILY · SAC DES VACANCES', M, 36);
    c.fillStyle = '#fff'; c.font = `800 ${first ? 38 : 26}px ${FONT}`; c.fillText(doc.title, M, first ? 84 : 64, TW);
    if (first) { c.font = `500 20px ${FONT}`; c.fillStyle = '#DCE6F2'; c.fillText(doc.stamp || '', M, 122, TW); }
    pages.push(cv); y = first ? 180 : 100;
    if (first) {
      c.fillStyle = '#13233A'; c.font = `600 22px ${FONT}`;
      for (const l of doc.lines || []) { for (const s of wrap(c, l, TW)) { c.fillText(s, M, y + 20); y += 32; } }
      y += 14;
    }
    head();
  };
  const head = () => {
    c.fillStyle = '#EEF2F7'; c.fillRect(M, y, TW, 46);
    c.fillStyle = NAVY; c.font = `800 18px ${FONT}`; let x = M;
    doc.cols.forEach((t, i) => { c.fillText(t.toUpperCase(), x + 10, y + 30, COLW[i] - 16); x += COLW[i]; });
    y += 46;
  };
  newPage();
  doc.rows.forEach((r, k) => {
    c.font = `700 22px ${FONT}`; const nameL = wrap(c, r.name, COLW[0] - 20, 3);
    c.font = `500 16px ${FONT}`; const subL = (r.sub || []).flatMap(s => wrap(c, s, COLW[0] - 20, 3));
    const cellL = r.cells.map((cell, i) => { c.font = `500 15px ${FONT}`; return wrap(c, cell[1] || '', COLW[i + 1] - 16, 4); });
    const imgs = (r.imgs || []), PS = 84, PER = Math.max(1, Math.floor((COLW[0] - 16) / (PS + 6))), ph = imgs.length ? Math.ceil(imgs.length / PER) * (PS + 6) + 6 : 0;
    const hL = 16 + nameL.length * 28 + subL.length * 22 + ph, hC = 16 + 30 + Math.max(0, ...cellL.map(l => l.length)) * 20;
    const h = Math.max(70, hL, hC) + 8;
    if (y + h > PH - 70) newPage();
    c.fillStyle = k % 2 ? '#FAFBFD' : '#fff'; c.fillRect(M, y, TW, h);
    c.strokeStyle = LINE; c.lineWidth = 1; c.beginPath(); c.moveTo(M, y + h); c.lineTo(M + TW, y + h); c.stroke();
    let yy = y + 34; c.fillStyle = '#13233A'; c.font = `700 22px ${FONT}`;
    for (const s of nameL) { c.fillText(s, M + 10, yy); yy += 28; }
    c.fillStyle = MUTED; c.font = `500 16px ${FONT}`;
    for (const s of subL) { c.fillText(s, M + 10, yy - 4); yy += 22; }
    imgs.forEach((im, n) => {
      const px = M + 10 + (n % PER) * (PS + 6), py = yy - 10 + Math.floor(n / PER) * (PS + 6), s = Math.min(im.width, im.height);
      try { c.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, px, py, PS, PS); } catch (e) { /* image illisible */ }
      c.strokeStyle = LINE; c.strokeRect(px, py, PS, PS);
    });
    let x = M + COLW[0];
    r.cells.forEach((cell, i) => {
      c.strokeStyle = LINE; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + h); c.stroke();
      c.fillStyle = cell[2] ? ERR : cell[0] === '—' ? '#A9B4C4' : '#13233A'; c.font = `800 24px ${FONT}`; c.fillText(cell[0], x + 10, y + 36, COLW[i + 1] - 16);
      c.fillStyle = cell[2] ? ERR : MUTED; c.font = `500 15px ${FONT}`; let y2 = y + 58;
      for (const s of cellL[i]) { c.fillText(s, x + 10, y2, COLW[i + 1] - 16); y2 += 20; }
      x += COLW[i + 1];
    });
    y += h;
  });
  if (doc.notes?.length) {
    c.font = `500 18px ${FONT}`;
    const nl = doc.notes.flatMap(n => wrap(c, n, TW));
    if (y + 30 + nl.length * 26 > PH - 70) newPage();
    y += 30; c.fillStyle = '#13233A';
    for (const s of nl) { c.fillText(s, M, y); y += 26; }
  }
  pages.forEach((p, i) => { const g = p.getContext('2d'); g.fillStyle = MUTED; g.font = `500 16px ${FONT}`; g.fillText(`Page ${i + 1}/${pages.length}`, PW - M - 110, PH - 30); });
  return pages;
}
/** PDF minimal : une image JPEG pleine page par page (A4 portrait par défaut, paysage : 841.89 × 595.28) */
export function makePdf(jpgs, w, h, W = 595.28, H = 841.89) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const n = jpgs.length;
  push(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]));
  const obj = (num, body) => { offs[num] = len; push(`${num} 0 obj\n`); (Array.isArray(body) ? body : [body]).forEach(push); push('\nendobj\n'); };
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${jpgs.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`);
  jpgs.forEach((j, i) => {
    const p = 3 + 3 * i, cs = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`);
    obj(p + 1, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    obj(p + 2, [`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>\nstream\n`, j, '\nendstream']);
  });
  const xref = len, total = 3 + 3 * n;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) push(`${String(offs[k]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let o = 0; for (const b of parts) { out.set(b, o); o += b.length; }
  return out;
}
const toBlob = (cv, q = 0.9) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
export async function buildFile(doc, fmt, name) {
  for (const r of doc.rows) r.imgs = (await Promise.all((r.photos || []).slice(0, 12).map(loadImg))).filter(Boolean);
  const pages = drawPages(doc);
  if (fmt === 'jpg') {
    let cv = pages[0];
    if (pages.length > 1) { cv = document.createElement('canvas'); cv.width = PW; cv.height = PH * pages.length; const g = cv.getContext('2d'); pages.forEach((p, i) => g.drawImage(p, 0, i * PH)); }
    return new File([await toBlob(cv)], name + '.jpg', { type: 'image/jpeg' });
  }
  const jpgs = []; for (const p of pages) jpgs.push(new Uint8Array(await (await toBlob(p)).arrayBuffer()));
  return new File([makePdf(jpgs, PW, PH)], name + '.pdf', { type: 'application/pdf' });
}
/** Enregistre le fichier dans Téléchargements */
export function saveFile(file) { download(file.name, file); toast(`« ${file.name} » enregistré dans Téléchargements`, 'ok', 3500); }
export async function shareFile(file, title) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  download(file.name, file); toast('Fichier enregistré dans Téléchargements');
}
