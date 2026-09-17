/* Chooses the storage backend at startup.
 *
 * If firebase-config.js exists and defines window.FIREBASE_CONFIG, the
 * Firebase SDK and js/store.firebase.js are pulled in and the app runs
 * against Firestore, shared across devices. If it does not exist — the
 * default — nothing is downloaded and the local store is used.
 *
 * Nothing else in the app knows which backend it got.
 */
window.BD = window.BD || {};

BD.backend = (function () {
  const SDK_VERSION = '10.12.2';
  const SDK = [
    'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-firestore-compat.js'
  ];

  /* Resolves true if the script loaded, false if it could not be fetched.
     A missing firebase-config.js is the normal case, not an error. */
  function loadScript(src) {
    return new Promise(function (resolve) {
      const el = document.createElement('script');
      el.src = src;
      el.async = false;
      el.onload = function () { resolve(true); };
      el.onerror = function () { resolve(false); };
      document.head.appendChild(el);
    });
  }

  async function ready() {
    await loadScript('firebase-config.js');
    if (!window.FIREBASE_CONFIG || /YOUR_API_KEY/.test(window.FIREBASE_CONFIG.apiKey || '')) {
      return 'local';
    }

    for (const src of SDK) {
      if (!await loadScript(src)) {
        console.warn('Firebase SDK could not be loaded (offline?); using the local store.');
        return 'local';
      }
    }

    if (!await loadScript('js/store.firebase.js')) return 'local';
    return BD.store.backend === 'firebase' ? 'firebase' : 'local';
  }

  return { ready: ready };
})();
