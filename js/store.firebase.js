/* Firebase adapter — OPT-IN, not loaded by default.
 *
 * This implements exactly the interface js/store.js exposes, so turning the
 * prototype into a real multi-device app is a change to index.html only:
 * no screen, view or matching code is touched.
 *
 * To switch over:
 *   1. Create a free project at https://console.firebase.google.com
 *      Enable Authentication > Email/Password, and Firestore Database.
 *   2. Copy firebase-config.example.js to firebase-config.js and paste your
 *      web app's config object into it.
 *
 * That is the whole procedure. js/backend.js looks for firebase-config.js at
 * startup; finding a real one, it pulls in the SDK and this adapter, and skips
 * the demo seed. With no config file, nothing here is downloaded at all.
 *
 * The compat SDK is used deliberately: it works with classic <script> tags,
 * so the app keeps running from file:// without a build step.
 *
 * NOTE: this adapter is written against the documented compat API but has not
 * been run against a live project here, since no Firebase project exists yet.
 * Expect to verify it once your own project is connected.
 */
(function () {
  if (typeof firebase === 'undefined' || !window.FIREBASE_CONFIG) {
    console.info('Firebase not configured; keeping the local store.');
    return;
  }

  firebase.initializeApp(window.FIREBASE_CONFIG);
  const db = firebase.firestore();
  const fbAuth = firebase.auth();

  function docData(doc) {
    return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
  }

  function collection(name) {
    const ref = db.collection(name);
    return {
      /* Firestore has no arbitrary predicate query, so the same
         function-filter API is honoured client-side. For production scale,
         narrow this with ref.where(...) on city and bloodGroup first. */
      async list(filter) {
        const snap = await ref.get();
        const rows = snap.docs.map(docData);
        return typeof filter === 'function' ? rows.filter(filter) : rows;
      },
      async byId(id) {
        if (!id) return null;
        return docData(await ref.doc(id).get());
      },
      async create(data) {
        const row = Object.assign({}, data, {
          createdAt: data.createdAt || new Date().toISOString()
        });
        if (data.id) {
          await ref.doc(data.id).set(row);
          return Object.assign({ id: data.id }, row);
        }
        const added = await ref.add(row);
        return Object.assign({ id: added.id }, row);
      },
      async update(id, patch) {
        const doc = ref.doc(id);
        const before = await doc.get();
        if (!before.exists) throw new Error('Record not found: ' + id);
        await doc.update(Object.assign({}, patch, { updatedAt: new Date().toISOString() }));
        return docData(await doc.get());
      },
      async remove(id) {
        await ref.doc(id).delete();
      }
    };
  }

  const users = collection('users');
  const requests = collection('requests');
  const responses = collection('responses');

  users.byEmail = async function (email) {
    const wanted = String(email || '').trim().toLowerCase();
    const snap = await db.collection('users').where('email', '==', wanted).limit(1).get();
    return snap.empty ? null : docData(snap.docs[0]);
  };

  /* Resolves once Firebase has restored any persisted session. */
  function authReady() {
    return new Promise(function (resolve) {
      const stop = fbAuth.onAuthStateChanged(function (user) {
        stop();
        resolve(user);
      });
    });
  }

  const auth = {
    async signUp(input) {
      const email = String(input.email || '').trim().toLowerCase();
      const cred = await fbAuth.createUserWithEmailAndPassword(email, input.password);
      /* The profile document id matches the auth uid, so security rules can
         say: a user may only write their own profile. */
      return users.create({
        id: cred.user.uid,
        name: String(input.name || '').trim(),
        email: email,
        phone: String(input.phone || '').trim(),
        role: input.role,
        bloodGroup: input.bloodGroup,
        city: String(input.city || '').trim(),
        area: String(input.area || '').trim(),
        location: input.location || null,
        available: input.role === 'donor',
        lastDonation: input.lastDonation || '',
        donationCount: 0
      });
    },

    async logIn(email, password) {
      const cred = await fbAuth.signInWithEmailAndPassword(
        String(email || '').trim().toLowerCase(), password);
      const profile = await users.byId(cred.user.uid);
      if (!profile) throw new Error('That account has no profile yet.');
      return profile;
    },

    async currentUser() {
      const account = fbAuth.currentUser || await authReady();
      if (!account) return null;
      return users.byId(account.uid);
    },

    async logOut() {
      await fbAuth.signOut();
    }
  };

  /* Mutate BD.store in place rather than replacing the object. views.js and
     seed.js capture `BD.store` when they load, which is before this adapter
     runs — reassigning the reference would leave every screen still talking
     to localStorage. */
  Object.assign(BD.store, {
    backend: 'firebase',
    users: users,
    requests: requests,
    responses: responses,
    auth: auth,
    session: {
      async set() { /* handled by Firebase Auth persistence */ },
      async clear() { await fbAuth.signOut(); }
    },
    reset: async function () { throw new Error('Clear data from the Firebase console, not the app.'); },
    isSeeded: function () { return true; },
    markSeeded: function () {},
    hashPassword: async function () { throw new Error('Firebase Auth handles passwords.'); },
    randomSalt: function () { return ''; },
    usingMemory: function () { return false; }
  });

  console.info('LifeLink is using the Firebase store.');
})();
