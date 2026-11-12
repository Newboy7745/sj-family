process.on('unhandledRejection', e => { console.log(`::error title=Plantage::${String(e?.stack || e).replace(/\s+/g, ' ').slice(0, 900)}`); process.exit(1); });
// Tests des règles Firestore de SJ Family (exécutés par GitHub Actions avec l'émulateur Firestore)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy, limit, arrayUnion } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-sjf', firestore: { rules: readFileSync('../../firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
const F = 'fam1', T0 = 1793491200000;
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, `families/${F}`), { name: 'Famille', ownerUid: 'pa', joinCode: 'ABC123', memberUids: ['pa'], parents: { A: { uid: 'pa', name: 'Khalid' }, B: { uid: null, name: 'Jounayda' } }, settings: { handoverTime: '18:30' }, widgetToken: 'tok' });
  await setDoc(doc(db, `families/${F}/members/pa`), { uid: 'pa', parentCode: 'A', role: 'parent' });
  await setDoc(doc(db, 'joinCodes/ABC123'), { fid: F });
  await setDoc(doc(db, `families/${F}/children/k1`), { prenom: 'Selman' });
  await setDoc(doc(db, `families/${F}/childInfo/k1`), { doctor: 'Dr X' });
  await setDoc(doc(db, `families/${F}/plannings/p1`), { state: 'active' });
  await setDoc(doc(db, `families/${F}/exchanges/x1`), { state: 'accepted' });
  await setDoc(doc(db, `families/${F}/exchanges/x2`), { state: 'pending' });
  await setDoc(doc(db, `families/${F}/notes/n0`), { text: 'ancienne', createdBy: 'pa' });
  await setDoc(doc(db, `families/${F}/blobs/bm`), { kind: 'mem', by: 'pa', data: 'x' });
  await setDoc(doc(db, `families/${F}/blobs/bd`), { kind: 'doc', by: 'pa', data: 'x' });
  await setDoc(doc(db, `families/${F}/docs/d1`), { title: 'CNI', createdBy: 'pa', pub: true });
  await setDoc(doc(db, `families/${F}/activity/a1`), { title: 'vieux', at: T0 - 1000 });
});
const as = u => env.authenticatedContext(u).firestore();
const pa = as('pa'), pb = as('pb'), pr = as('pr');
let fails = 0, n = 0;
async function t(name, p, ok = true) {
  n++;
  try { await (ok ? assertSucceeds(p) : assertFails(p)); console.log('✓', name); }
  catch (e) { fails++; const m = String(e?.message || e).replace(/\s+/g, ' ').slice(0, 300); console.log('✗', name, '—', m); console.log(`::error title=${name}::${m}`); }
}
// Parent seul
await t('parent lit le cercle', getDoc(doc(pa, `families/${F}`)));
await t('parent liste les membres', getDocs(collection(pa, `families/${F}/members`)));
await t('parent lit childInfo', getDoc(doc(pa, `families/${F}/childInfo/k1`)));
await t('parent écrit private', setDoc(doc(pa, `families/${F}/private/main`), { widgetToken: 'tok' }));
await t('parent migre le jeton', updateDoc(doc(pa, `families/${F}`), { widgetToken: null }));
await t('parent lit l\'ancien journal', getDocs(query(collection(pa, `families/${F}/activity`), where('at', '<', T0), orderBy('at', 'desc'), limit(10))));
await t('parent écrit son historique', setDoc(doc(pa, `families/${F}/inbox/pa/items/i1`), { by: 'pa', at: 1 }));
await t('parent ne change pas le parent A', updateDoc(doc(pa, `families/${F}`), { 'parents.A.uid': 'zz' }), false);
// Un proche rejoint
await t('proche crée sa fiche avec le code', setDoc(doc(pr, `families/${F}/members/pr`), { uid: 'pr', role: 'proche', parentCode: null, joinCode: 'ABC123' }));
await t('proche ne peut pas se donner des droits', updateDoc(doc(pr, `families/${F}/members/pr`), { perms: { docs: true } }), false);
await t('proche ne peut pas devenir parent', updateDoc(doc(pr, `families/${F}/members/pr`), { parentCode: 'A' }), false);
await t('proche s\'ajoute à memberUids', updateDoc(doc(pr, `families/${F}`), { memberUids: arrayUnion('pr') }));
await t('proche ne modifie pas les réglages', updateDoc(doc(pr, `families/${F}`), { 'settings.handoverTime': '10:00' }), false);
await t('proche lit sa fiche', getDoc(doc(pr, `families/${F}/members/pr`)));
await t('proche ne liste pas les membres', getDocs(collection(pr, `families/${F}/members`)), false);
await t('proche lit les enfants', getDocs(collection(pr, `families/${F}/children`)));
await t('proche ne lit pas childInfo', getDoc(doc(pr, `families/${F}/childInfo/k1`)), false);
await t('proche lit les plannings', getDocs(collection(pr, `families/${F}/plannings`)));
await t('proche lit les échanges acceptés', getDocs(query(collection(pr, `families/${F}/exchanges`), where('state', '==', 'accepted'))));
await t('proche ne liste pas tous les échanges', getDocs(collection(pr, `families/${F}/exchanges`)), false);
await t('proche ne lit pas private', getDoc(doc(pr, `families/${F}/private/main`)), false);
await t('proche écrit aux parents', setDoc(doc(pr, `families/${F}/notes/n1`), { text: 'coucou', to: ['pa'], createdBy: 'pr' }));
await t('proche écrit à un autre proche (lu par les parents)', setDoc(doc(pr, `families/${F}/notes/n2`), { text: 'x', to: ['zz'], createdBy: 'pr' }));
await t('proche n\'écrit pas sans destinataire', setDoc(doc(pr, `families/${F}/notes/n3`), { text: 'x', to: [], createdBy: 'pr' }), false);
await t('parent lit la note entre proches', getDoc(doc(pa, `families/${F}/notes/n2`)));
await t('proche lit ses notes (créées)', getDocs(query(collection(pr, `families/${F}/notes`), where('createdBy', '==', 'pr'))));
await t('proche lit les notes qui lui sont adressées', getDocs(query(collection(pr, `families/${F}/notes`), where('to', 'array-contains', 'pr'))));
await t('proche ne liste pas toutes les notes', getDocs(collection(pr, `families/${F}/notes`)), false);
await t('proche lit une photo souvenir', getDoc(doc(pr, `families/${F}/blobs/bm`)));
await t('proche ne lit pas un document', getDoc(doc(pr, `families/${F}/blobs/bd`)), false);
await t('proche ne lit pas Documents', getDocs(collection(pr, `families/${F}/docs`)), false);
await t('proche ajoute un souvenir (à valider)', setDoc(doc(pr, `families/${F}/memories/m1`), { createdBy: 'pr', title: 'Plage', pub: false, createdAt: Date.now() }));
await t('proche ne publie pas lui-même', setDoc(doc(pr, `families/${F}/memories/m2`), { createdBy: 'pr', title: 'X', pub: true }), false);
await t('proche lit ses souvenirs en attente', getDocs(query(collection(pr, `families/${F}/memories`), where('createdBy', '==', 'pr'))));
await t('proche lit les souvenirs publiés', getDocs(query(collection(pr, `families/${F}/memories`), where('pub', '==', true))));
await t('proche ne liste pas tous les souvenirs', getDocs(collection(pr, `families/${F}/memories`)), false);
await t('proche ne valide pas son souvenir', updateDoc(doc(pr, `families/${F}/memories/m1`), { pub: true }), false);
await t('parent valide le souvenir', updateDoc(doc(pa, `families/${F}/memories/m1`), { pub: true, okBy: 'pa' }));
// photos et vidéos privées des parents
await t('proche ne crée pas de souvenir privé', setDoc(doc(pr, `families/${F}/memories/mp0`), { createdBy: 'pr', title: 'X', pub: false, priv: true }), false);
await t('parent ne crée pas de privé publié', setDoc(doc(pa, `families/${F}/memories/mp1`), { createdBy: 'pa', title: 'X', pub: true, priv: true }), false);
await t('parent crée un souvenir privé', setDoc(doc(pa, `families/${F}/memories/mp2`), { createdBy: 'pa', title: 'Privé', pub: false, priv: true, createdAt: Date.now(), sentAt: Date.now() }));
await t('proche ne lit pas le souvenir privé', getDoc(doc(pr, `families/${F}/memories/mp2`)), false);
await t('parent ne publie pas un privé', updateDoc(doc(pa, `families/${F}/memories/mp2`), { pub: true }), false);
await t('parent ne retire pas « privé »', updateDoc(doc(pa, `families/${F}/memories/mp2`), { priv: false }), false);
await t('parent modifie le titre du privé', updateDoc(doc(pa, `families/${F}/memories/mp2`), { title: 'Privé 2' }));
await t('proche ne crée pas de blob privé', setDoc(doc(pr, `families/${F}/blobs/bp0`), { kind: 'pmem', by: 'pr', data: 'x' }), false);
await t('parent crée un blob privé', setDoc(doc(pa, `families/${F}/blobs/bp1`), { kind: 'pmem', by: 'pa', data: 'x' }));
await t('proche ne lit pas le blob privé', getDoc(doc(pr, `families/${F}/blobs/bp1`)), false);
await t('proche ne crée pas d\'événement', setDoc(doc(pr, `families/${F}/events/e1`), { createdBy: 'pr', title: 'Anniv' }), false);
await t('proche lit les événements', getDocs(collection(pr, `families/${F}/events`)));
await t('proche notifie un parent', setDoc(doc(pr, `families/${F}/inbox/pa/items/i2`), { by: 'pr', at: 2 }));
await t('proche ne lit pas l\'historique d\'un parent', getDocs(collection(pr, `families/${F}/inbox/pa/items`)), false);
await t('proche ne lit pas l\'ancien journal', getDocs(query(collection(pr, `families/${F}/activity`), where('at', '<', T0))), false);
// Parent seul : ouvre Documents au proche directement
await t('parent seul ouvre Documents', updateDoc(doc(pa, `families/${F}/members/pr`), { perms: { docs: true } }));
await t('proche lit Documents publiés (autorisé)', getDocs(query(collection(pr, `families/${F}/docs`), where('pub', '==', true))));
await t('proche ne liste pas tous les Documents', getDocs(collection(pr, `families/${F}/docs`)), false);
await t('proche lit un document (autorisé)', getDoc(doc(pr, `families/${F}/blobs/bd`)));
// Le 2e parent rejoint
await t('parent B crée sa fiche', setDoc(doc(pb, `families/${F}/members/pb`), { uid: 'pb', role: 'parent', parentCode: null, joinCode: 'ABC123' }));
await t('parent B prend la place B', updateDoc(doc(pb, `families/${F}`), { 'parents.B.uid': 'pb', 'parents.B.name': 'Jounayda' }));
await t('parent B se déclare parent B', updateDoc(doc(pb, `families/${F}/members/pb`), { parentCode: 'B' }));
await t('parent B lit childInfo', getDoc(doc(pb, `families/${F}/childInfo/k1`)));
await t('un proche ne peut plus prendre la place B', updateDoc(doc(pr, `families/${F}`), { 'parents.B.uid': 'pr' }), false);
// Validation croisée des accès
await t('parent A ne change plus seul les accès', updateDoc(doc(pa, `families/${F}/members/pr`), { perms: { docs: false } }), false);
await t('parent A propose', updateDoc(doc(pa, `families/${F}/members/pr`), { pendingPerms: { perms: { docs: false, tasks: true }, by: 'pa' } }));
await t('parent A ne valide pas sa propre proposition', updateDoc(doc(pa, `families/${F}/members/pr`), { perms: { docs: false, tasks: true }, pendingPerms: null }), false);
await t('parent B valide', updateDoc(doc(pb, `families/${F}/members/pr`), { perms: { docs: false, tasks: true }, pendingPerms: null }));
await t('proche ne lit plus Documents', getDocs(query(collection(pr, `families/${F}/docs`), where('pub', '==', true))), false);
await t('proche lit Tâches', getDocs(collection(pr, `families/${F}/tasks`)));
await t('jeton widgets : parent écrit', setDoc(doc(pa, 'widgets/tok'), { fid: F, payload: '{}' }));
await t('jeton widgets : lecture publique', getDoc(doc(env.unauthenticatedContext().firestore(), 'widgets/tok')));
// Création d'un nouveau cercle (comme l'application ou l'installation express)
const pz = as('pz');
await t('nouveau parent crée son cercle', setDoc(doc(pz, 'families/fam2'), { name: 'F2', ownerUid: 'pz', joinCode: 'ZZZ999', memberUids: ['pz'], parents: { A: { uid: 'pz', name: 'Z' }, B: { uid: null, name: 'Y' } }, settings: {} }));
await t('nouveau parent crée sa fiche', setDoc(doc(pz, 'families/fam2/members/pz'), { uid: 'pz', parentCode: 'A', role: 'parent' }));
await t('nouveau parent crée le code', setDoc(doc(pz, 'joinCodes/ZZZ999'), { fid: 'fam2' }));
await t('nouveau parent écrit son historique', setDoc(doc(pz, 'families/fam2/inbox/pz/items/a'), { by: 'pz', at: 3 }));
await t('nouveau parent ajoute un enfant', setDoc(doc(pz, 'families/fam2/children/c1'), { prenom: 'A', photo: null }));
await t('nouveau parent écrit childInfo', setDoc(doc(pz, 'families/fam2/childInfo/c1'), { cls: 'CM1' }));
await t('nouveau parent importe un planning', setDoc(doc(pz, 'families/fam2/plannings/p1'), { state: 'active' }));
await t('un inconnu ne lit pas le cercle', getDoc(doc(pr, 'families/fam2')), false);
// Accusé de lecture, sac, souvenirs
await t('parent écrit au proche', setDoc(doc(pa, `families/${F}/notes/n3`), { text: 'Merci', to: ['pr'], createdBy: 'pa' }));
await t('proche marque la note lue', updateDoc(doc(pr, `families/${F}/notes/n3`), { 'ackBy.pr': 5 }));
await t('proche ne modifie pas le texte', updateDoc(doc(pr, `families/${F}/notes/n3`), { text: 'x' }), false);
await t('parent remplit le sac', setDoc(doc(pa, `families/${F}/sac/s1`), { name: 'Doudou', createdBy: 'pa' }));
await t('proche sans accès ne voit pas le sac', getDocs(collection(pr, `families/${F}/sac`)), false);
await t('parent supprime le souvenir du proche', deleteDoc(doc(pa, `families/${F}/memories/m1`)));
// Validation sous 48 h par l'autre parent, sinon renvoi
const H48 = 48 * 3600000, now = Date.now();
await t('parent A envoie un souvenir à valider', setDoc(doc(pa, `families/${F}/memories/m4`), { createdBy: 'pa', pub: false, grp: 'g4', sentAt: now, createdAt: now }));
await t('parent A ne valide pas son propre souvenir', updateDoc(doc(pa, `families/${F}/memories/m4`), { pub: true }), false);
await t('parent B coupe les rappels', updateDoc(doc(pb, `families/${F}/memories/m4`), { 'muted.pb': true }));
await t('parent B valide dans les 48 h', updateDoc(doc(pb, `families/${F}/memories/m4`), { pub: true, okBy: 'pb' }));
await t('parent A envoie un souvenir (expiré)', setDoc(doc(pa, `families/${F}/memories/m5`), { createdBy: 'pa', pub: false, sentAt: now - H48 - 60000, createdAt: now - H48 - 60000 }));
await t('parent B ne valide plus après 48 h', updateDoc(doc(pb, `families/${F}/memories/m5`), { pub: true }), false);
await t('parent A renvoie la demande', updateDoc(doc(pa, `families/${F}/memories/m5`), { sentAt: now, muted: {} }));
await t('parent B valide après le renvoi', updateDoc(doc(pb, `families/${F}/memories/m5`), { pub: true }));
await t('proche envoie un souvenir (expiré)', setDoc(doc(pr, `families/${F}/memories/m7`), { createdBy: 'pr', pub: false, createdAt: now - H48 - 60000 }));
await t('parent ne valide pas un souvenir expiré', updateDoc(doc(pa, `families/${F}/memories/m7`), { pub: true }), false);
await t('proche renvoie son souvenir', updateDoc(doc(pr, `families/${F}/memories/m7`), { sentAt: now, muted: {} }));
await t('parent valide le souvenir renvoyé', updateDoc(doc(pa, `families/${F}/memories/m7`), { pub: true }));
await t('parent B envoie un document à valider', setDoc(doc(pb, `families/${F}/docs/d2`), { title: 'Ordonnance', createdBy: 'pb', pub: false, sentAt: now, createdAt: now }));
await t('parent B ne valide pas son document', updateDoc(doc(pb, `families/${F}/docs/d2`), { pub: true }), false);
await t('parent A valide le document', updateDoc(doc(pa, `families/${F}/docs/d2`), { pub: true }));
// Événements : créés par les parents, modifiés ou supprimés par le seul parent créateur ; absences et matchs par les deux parents
await t('parent A crée un événement', setDoc(doc(pa, `families/${F}/events/ev1`), { createdBy: 'pa', title: 'Foot', kind: 'dow', dows: [1, 3] }));
await t('parent B ne modifie pas l\'événement de A', updateDoc(doc(pb, `families/${F}/events/ev1`), { title: 'Foot 2' }), false);
await t('parent B ne supprime pas une séance de A', updateDoc(doc(pb, `families/${F}/events/ev1`), { exceptions: ['2026-11-12'] }), false);
await t('parent B ne supprime pas l\'événement de A', deleteDoc(doc(pb, `families/${F}/events/ev1`)), false);
await t('parent A supprime une séance', updateDoc(doc(pa, `families/${F}/events/ev1`), { exceptions: ['2026-11-12'] }));
await t('proche ne modifie pas un événement', updateDoc(doc(pr, `families/${F}/events/ev1`), { title: 'x' }), false);
await t('parent B note une absence', setDoc(doc(pb, `families/${F}/evx/ev1_2026-11-17`), { evId: 'ev1', date: '2026-11-17', type: 'absent', cause: 'malade', by: 'pb' }));
await t('parent A note un match', setDoc(doc(pa, `families/${F}/evx/ev1_2026-11-19`), { evId: 'ev1', date: '2026-11-19', type: 'match', time: '10:00', place: 'Stade', by: 'pa' }));
await t('proche lit les absences', getDocs(collection(pr, `families/${F}/evx`)));
await t('proche ne note pas d\'absence', setDoc(doc(pr, `families/${F}/evx/ev1_2026-11-24`), { evId: 'ev1', date: '2026-11-24', type: 'absent' }), false);
await t('parent B rétablit la séance', deleteDoc(doc(pb, `families/${F}/evx/ev1_2026-11-17`)));
await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), `families/${F}/events/old`), { createdBy: 'pr', title: 'Ancien' }));
await t('parent B gère un ancien événement de proche', updateDoc(doc(pb, `families/${F}/events/old`), { title: 'Ancien 2' }));
await t('parent A supprime son événement', deleteDoc(doc(pa, `families/${F}/events/ev1`)));
// Réservés aux parents (accompagnement de sortie scolaire)
await t('parent A crée un événement parents seulement', setDoc(doc(pa, `families/${F}/pevents/pe1`), { createdBy: 'pa', title: 'Sortie scolaire' }));
await t('parent B le lit', getDoc(doc(pb, `families/${F}/pevents/pe1`)));
await t('proche ne le lit pas', getDoc(doc(pr, `families/${F}/pevents/pe1`)), false);
await t('proche ne liste pas les événements parents', getDocs(collection(pr, `families/${F}/pevents`)), false);
await t('parent B ne le modifie pas', updateDoc(doc(pb, `families/${F}/pevents/pe1`), { title: 'x' }), false);
await t('proche ne crée pas d\'événement parents', setDoc(doc(pr, `families/${F}/pevents/pe2`), { createdBy: 'pr', title: 'x' }), false);
// Proches : retirés par le parent qui les a ajoutés ; sinon, demande validée par l'autre parent
await env.withSecurityRulesDisabled(async ctx => {
  const d = ctx.firestore();
  await setDoc(doc(d, `families/${F}/members/pq`), { uid: 'pq', role: 'proche', parentCode: null });
  await setDoc(doc(d, `families/${F}/members/ps`), { uid: 'ps', role: 'proche', parentCode: null });
});
await t('parent note qui a ajouté le proche', updateDoc(doc(pa, `families/${F}/members/pq`), { addedBy: 'pa' }));
await t('« ajouté par » noté une seule fois', updateDoc(doc(pb, `families/${F}/members/pq`), { addedBy: 'pb' }), false);
await t('parent B ne retire pas seul un proche ajouté par A', deleteDoc(doc(pb, `families/${F}/members/pq`)), false);
await t('parent B demande la suppression', updateDoc(doc(pb, `families/${F}/members/pq`), { delReq: { by: 'pb', at: now } }));
await t('parent B ne valide pas sa propre demande', deleteDoc(doc(pb, `families/${F}/members/pq`)), false);
await t('demande au nom de l\'autre parent refusée', updateDoc(doc(pa, `families/${F}/members/ps`), { delReq: { by: 'pb' } }), false);
await t('parent A valide : le proche est retiré', deleteDoc(doc(pa, `families/${F}/members/pq`)));
await t('parent A note qu\'il a ajouté un proche', updateDoc(doc(pa, `families/${F}/members/ps`), { addedBy: 'pa' }));
await t('parent A retire seul un proche qu\'il a ajouté', deleteDoc(doc(pa, `families/${F}/members/ps`)));
await t('proche ne touche pas aux demandes de suppression', updateDoc(doc(pr, `families/${F}/members/pr`), { delReq: null }), false);
// Modification d'un événement proposée par l'autre parent
await t('parent B propose une modification', setDoc(doc(pb, `families/${F}/evprop/p1`), { createdBy: 'pb', evId: 'ev1', mode: 'all' }));
await t('proposition au nom de l\'autre parent refusée', setDoc(doc(pb, `families/${F}/evprop/p2`), { createdBy: 'pa', evId: 'ev1' }), false);
await t('proche ne voit pas les propositions', getDocs(collection(pr, `families/${F}/evprop`)), false);
await t('parent A lit les propositions', getDocs(collection(pa, `families/${F}/evprop`)));
await t('proposition non modifiable', updateDoc(doc(pb, `families/${F}/evprop/p1`), { mode: 'del-all' }), false);
await t('parent A traite la proposition', deleteDoc(doc(pa, `families/${F}/evprop/p1`)));
await t('parent programme un rappel de validation', setDoc(doc(pa, `families/${F}/reminders/ap_g4_1`), { kind: 'ap', grp: 'g4', sent: now, exp: now + H48, targets: { pb: 'sjf-x' } }));
await t('parent liste les rappels de validation', getDocs(query(collection(pb, `families/${F}/reminders`), where('kind', '==', 'ap'))));
await t('proche ne lit pas les rappels', getDocs(query(collection(pr, `families/${F}/reminders`), where('kind', '==', 'ap'))), false);
await env.cleanup();
console.log(`\n${n - fails}/${n} tests réussis`); console.log(`::notice title=Règles::${n - fails}/${n} tests réussis`);
process.exit(fails ? 1 : 0);
