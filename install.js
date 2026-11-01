// ═══════════════ Installation de l'application (Android / iPhone) ═══════════════
import { S, platform, isStandalone, stat, LS, SHARE_URL as APP_URL, APK_URL } from './core.js?v=6.12';
import { openSheet, toast, copyText, IC } from './ui.js?v=6.12';

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
window.addEventListener('appinstalled', () => { deferredPrompt = null; countInstall(); toast('Application installée ✓'); });

/** Compte une installation une seule fois par téléphone (ouverture en mode application) */
export function countInstall() {
  if (LS.get('installCounted', false)) return;
  LS.set('installCounted', true);
  const p = platform();
  stat(p === 'android' ? 'installAndroid' : p === 'ios' ? 'installIOS' : 'installOther');
}
export function checkStandalone() { if (isStandalone()) countInstall(); }

const shareIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`;

export function installButtons({ dark = false } = {}) {
  if (isStandalone()) return `<div class="center small" style="margin-top:14px;${dark ? 'color:#fff;opacity:.85' : ''}">✅ Application installée sur ce téléphone</div>`;
  const p = platform();
  return `<div class="inst ${dark ? 'dark' : ''}"><div class="inst-t">📲 Télécharger l'application</div>
    <div class="row gap"><button class="btn ${p === 'android' ? 'coral' : 'ghost'} f1" data-act="inst-android">🤖 Android</button>
    <button class="btn ${p === 'ios' ? 'coral' : 'ghost'} f1" data-act="inst-ios">🍏 iPhone</button></div></div>`;
}
function sendLinkHtml(target) {
  return `<p class="small">Ouvrez ce lien sur ${target} :</p><code class="tok">${APP_URL}</code>
    <div class="row gap mt"><button class="btn soft f1" data-act="inst-copy">${IC.copy} Copier le lien</button><button class="btn primary f1" data-act="inst-share">${IC.share} Envoyer</button></div>`;
}
export const actions = {
  'inst-android': async () => {
    stat('dlAndroid');
    if (platform() === 'android' && deferredPrompt) {
      try { deferredPrompt.prompt(); const r = await deferredPrompt.userChoice; deferredPrompt = null; if (r && r.outcome === 'accepted') toast('Installation en cours…'); return; }
      catch (e) { deferredPrompt = null; }
    }
    if (platform() !== 'android') {
      openSheet(`<h3 class="sh-title">🤖 Installer sur Android</h3>${sendLinkHtml('le téléphone Android (Samsung…)')}
        <p class="small muted mt">Puis, dans Chrome : menu <b>⋮</b> › <b>Installer l'application</b>.</p>`);
      return;
    }
    openSheet(`<h3 class="sh-title">🤖 Installer sur Android</h3>
      <div class="steps"><div class="st"><span class="sn">1</span><span class="f1">Dans <b>Chrome</b>, touchez le menu <b>⋮</b> en haut à droite.</span></div>
      <div class="st"><span class="sn">2</span><span class="f1">Choisissez <b>Installer l'application</b> (ou <b>Ajouter à l'écran d'accueil</b>), puis <b>Installer</b>.</span></div>
      <div class="st"><span class="sn">3</span><span class="f1">Sur <b>Samsung Internet</b> : menu <b>☰</b> › <b>Ajouter la page à</b> › <b>Écran d'accueil</b>.</span></div></div>
      <div class="alert mt"><div class="ai">⚠️</div><div class="small"><b>Chrome dit « Cette appli est déjà installée » ?</b><br>
        Une ancienne version est restée sur le téléphone, même si l'icône a disparu de l'écran d'accueil.<br>
        1. Ouvrez <b>Paramètres › Applications</b>, cherchez <b>SJ Family</b> et touchez <b>Désinstaller</b>.<br>
        2. Revenez ici et touchez à nouveau <b>Android</b>.<br>
        (Ou balayez l'écran d'accueil vers le haut : l'app est peut-être dans le tiroir d'applications → appui long › Ajouter à l'accueil.)</div></div>
      <a class="btn soft block mt" href="${APK_URL}">${IC.download} Widgets Android (SJ Widgets)</a>`);
  },
  'inst-ios': () => {
    stat('dlIOS');
    if (platform() !== 'ios') {
      openSheet(`<h3 class="sh-title">🍏 Installer sur iPhone</h3>${sendLinkHtml("l'iPhone, avec Safari")}
        <p class="small muted mt">Puis : bouton <b>Partager</b> ${shareIcon} › <b>Sur l'écran d'accueil</b> › <b>Ajouter</b>.</p>`);
      return;
    }
    const notSafari = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
    openSheet(`<h3 class="sh-title">🍏 Installer sur iPhone</h3>
      ${notSafari ? `<div class="alert"><div class="ai">🧭</div><div class="small">Sur iPhone, l'installation se fait avec <b>Safari</b>. Copiez le lien et ouvrez-le dans Safari.</div></div><button class="btn soft block mb" data-act="inst-copy">${IC.copy} Copier le lien</button>` : ''}
      <div class="steps"><div class="st"><span class="sn">1</span><span class="f1">Touchez le bouton <b>Partager</b> ${shareIcon} en bas de Safari.</span></div>
      <div class="st"><span class="sn">2</span><span class="f1">Faites défiler et choisissez <b>Sur l'écran d'accueil</b>.</span></div>
      <div class="st"><span class="sn">3</span><span class="f1">Touchez <b>Ajouter</b> : l'icône SJ Family apparaît sur l'écran d'accueil.</span></div></div>
      <p class="small muted mt">Ouvrez ensuite SJ Family depuis cette icône (et non depuis Safari) pour profiter du plein écran et des notifications.</p>`);
  },
  'inst-copy': async () => { (await copyText(APP_URL)) ? toast('Lien copié') : toast('Copie impossible', 'err'); },
  'inst-share': async () => {
    if (navigator.share) { try { await navigator.share({ title: 'SJ Family', text: "Installe l'application SJ Family :", url: APP_URL }); } catch (e) { /* annulé */ } }
    else { (await copyText(APP_URL)) ? toast('Lien copié') : toast('Copie impossible', 'err'); }
  },
};
