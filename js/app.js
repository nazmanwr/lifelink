/* Bootstrap: pick a backend, seed demo data if local, wire events, render. */
(function () {
  async function start() {
    let backend = 'local';
    try {
      backend = await BD.backend.ready();
    } catch (err) {
      console.warn('Backend selection failed; using the local store.', err);
    }

    /* Demo accounts belong to the local prototype only — never write them
       into a shared Firestore database. */
    if (backend === 'local') {
      try {
        await BD.seed.run();
      } catch (err) {
        /* Seeding is a convenience; never let it block the app. */
        console.warn('Demo data could not be loaded:', err);
      }
    }

    BD.ui.bindGlobalEvents();
    await BD.ui.render();

    if (backend === 'local' && BD.store.usingMemory()) {
      BD.ui.toast('Browser storage is blocked, so data will not survive a reload.', 'error');
    }
    document.body.classList.remove('is-loading');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
