// ═══════════════════════════════════════════════════════════════
//  SJ Family — accès aux données
//  • mode "firebase" : Firebase Auth + Firestore (SDK officiel via CDN)
//  • mode "demo"     : base locale simulée (tests / démonstration, ?demo=1)
// ═══════════════════════════════════════════════════════════════
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDlyQZ-O5Xuko-jtIvhJSzlncg1eL9Icdg',
  authDomain: 'sj-family-dd337.firebaseapp.com',
  projectId: 'sj-family-dd337',
  storageBucket: 'sj-family-dd337.firebasestorage.app',
  messagingSenderId: '738819968953',
  appId: '1:738819968953:web:0f33908b97092bee20b068',
};
const SDK = 'https://www.gstatic.com/firebasejs/10.12.0';

export function randomId(n = 20) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const b = new Uint8Array(n); crypto.getRandomValues(b);
  let s = ''; for (const x of b) s += a[x % a.length]; return s;
}

export async function createBackend(mode) {
  return mode === 'demo' ? createMock() : createFirebase();
}

// ─────────────────────────── Firebase ───────────────────────────
async function createFirebase() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app);
  try { auth.languageCode = 'fr'; } catch (e) { /* */ }
  let fs;
  try { fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { fs = F.getFirestore(app); }
  const snap2obj = d => (d.exists() ? { id: d.id, ...d.data() } : null);
  const buildQuery = (path, o) => {
    o = o || {}; const c = [];
    for (const w of o.where || []) c.push(F.where(w[0], w[1], w[2]));
    if (o.orderBy) c.push(F.orderBy(o.orderBy[0], o.orderBy[1] || 'asc'));
    if (o.limit) c.push(F.limit(o.limit));
    return F.query(F.collection(fs, path), ...c);
  };
  return {
    mode: 'firebase',
    auth: {
      onChange: cb => A.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: (u.email || '').toLowerCase(), emailVerified: !!u.emailVerified } : null)),
      signIn: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
      signUp: async (e, p) => { const r = await A.createUserWithEmailAndPassword(auth, e, p); return { uid: r.user.uid, email: r.user.email }; },
      signOut: () => A.signOut(auth),
      reset: e => A.sendPasswordResetEmail(auth, e),
      current: () => auth.currentUser ? { uid: auth.currentUser.uid, email: (auth.currentUser.email || '').toLowerCase(), emailVerified: !!auth.currentUser.emailVerified } : null,
      sendVerification: () => A.sendEmailVerification(auth.currentUser),
      refresh: async () => { const u = auth.currentUser; if (!u) return null; await u.reload(); await u.getIdToken(true); return { uid: u.uid, email: (u.email || '').toLowerCase(), emailVerified: !!auth.currentUser.emailVerified }; },
    },
    db: {
      newId: () => F.doc(F.collection(fs, '_')).id,
      get: async path => snap2obj(await F.getDoc(F.doc(fs, path))),
      list: async (path, o) => (await F.getDocs(buildQuery(path, o))).docs.map(d => ({ id: d.id, ...d.data() })),
      set: (path, data, merge = false) => F.setDoc(F.doc(fs, path), clean(data), { merge }),
      update: (path, data) => F.updateDoc(F.doc(fs, path), clean(data)),
      del: path => F.deleteDoc(F.doc(fs, path)),
      listenDoc: (path, cb, err) => F.onSnapshot(F.doc(fs, path), d => cb(snap2obj(d)), e => (err || console.warn)(e)),
      listenCol: (path, cb, o, err) => F.onSnapshot(buildQuery(path, o), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => (err || console.warn)(e)),
      createIfAbsent: (path, data) => F.runTransaction(fs, async tx => {
        const ref = F.doc(fs, path); const s = await tx.get(ref);
        if (s.exists()) return false; tx.set(ref, clean(data)); return true;
      }),
      arrayUnion: (...v) => F.arrayUnion(...v),
      arrayRemove: (...v) => F.arrayRemove(...v),
      deleteField: () => F.deleteField(),
      increment: n => F.increment(n),
    },
  };
}
// Firestore refuse les valeurs undefined
function clean(o) {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object' && o.constructor === Object) {
    const r = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined) r[k] = clean(v); return r;
  }
  return o;
}

// ─────────────────────────── Démo (local) ───────────────────────────
function createMock() {
  const KEY = 'sjf-demo-db-v2';
  let store; try { store = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { store = null; }
  if (!store) store = { docs: {}, users: {}, session: null };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* quota */ } };
  const docL = new Map(), colL = new Map(), authL = new Set();
  const parentOf = p => p.split('/').slice(0, -1).join('/');
  const notify = path => queueMicrotask(() => {
    for (const cb of docL.get(path) || []) cb(store.docs[path] ? { id: path.split('/').pop(), ...structuredClone(store.docs[path]) } : null);
    const col = parentOf(path);
    for (const l of colL.get(col) || []) l.fire();
  });
  const colDocs = (path, o) => {
    o = o || {}; const depth = path.split('/').length + 1;
    let rows = Object.keys(store.docs).filter(k => k.startsWith(path + '/') && k.split('/').length === depth)
      .map(k => ({ id: k.split('/').pop(), ...structuredClone(store.docs[k]) }));
    for (const [f, op, v] of o.where || []) rows = rows.filter(r => op === '==' ? r[f] === v : op === 'array-contains' ? (r[f] || []).includes(v) : true);
    if (o.orderBy) { const [f, dir] = o.orderBy; rows.sort((a, b) => (a[f] > b[f] ? 1 : a[f] < b[f] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
    if (o.limit) rows = rows.slice(0, o.limit);
    return rows;
  };
  const AU = Symbol('au'), AR = Symbol('ar'), DF = Symbol('df'), INC = Symbol('inc');
  const applyVal = (cur, v) => {
    if (v && v[INC] !== undefined) return (+cur || 0) + v[INC];
    if (v && v[AU]) return [...new Set([...(cur || []), ...v[AU]])];
    if (v && v[AR]) return (cur || []).filter(x => !v[AR].includes(x));
    return v;
  };
  const setDeep = (obj, key, v) => {
    const parts = key.split('.'); let o = obj;
    for (let i = 0; i < parts.length - 1; i++) { if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {}; o = o[parts[i]]; }
    const last = parts[parts.length - 1];
    if (v && v[DF]) delete o[last]; else o[last] = applyVal(o[last], v);
  };
  const plain = v => JSON.parse(JSON.stringify(v, (k, x) => x === undefined ? undefined : x));
  // set(merge=false) remplace ; set(merge=true) fusionne en profondeur ; update : clés pointées = champs imbriqués
  const write = (path, data, mode) => {
    const out = mode === 'replace' || !store.docs[path] ? {} : structuredClone(store.docs[path]);
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (mode === 'update' && k.includes('.')) { setDeep(out, k, v); continue; }
      if (v && (v[AU] || v[AR] || v[DF] || v[INC] !== undefined)) { setDeep(out, k.replace(/\./g, '\u0000'), v); continue; }
      if (mode === 'merge' && v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') out[k] = deepMerge(out[k], plain(v));
      else out[k] = plain(v);
    }
    store.docs[path] = out; save(); notify(path);
  };
  const deepMerge = (a, b) => { const r = { ...a }; for (const [k, v] of Object.entries(b)) r[k] = v && typeof v === 'object' && !Array.isArray(v) && r[k] && typeof r[k] === 'object' ? deepMerge(r[k], v) : v; return r; };
  const authNotify = () => queueMicrotask(() => { for (const cb of authL) cb(cur()); });
  const cur = () => store.session ? { uid: store.users[store.session].uid, email: store.session, emailVerified: true } : null;
  const err = code => { const e = new Error(code); e.code = code; return e; };
  return {
    mode: 'demo',
    auth: {
      onChange: cb => { authL.add(cb); queueMicrotask(() => cb(cur())); return () => authL.delete(cb); },
      signIn: async (e, p) => { e = e.trim().toLowerCase(); const u = store.users[e]; if (!u) throw err('auth/invalid-credential'); if (u.pw !== p) throw err('auth/invalid-credential'); store.session = e; save(); authNotify(); },
      signUp: async (e, p) => {
        e = e.trim().toLowerCase(); if (store.users[e]) throw err('auth/email-already-in-use'); if (p.length < 6) throw err('auth/weak-password');
        store.users[e] = { uid: 'u_' + randomId(10), pw: p }; store.session = e; save(); authNotify(); return cur();
      },
      signOut: async () => { store.session = null; save(); authNotify(); },
      reset: async () => { },
      current: cur,
      sendVerification: async () => { },
      refresh: async () => cur(),
    },
    db: {
      newId: () => randomId(20),
      get: async path => store.docs[path] ? { id: path.split('/').pop(), ...structuredClone(store.docs[path]) } : null,
      list: async (path, o) => colDocs(path, o),
      set: async (path, data, merge = false) => write(path, data, merge ? 'merge' : 'replace'),
      update: async (path, data) => { if (!store.docs[path]) throw err('not-found'); write(path, data, 'update'); },
      del: async path => { delete store.docs[path]; save(); notify(path); },
      listenDoc: (path, cb) => {
        if (!docL.has(path)) docL.set(path, new Set()); docL.get(path).add(cb);
        queueMicrotask(() => cb(store.docs[path] ? { id: path.split('/').pop(), ...structuredClone(store.docs[path]) } : null));
        return () => docL.get(path)?.delete(cb);
      },
      listenCol: (path, cb, o) => {
        if (!colL.has(path)) colL.set(path, new Set());
        const l = { fire: () => cb(colDocs(path, o)) }; colL.get(path).add(l); queueMicrotask(l.fire);
        return () => colL.get(path)?.delete(l);
      },
      createIfAbsent: async (path, data) => { if (store.docs[path]) return false; write(path, data, 'replace'); return true; },
      arrayUnion: (...v) => ({ [AU]: v }),
      arrayRemove: (...v) => ({ [AR]: v }),
      deleteField: () => ({ [DF]: true }),
      increment: n => ({ [INC]: n }),
    },
  };
}
