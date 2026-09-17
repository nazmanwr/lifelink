/* Bootstrap: seed demo data on first run, wire events, render the route. */
(function () {
  async function start() {
    try {
      await BD.seed.run();
    } catch (err) {
      /* Seeding is a convenience; never let it block the app. */
      console.warn('Demo data could not be loaded:', err);
    }

    BD.ui.bindGlobalEvents();
    await BD.ui.render();

    if (BD.store.usingMemory()) {
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
