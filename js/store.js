/* Data layer.
 *
 * Everything above this file talks to BD.store only, and every method is
 * async. That is deliberate: swapping the local adapter for Firestore later
 * means implementing the same methods, not touching any screen.
 * See js/store.firebase.js and README.md.
 */
window.BD = window.BD || {};

BD.store = (function () {
  const KEYS = {
    users: 'bd.users',
    requests: 'bd.requests',
    responses: 'bd.responses',
    session: 'bd.session',
    seeded: 'bd.seeded'
  };

  /* localStorage is unavailable in some privacy modes; fall back to memory
     so the app still runs (data just does not survive a reload). */
  const memory = {};
  let usingMemory = false;

  function readRaw(key) {
    if (usingMemory) return memory[key] || null;
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      usingMemory = true;
      return memory[key] || null;
    }
  }

  function writeRaw(key, value) {
    if (!usingMemory) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        usingMemory = true;
      }
    }
    memory[key] = value;
  }

  function readAll(key) {
    const raw = readRaw(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeAll(key, rows) {
    writeRaw(key, JSON.stringify(rows));
  }

  function uid(prefix) {
    const rand = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
    return prefix + '_' + Date.now().toString(36) + rand;
  }

  function clone(o) {
    return (o === null || o === undefined) ? o : JSON.parse(JSON.stringify(o));
  }

  /* ---- password hashing -------------------------------------------------
     PBKDF2 where the browser exposes WebCrypto. The fallback is NOT secure;
     it exists only so the prototype keeps working without a secure context.
     Real deployments move auth to Firebase Auth and never store hashes here. */

  function randomSalt() {
    if (window.crypto && crypto.getRandomValues) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  const HASH_TIMEOUT_MS = 5000;

  async function pbkdf2(password, salt) {
    const subtle = window.crypto.subtle;
    const enc = new TextEncoder();
    const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      key,
      256
    );
    return 'pbkdf2$' + Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function weakHash(password, salt) {
    let h = 2166136261;
    const input = salt + '|' + password;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return 'weak$' + (h >>> 0).toString(16);
  }

  function timeLimited(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error(label)); }, ms);
      })
    ]);
  }

  /* A stored hash names the algorithm that produced it, and verification
     re-runs that same one. Without this, an account created while WebCrypto
     was unavailable could never be logged into again once it came back. */
  function algorithmOf(hash) {
    return String(hash || '').split('$')[0] === 'pbkdf2' ? 'pbkdf2' : 'weak';
  }

  async function hashPassword(password, salt, algorithm) {
    const subtle = window.crypto && window.crypto.subtle;
    if (algorithm === 'weak') return weakHash(password, salt);

    if (algorithm === 'pbkdf2') {
      if (!subtle) throw new Error('This browser cannot verify that password. Try a different browser.');
      return timeLimited(pbkdf2(password, salt), HASH_TIMEOUT_MS,
        'Password check timed out in this browser.');
    }

    /* No algorithm named: this is a new password, so prefer PBKDF2 but never
       hang on it. Some environments expose crypto.subtle without it working. */
    if (!subtle) return weakHash(password, salt);
    try {
      return await timeLimited(pbkdf2(password, salt), HASH_TIMEOUT_MS, 'timeout');
    } catch (e) {
      console.warn('WebCrypto unavailable, falling back to a weak hash:', e.message);
      return weakHash(password, salt);
    }
  }

  /* ---- generic collection helpers -------------------------------------- */

  function collection(key, prefix) {
    return {
      async list(filter) {
        let rows = readAll(key);
        if (typeof filter === 'function') rows = rows.filter(filter);
        return clone(rows);
      },
      async byId(id) {
        const row = readAll(key).find((r) => r.id === id);
        return row ? clone(row) : null;
      },
      async create(data) {
        const rows = readAll(key);
        const row = Object.assign({}, data, {
          id: data.id || uid(prefix),
          createdAt: data.createdAt || new Date().toISOString()
        });
        rows.push(row);
        writeAll(key, rows);
        return clone(row);
      },
      async update(id, patch) {
        const rows = readAll(key);
        const i = rows.findIndex((r) => r.id === id);
        if (i === -1) throw new Error('Record not found: ' + id);
        rows[i] = Object.assign({}, rows[i], patch, { updatedAt: new Date().toISOString() });
        writeAll(key, rows);
        return clone(rows[i]);
      },
      async remove(id) {
        writeAll(key, readAll(key).filter((r) => r.id !== id));
      }
    };
  }

  const users = collection(KEYS.users, 'usr');
  const requests = collection(KEYS.requests, 'req');
  const responses = collection(KEYS.responses, 'res');

  users.byEmail = async function (email) {
    const wanted = String(email || '').trim().toLowerCase();
    const row = readAll(KEYS.users).find((u) => u.email === wanted);
    return row ? clone(row) : null;
  };

  const session = {
    async set(userId) { writeRaw(KEYS.session, userId); },
    async clear() {
      if (usingMemory) { delete memory[KEYS.session]; return; }
      try { window.localStorage.removeItem(KEYS.session); }
      catch (e) { delete memory[KEYS.session]; }
    }
  };

  /* ---- auth -------------------------------------------------------------- */

  const auth = {
    async signUp(input) {
      const email = String(input.email || '').trim().toLowerCase();
      if (await users.byEmail(email)) {
        throw new Error('An account with that email already exists. Try logging in.');
      }
      const salt = randomSalt();
      const passwordHash = await hashPassword(input.password, salt);
      const user = await users.create({
        name: String(input.name || '').trim(),
        email: email,
        phone: String(input.phone || '').trim(),
        passwordHash: passwordHash,
        salt: salt,
        role: input.role,
        bloodGroup: input.bloodGroup,
        city: String(input.city || '').trim(),
        area: String(input.area || '').trim(),
        location: input.location || null,
        available: input.role === 'donor',
        lastDonation: input.lastDonation || '',
        donationCount: 0
      });
      await session.set(user.id);
      return user;
    },

    async logIn(email, password) {
      const user = await users.byEmail(email);
      if (!user) throw new Error('No account found for that email.');
      const attempt = await hashPassword(password, user.salt, algorithmOf(user.passwordHash));
      if (attempt !== user.passwordHash) throw new Error('That password does not match.');
      await session.set(user.id);
      return user;
    },

    async currentUser() {
      const id = readRaw(KEYS.session);
      if (!id) return null;
      const user = await users.byId(id);
      if (!user) {
        await session.clear();
        return null;
      }
      return user;
    },

    async logOut() {
      await session.clear();
    }
  };

  /* ---- maintenance ------------------------------------------------------- */

  async function reset() {
    Object.keys(KEYS).forEach((k) => {
      if (usingMemory) { delete memory[KEYS[k]]; return; }
      try { window.localStorage.removeItem(KEYS[k]); }
      catch (e) { delete memory[KEYS[k]]; }
    });
  }

  function isSeeded() { return readRaw(KEYS.seeded) === '1'; }
  function markSeeded() { writeRaw(KEYS.seeded, '1'); }

  return {
    users: users,
    requests: requests,
    responses: responses,
    auth: auth,
    session: session,
    reset: reset,
    isSeeded: isSeeded,
    markSeeded: markSeeded,
    hashPassword: hashPassword,
    randomSalt: randomSalt,
    usingMemory: function () { return usingMemory; }
  };
})();
