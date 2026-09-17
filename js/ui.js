/* UI shell: helpers, header, toasts, and the hash router. */
window.BD = window.BD || {};

BD.ui = (function () {
  /* ---- formatting helpers ------------------------------------------------ */

  /* Every value that came from a user goes through this before hitting HTML. */
  function h(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attr(value) { return h(value); }

  function fmtDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtWhen(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const mins = Math.round((Date.now() - d) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' h ago';
    const days = Math.round(hrs / 24);
    if (days < 30) return days + ' d ago';
    return fmtDate(value);
  }

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); })
      .join('');
  }

  function urgencyLabel(u) {
    if (u === 'critical') return 'Critical';
    if (u === 'urgent') return 'Urgent';
    return 'Routine';
  }

  function deadlineLabel(daysLeft) {
    if (daysLeft === null || daysLeft === undefined) return 'No deadline set';
    if (daysLeft < 0) return 'Deadline passed';
    if (daysLeft === 0) return 'Needed today';
    if (daysLeft === 1) return 'Needed tomorrow';
    return 'Needed in ' + daysLeft + ' days';
  }

  /* ---- toasts ------------------------------------------------------------ */

  function toast(message, kind) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const node = document.createElement('div');
    node.className = 'toast toast--' + (kind || 'info');
    node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    node.textContent = message;
    host.appendChild(node);
    setTimeout(function () { node.classList.add('toast--out'); }, 3600);
    setTimeout(function () { node.remove(); }, 4100);
  }

  /* ---- shell ------------------------------------------------------------- */

  function renderHeader(user) {
    const nav = document.getElementById('nav');
    const header = document.getElementById('app-header');
    if (!user) {
      header.classList.add('is-signed-out');
      nav.innerHTML = '';
      return;
    }
    header.classList.remove('is-signed-out');
    const route = currentRoute().name;
    const items = user.role === 'donor'
      ? [['#/home', 'Requests'], ['#/history', 'My offers'], ['#/profile', 'Profile']]
      : [['#/home', 'My requests'], ['#/new-request', 'New request'], ['#/profile', 'Profile']];

    nav.innerHTML = items.map(function (item) {
      const active = ('#/' + route) === item[0] ? ' is-active' : '';
      return '<a class="nav__link' + active + '" href="' + attr(item[0]) + '">' + h(item[1]) + '</a>';
    }).join('') +
      '<button class="nav__avatar" data-action="go-profile" title="' + attr(user.name) + '">' +
      h(initials(user.name)) + '</button>';
  }

  /* ---- router ------------------------------------------------------------ */

  function currentRoute() {
    const raw = (location.hash || '#/').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    return { name: parts[0] || '', param: parts[1] || null };
  }

  function go(path) {
    if (location.hash === path) render();
    else location.hash = path;
  }

  function setMain(html) {
    const main = document.getElementById('main');
    main.innerHTML = html;
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  const PUBLIC_ROUTES = ['', 'welcome', 'login', 'signup'];

  async function render() {
    const user = await BD.store.auth.currentUser();
    const route = currentRoute();
    renderHeader(user);

    if (!user && PUBLIC_ROUTES.indexOf(route.name) === -1) {
      go('#/welcome');
      return;
    }
    if (user && PUBLIC_ROUTES.indexOf(route.name) !== -1 && route.name !== '') {
      go('#/home');
      return;
    }

    try {
      await dispatch(user, route);
    } catch (err) {
      console.error(err);
      toast(err.message || 'That screen could not be loaded.', 'error');
    }
  }

  async function dispatch(user, route) {
    const views = BD.views;
    switch (route.name) {
      case '':
      case 'welcome':    return user ? go('#/home') : views.welcome();
      case 'login':      return views.login();
      case 'signup':     return views.signup();
      case 'home':       return views.home(user);
      case 'new-request':return views.newRequest(user);
      case 'request':    return views.request(user, route.param);
      case 'donors':     return views.donors(user, route.param);
      case 'history':    return views.history(user);
      case 'profile':    return views.profile(user);
      default:           return views.notFound();
    }
  }

  /* Delegated clicks: views declare data-action, handlers live in BD.views.actions. */
  function bindGlobalEvents() {
    document.addEventListener('click', function (ev) {
      const target = ev.target.closest('[data-action]');
      if (!target) return;
      const name = target.getAttribute('data-action');
      const handler = BD.views.actions[name];
      if (!handler) return;
      /* Checkboxes keep their default so the handler can read .checked. */
      const isToggle = target.tagName === 'INPUT' &&
        (target.type === 'checkbox' || target.type === 'radio');
      if (!isToggle) ev.preventDefault();
      Promise.resolve(handler(target, ev)).catch(function (err) {
        toast(err.message || 'Something went wrong.', 'error');
      });
    });

    document.addEventListener('submit', function (ev) {
      const form = ev.target.closest('form[data-submit]');
      if (!form) return;
      ev.preventDefault();
      const handler = BD.views.actions[form.getAttribute('data-submit')];
      if (!handler) return;
      const button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.dataset.label = button.textContent; button.textContent = 'Working…'; }
      Promise.resolve(handler(form, ev))
        .catch(function (err) { toast(err.message || 'Something went wrong.', 'error'); })
        .finally(function () {
          if (button && document.body.contains(button)) {
            button.disabled = false;
            button.textContent = button.dataset.label || 'Save';
          }
        });
    });

    window.addEventListener('hashchange', function () { render(); });
  }

  return {
    h: h,
    attr: attr,
    fmtDate: fmtDate,
    fmtWhen: fmtWhen,
    initials: initials,
    urgencyLabel: urgencyLabel,
    deadlineLabel: deadlineLabel,
    toast: toast,
    go: go,
    setMain: setMain,
    render: render,
    currentRoute: currentRoute,
    bindGlobalEvents: bindGlobalEvents
  };
})();
