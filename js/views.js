/* Screens and their actions. Views render HTML strings into #main;
   interactive elements declare data-action / data-submit and are handled
   by the delegated listeners in ui.js. */
window.BD = window.BD || {};

BD.views = (function () {
  const store = BD.store;
  const ui = BD.ui;
  const blood = BD.blood;
  const geo = BD.geo;
  const match = BD.match;
  const h = ui.h;
  const attr = ui.attr;

  /* Location captured by a form before it is submitted. */
  let pendingLocation = null;

  const ACTIVE_RESPONSE = ['invited', 'offered', 'accepted', 'completed'];

  /* ---- small components -------------------------------------------------- */

  function groupBadge(group) {
    return '<span class="blood-badge">' + h(group) + '</span>';
  }

  function urgencyPill(urgency) {
    return '<span class="pill pill--' + attr(urgency || 'routine') + '">' +
      h(ui.urgencyLabel(urgency)) + '</span>';
  }

  function emptyState(title, body, cta) {
    return '<div class="empty">' +
      '<div class="empty__mark" aria-hidden="true">◎</div>' +
      '<h3>' + h(title) + '</h3><p>' + h(body) + '</p>' +
      (cta || '') + '</div>';
  }

  function pageTitle(title, subtitle) {
    return '<header class="page-head"><h1>' + h(title) + '</h1>' +
      (subtitle ? '<p class="page-head__sub">' + h(subtitle) + '</p>' : '') + '</header>';
  }

  function backLink(href, label) {
    return '<a class="back-link" href="' + attr(href) + '">&larr; ' + h(label) + '</a>';
  }

  function locationField(current) {
    const known = geo.hasCoords(current);
    return '<div class="field">' +
      '<label>Location</label>' +
      '<div class="locrow">' +
      '<button type="button" class="btn btn--ghost" data-action="capture-location">Use my current location</button>' +
      '<span class="locrow__status" id="loc-status">' +
      (known ? 'Saved: ' + current.lat.toFixed(4) + ', ' + current.lng.toFixed(4) : 'Not set — matching will fall back to your city') +
      '</span></div>' +
      '<p class="hint">GPS lets the app sort matches by real distance. City matching still works without it.</p>' +
      '</div>';
  }

  /* Demo accounts exist only in the local prototype — seeding is skipped
     against a shared database, so advertising them there sends people to a
     login that cannot work. */
  function demoNote(html) {
    if (store.backend === 'firebase') return '';
    return '<p class="demo-note">' + html + '</p>';
  }

  function groupOptions(selected) {
    return blood.BLOOD_GROUPS.map(function (g) {
      return '<option value="' + attr(g) + '"' + (g === selected ? ' selected' : '') + '>' + h(g) + '</option>';
    }).join('');
  }

  /* ---- data helpers ------------------------------------------------------ */

  async function requestStats(request) {
    const responses = await store.responses.list(function (r) { return r.requestId === request.id; });
    const accepted = responses.filter(function (r) { return r.status === 'accepted' || r.status === 'completed'; });
    const offers = responses.filter(function (r) { return r.status === 'offered'; });
    const invites = responses.filter(function (r) { return r.status === 'invited'; });
    return { responses: responses, accepted: accepted, offers: offers, invites: invites };
  }

  async function responseBetween(requestId, donorId) {
    const rows = await store.responses.list(function (r) {
      return r.requestId === requestId && r.donorId === donorId;
    });
    return rows[0] || null;
  }

  /* Contact details stay hidden until the two sides are actually connected. */
  function donorContactVisible(response) {
    return !!response && ['offered', 'accepted', 'completed'].indexOf(response.status) !== -1;
  }

  function receiverContactVisible(response) {
    return !!response && ACTIVE_RESPONSE.indexOf(response.status) !== -1;
  }

  /* Close a request once enough donors are locked in. */
  async function refreshFulfilment(request) {
    const stats = await requestStats(request);
    const needed = Number(request.units) || 1;
    if (stats.accepted.length >= needed && request.status === 'open') {
      await store.requests.update(request.id, { status: 'fulfilled' });
      return true;
    }
    if (stats.accepted.length < needed && request.status === 'fulfilled') {
      await store.requests.update(request.id, { status: 'open' });
    }
    return false;
  }

  /* ---- public screens ---------------------------------------------------- */

  function welcome() {
    ui.setMain(
      '<section class="hero">' +
      '<div class="hero__mark" aria-hidden="true">🩸</div>' +
      '<h1>Give blood. Find blood.<br>Close to home.</h1>' +
      '<p class="hero__sub">RoktoDaan connects people who need blood with compatible donors nearby — ' +
      'matched by blood group, sorted by how far away they actually are.</p>' +
      '<div class="hero__actions">' +
      '<a class="btn btn--primary btn--lg" href="#/signup/donor">I want to donate</a>' +
      '<a class="btn btn--outline btn--lg" href="#/signup/receiver">I need blood</a>' +
      '</div>' +
      '<p class="hero__login">Already registered? <a href="#/login">Log in</a></p>' +
      '</section>' +
      '<section class="how">' +
      '<div class="how__card"><span class="how__step">1</span><h3>Sign up</h3>' +
      '<p>Donors register a blood group and location. Receivers post what the patient needs.</p></div>' +
      '<div class="how__card"><span class="how__step">2</span><h3>Get matched</h3>' +
      '<p>We filter by real red-cell compatibility, then rank by GPS distance and donation eligibility.</p></div>' +
      '<div class="how__card"><span class="how__step">3</span><h3>Connect</h3>' +
      '<p>Phone numbers are shared only once a donor offers or a receiver invites — never browsed openly.</p></div>' +
      '</section>' +
      demoNote('Demo accounts are preloaded. Log in with <strong>rafiq@demo.app</strong> (donor) ' +
        'or <strong>kamal@demo.app</strong> (receiver), password <strong>demo1234</strong>.')
    );
  }

  function login() {
    ui.setMain(
      '<section class="auth">' +
      backLink('#/welcome', 'Back') +
      pageTitle('Welcome back', 'Log in to see your matches.') +
      '<form class="card form" data-submit="login">' +
      '<div class="field"><label for="email">Email</label>' +
      '<input id="email" name="email" type="email" autocomplete="username" required placeholder="you@example.com"></div>' +
      '<div class="field"><label for="password">Password</label>' +
      '<input id="password" name="password" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn btn--primary btn--block" type="submit">Log in</button>' +
      '</form>' +
      '<p class="auth__alt">New here? <a href="#/signup/donor">Create an account</a></p>' +
      demoNote('Try <strong>rafiq@demo.app</strong> / <strong>demo1234</strong>.') +
      '</section>'
    );
  }

  function signup() {
    const role = ui.currentRoute().param === 'receiver' ? 'receiver' : 'donor';
    const isDonor = role === 'donor';
    pendingLocation = null;

    ui.setMain(
      '<section class="auth">' +
      backLink('#/welcome', 'Back') +
      pageTitle(isDonor ? 'Register as a donor' : 'Register to request blood',
        isDonor
          ? 'You will see nearby requests your blood group can serve.'
          : 'You will be matched with compatible donors near the hospital.') +
      '<div class="roleswitch">' +
      '<a class="roleswitch__opt' + (isDonor ? ' is-on' : '') + '" href="#/signup/donor">Donor</a>' +
      '<a class="roleswitch__opt' + (!isDonor ? ' is-on' : '') + '" href="#/signup/receiver">Receiver</a>' +
      '</div>' +
      '<form class="card form" data-submit="signup">' +
      '<input type="hidden" name="role" value="' + attr(role) + '">' +
      '<div class="field"><label for="name">Full name</label>' +
      '<input id="name" name="name" required placeholder="e.g. Rafiq Hasan"></div>' +
      '<div class="grid2">' +
      '<div class="field"><label for="email">Email</label>' +
      '<input id="email" name="email" type="email" autocomplete="username" required placeholder="you@example.com"></div>' +
      '<div class="field"><label for="phone">Phone</label>' +
      '<input id="phone" name="phone" type="tel" required placeholder="+8801XXXXXXXXX"></div>' +
      '</div>' +
      '<div class="field"><label for="password">Password</label>' +
      '<input id="password" name="password" type="password" autocomplete="new-password" minlength="6" required>' +
      '<p class="hint">At least 6 characters.</p></div>' +
      '<div class="grid2">' +
      '<div class="field"><label for="bloodGroup">' + (isDonor ? 'Your blood group' : 'Blood group usually needed') + '</label>' +
      '<select id="bloodGroup" name="bloodGroup" required>' + groupOptions('O+') + '</select></div>' +
      '<div class="field"><label for="city">City</label>' +
      '<input id="city" name="city" required placeholder="e.g. Dhaka" value="Dhaka"></div>' +
      '</div>' +
      '<div class="field"><label for="area">Area / neighbourhood</label>' +
      '<input id="area" name="area" placeholder="e.g. Dhanmondi"></div>' +
      (isDonor
        ? '<div class="field"><label for="lastDonation">Last donation date <span class="opt">(optional)</span></label>' +
          '<input id="lastDonation" name="lastDonation" type="date" max="' + attr(new Date().toISOString().slice(0, 10)) + '">' +
          '<p class="hint">Used to work out when you are eligible again (' + blood.DONATION_GAP_DAYS + ' days between donations).</p></div>'
        : '') +
      locationField(null) +
      '<label class="check"><input type="checkbox" name="consent" required> ' +
      'I agree that my name, area and blood group may be shown to matched ' +
      (isDonor ? 'receivers' : 'donors') + '. My phone number stays hidden until I connect with someone.</label>' +
      '<button class="btn btn--primary btn--block" type="submit">Create account</button>' +
      '</form></section>'
    );
  }

  function notFound() {
    ui.setMain('<section class="auth">' + pageTitle('Page not found', '') +
      '<a class="btn btn--primary" href="#/home">Go home</a></section>');
  }

  /* ---- home -------------------------------------------------------------- */

  async function home(user) {
    return user.role === 'donor' ? donorHome(user) : receiverHome(user);
  }

  async function donorHome(user) {
    const elig = blood.eligibility(user);
    const openRequests = await store.requests.list(function (r) { return r.status === 'open'; });
    const ranked = match.rankRequestsForDonor(user, openRequests);
    const myResponses = await store.responses.list(function (r) { return r.donorId === user.id; });
    const byRequest = {};
    myResponses.forEach(function (r) { byRequest[r.requestId] = r; });

    const invites = ranked.filter(function (m) {
      const r = byRequest[m.request.id];
      return r && r.status === 'invited';
    });

    const cards = await Promise.all(ranked.map(function (m) {
      return requestCardForDonor(m, byRequest[m.request.id]);
    }));

    ui.setMain(
      pageTitle('Hello, ' + user.name.split(' ')[0], 'Requests your ' + user.bloodGroup + ' blood can serve.') +
      '<section class="card status-card ' + (elig.ok ? 'is-ok' : 'is-wait') + '">' +
      '<div class="status-card__main">' +
      '<div>' + groupBadge(user.bloodGroup) + '</div>' +
      '<div><strong>' + h(elig.label) + '</strong><p class="muted">' + h(elig.detail) + '</p></div>' +
      '</div>' +
      '<label class="switch"><input type="checkbox" data-action="toggle-availability"' +
      (user.available ? ' checked' : '') + '><span>Available to donate</span></label>' +
      '</section>' +
      (invites.length
        ? '<section class="section"><h2 class="section__title">You were invited</h2>' +
          '<p class="section__sub">A receiver reached out to you directly.</p>' +
          invites.map(function (m) { return inviteCard(m, byRequest[m.request.id]); }).join('') +
          '</section>'
        : '') +
      '<section class="section"><h2 class="section__title">Nearby requests</h2>' +
      '<p class="section__sub">' + ranked.length + ' compatible ' +
      (ranked.length === 1 ? 'request' : 'requests') + ', closest first.</p>' +
      (ranked.length
        ? '<div class="list">' + cards.join('') + '</div>'
        : emptyState('No open requests right now',
            'Nothing matches ' + user.bloodGroup + ' in the system yet. You will see requests here as soon as they are posted.')) +
      '</section>'
    );
  }

  async function requestCardForDonor(m, myResponse) {
    const r = m.request;
    const stats = await requestStats(r);
    const state = myResponse ? myResponse.status : null;
    const cta = state === 'offered' || state === 'accepted' || state === 'completed'
      ? '<span class="tag tag--done">' + h(state === 'offered' ? 'Offer sent' : state === 'accepted' ? 'Accepted by receiver' : 'Donated') + '</span>'
      : '<a class="btn btn--primary btn--sm" href="#/request/' + attr(r.id) + '">I can donate</a>';

    return '<article class="card reqcard">' +
      '<div class="reqcard__top">' + groupBadge(r.bloodGroup) +
      '<div class="reqcard__head"><h3><a href="#/request/' + attr(r.id) + '">' + h(r.hospital) + '</a></h3>' +
      '<p class="muted">' + h(r.area || r.city) + ' · ' + h(m.proximityLabel) + '</p></div>' +
      urgencyPill(r.urgency) + '</div>' +
      '<p class="reqcard__need">' + h(r.units) + ' ' + (Number(r.units) === 1 ? 'unit' : 'units') +
      ' needed · ' + h(stats.accepted.length) + ' confirmed · ' + h(ui.deadlineLabel(m.daysLeft)) + '</p>' +
      (r.notes ? '<p class="reqcard__notes">' + h(r.notes) + '</p>' : '') +
      '<div class="reqcard__foot"><span class="muted">Posted ' + h(ui.fmtWhen(r.createdAt)) + '</span>' + cta + '</div>' +
      '</article>';
  }

  function inviteCard(m, response) {
    const r = m.request;
    return '<article class="card invite">' +
      '<p><strong>' + h(r.hospital) + '</strong> · ' + h(m.proximityLabel) + '</p>' +
      '<p class="muted">Needs ' + h(r.bloodGroup) + ' · ' + h(ui.deadlineLabel(m.daysLeft)) + '</p>' +
      (response.message ? '<p class="quote">' + h(response.message) + '</p>' : '') +
      '<div class="row-actions">' +
      '<button class="btn btn--primary btn--sm" data-action="accept-invite" data-id="' + attr(response.id) + '">Yes, I can help</button>' +
      '<button class="btn btn--ghost btn--sm" data-action="decline-response" data-id="' + attr(response.id) + '">Not now</button>' +
      '</div></article>';
  }

  async function receiverHome(user) {
    const mine = await store.requests.list(function (r) { return r.receiverId === user.id; });
    mine.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

    const cards = await Promise.all(mine.map(async function (r) {
      const stats = await requestStats(r);
      const needed = Number(r.units) || 1;
      return '<article class="card reqcard">' +
        '<div class="reqcard__top">' + groupBadge(r.bloodGroup) +
        '<div class="reqcard__head"><h3><a href="#/request/' + attr(r.id) + '">' + h(r.patientName) + '</a></h3>' +
        '<p class="muted">' + h(r.hospital) + '</p></div>' +
        '<span class="tag tag--' + attr(r.status) + '">' + h(r.status) + '</span></div>' +
        '<div class="progress"><div class="progress__bar" style="width:' +
        Math.min(100, Math.round((stats.accepted.length / needed) * 100)) + '%"></div></div>' +
        '<p class="reqcard__need">' + h(stats.accepted.length) + ' of ' + h(needed) + ' units confirmed · ' +
        h(stats.offers.length) + ' pending ' + (stats.offers.length === 1 ? 'offer' : 'offers') + '</p>' +
        '<div class="reqcard__foot"><span class="muted">' + h(ui.fmtWhen(r.createdAt)) + '</span>' +
        '<a class="btn btn--outline btn--sm" href="#/request/' + attr(r.id) + '">Open</a></div>' +
        '</article>';
    }));

    ui.setMain(
      pageTitle('Your requests', 'Track who has offered and reach compatible donors nearby.') +
      '<a class="btn btn--primary btn--block" href="#/new-request">Post a blood request</a>' +
      '<section class="section">' +
      (mine.length
        ? '<div class="list">' + cards.join('') + '</div>'
        : emptyState('No requests yet',
            'Post what the patient needs and we will rank compatible donors by distance.',
            '<a class="btn btn--primary" href="#/new-request">Post a request</a>')) +
      '</section>'
    );
  }

  /* ---- request form ------------------------------------------------------ */

  function newRequest(user) {
    pendingLocation = user.location || null;
    const today = new Date().toISOString().slice(0, 10);
    ui.setMain(
      '<section class="auth">' + backLink('#/home', 'My requests') +
      pageTitle('Post a blood request', 'Donors nearby with a compatible group will see this.') +
      '<form class="card form" data-submit="create-request">' +
      '<div class="field"><label for="patientName">Patient name</label>' +
      '<input id="patientName" name="patientName" required placeholder="e.g. Kamal Uddin (self)"></div>' +
      '<div class="grid2">' +
      '<div class="field"><label for="bloodGroup">Blood group needed</label>' +
      '<select id="bloodGroup" name="bloodGroup" required>' + groupOptions(user.bloodGroup) + '</select>' +
      '<p class="hint" id="compat-hint"></p></div>' +
      '<div class="field"><label for="units">Units needed</label>' +
      '<input id="units" name="units" type="number" min="1" max="10" value="1" required></div>' +
      '</div>' +
      '<div class="field"><label for="hospital">Hospital / donation point</label>' +
      '<input id="hospital" name="hospital" required placeholder="e.g. Dhaka Medical College Hospital"></div>' +
      '<div class="grid2">' +
      '<div class="field"><label for="city">City</label>' +
      '<input id="city" name="city" required value="' + attr(user.city) + '"></div>' +
      '<div class="field"><label for="area">Area</label>' +
      '<input id="area" name="area" value="' + attr(user.area) + '"></div>' +
      '</div>' +
      '<div class="grid2">' +
      '<div class="field"><label for="urgency">Urgency</label>' +
      '<select id="urgency" name="urgency">' +
      '<option value="critical">Critical — within hours</option>' +
      '<option value="urgent" selected>Urgent — within days</option>' +
      '<option value="routine">Routine — planned</option>' +
      '</select></div>' +
      '<div class="field"><label for="neededBy">Needed by</label>' +
      '<input id="neededBy" name="neededBy" type="date" min="' + attr(today) + '" value="' + attr(today) + '" required></div>' +
      '</div>' +
      '<div class="field"><label for="contactPhone">Contact number</label>' +
      '<input id="contactPhone" name="contactPhone" type="tel" required value="' + attr(user.phone) + '">' +
      '<p class="hint">Shared only with donors who offer or who you invite.</p></div>' +
      '<div class="field"><label for="notes">Notes <span class="opt">(optional)</span></label>' +
      '<textarea id="notes" name="notes" rows="3" placeholder="Timing, ward number, anything a donor should know."></textarea></div>' +
      locationField(user.location) +
      '<button class="btn btn--primary btn--block" type="submit">Post request</button>' +
      '</form></section>'
    );
    updateCompatHint();
    const select = document.getElementById('bloodGroup');
    if (select) select.addEventListener('change', updateCompatHint);
  }

  function updateCompatHint() {
    const select = document.getElementById('bloodGroup');
    const hint = document.getElementById('compat-hint');
    if (!select || !hint) return;
    hint.textContent = 'Can receive from: ' + blood.receivesFrom(select.value).join(', ');
  }

  /* ---- request detail ---------------------------------------------------- */

  async function request(user, id) {
    const req = await store.requests.byId(id);
    if (!req) return notFound();
    const owner = req.receiverId === user.id;
    return owner ? requestOwnerView(user, req) : requestDonorView(user, req);
  }

  async function requestOwnerView(user, req) {
    const stats = await requestStats(req);
    const needed = Number(req.units) || 1;

    const rows = await Promise.all(stats.responses
      .filter(function (r) { return r.status !== 'declined'; })
      .map(async function (response) {
        const donor = await store.users.byId(response.donorId);
        if (!donor) return '';
        const km = geo.distanceKm(donor.location, req.location);
        const elig = blood.eligibility(donor);
        const showPhone = donorContactVisible(response);
        return '<article class="card donorrow">' +
          '<div class="donorrow__id"><span class="avatar">' + h(ui.initials(donor.name)) + '</span>' +
          '<div><strong>' + h(donor.name) + '</strong>' +
          '<p class="muted">' + h(donor.area || donor.city) + ' · ' +
          h(km === null ? 'Distance unknown' : geo.formatDistance(km)) + ' · ' + h(elig.label) + '</p></div></div>' +
          groupBadge(donor.bloodGroup) +
          (response.message ? '<p class="quote">' + h(response.message) + '</p>' : '') +
          (showPhone
            ? '<p class="contact">📞 <a href="tel:' + attr(donor.phone) + '">' + h(donor.phone) + '</a>' +
              ' · <a href="mailto:' + attr(donor.email) + '">' + h(donor.email) + '</a></p>'
            : '<p class="muted small">Contact details appear once the donor responds.</p>') +
          '<div class="row-actions">' + ownerResponseActions(response) + '</div>' +
          '</article>';
      }));

    ui.setMain(
      '<section class="detail">' + backLink('#/home', 'My requests') +
      requestSummary(req, stats) +
      '<section class="section"><h2 class="section__title">Donors</h2>' +
      '<p class="section__sub">' + h(stats.accepted.length) + ' of ' + h(needed) + ' units confirmed.</p>' +
      (rows.filter(Boolean).length
        ? '<div class="list">' + rows.join('') + '</div>'
        : emptyState('No responses yet', 'Invite compatible donors nearby to speed this up.')) +
      '<a class="btn btn--outline btn--block" href="#/donors/' + attr(req.id) + '">Find matching donors nearby</a>' +
      '</section>' +
      '<div class="danger-zone">' +
      (req.status === 'cancelled'
        ? '<button class="btn btn--ghost" data-action="reopen-request" data-id="' + attr(req.id) + '">Reopen request</button>'
        : '<button class="btn btn--ghost" data-action="cancel-request" data-id="' + attr(req.id) + '">Close this request</button>') +
      '</div></section>'
    );
  }

  function ownerResponseActions(response) {
    if (response.status === 'offered') {
      return '<button class="btn btn--primary btn--sm" data-action="accept-response" data-id="' + attr(response.id) + '">Accept offer</button>' +
        '<button class="btn btn--ghost btn--sm" data-action="decline-response" data-id="' + attr(response.id) + '">Decline</button>';
    }
    if (response.status === 'accepted') {
      return '<span class="tag tag--done">Accepted</span>' +
        '<button class="btn btn--outline btn--sm" data-action="complete-response" data-id="' + attr(response.id) + '">Mark donated</button>';
    }
    if (response.status === 'completed') return '<span class="tag tag--done">Donated · thank you</span>';
    if (response.status === 'invited') return '<span class="tag">Invited · waiting for reply</span>';
    return '';
  }

  function requestSummary(req, stats) {
    return '<article class="card summary">' +
      '<div class="summary__top">' + groupBadge(req.bloodGroup) +
      '<div><h1>' + h(req.patientName) + '</h1>' +
      '<p class="muted">' + h(req.hospital) + ' · ' + h(req.area || req.city) + '</p></div>' +
      urgencyPill(req.urgency) + '</div>' +
      '<dl class="summary__grid">' +
      '<div><dt>Units</dt><dd>' + h(req.units) + '</dd></div>' +
      '<div><dt>Needed by</dt><dd>' + h(ui.fmtDate(req.neededBy)) + '</dd></div>' +
      '<div><dt>Status</dt><dd class="cap">' + h(req.status) + '</dd></div>' +
      '<div><dt>Confirmed</dt><dd>' + h(stats.accepted.length) + '</dd></div>' +
      '</dl>' +
      (req.notes ? '<p class="summary__notes">' + h(req.notes) + '</p>' : '') +
      '<p class="muted small">Accepts donors with: ' + h(blood.receivesFrom(req.bloodGroup).join(', ')) + '</p>' +
      '</article>';
  }

  async function requestDonorView(user, req) {
    const receiver = await store.users.byId(req.receiverId);
    const mine = await responseBetween(req.id, user.id);
    const compatible = blood.isCompatible(user.bloodGroup, req.bloodGroup);
    const stats = await requestStats(req);
    const km = geo.distanceKm(user.location, req.location);
    const elig = blood.eligibility(user);

    let panel;
    if (!compatible) {
      panel = '<div class="card notice notice--warn">Your blood group (' + h(user.bloodGroup) +
        ') is not compatible with this patient, who needs ' + h(req.bloodGroup) + '.</div>';
    } else if (mine && mine.status !== 'declined' && mine.status !== 'invited') {
      panel = '<div class="card notice notice--ok"><strong>' +
        h(mine.status === 'completed' ? 'You donated — thank you.' :
          mine.status === 'accepted' ? 'The receiver accepted your offer.' : 'Your offer has been sent.') +
        '</strong>' +
        (receiverContactVisible(mine) && receiver
          ? '<p class="contact">📞 <a href="tel:' + attr(req.contactPhone || receiver.phone) + '">' +
            h(req.contactPhone || receiver.phone) + '</a> — ' + h(receiver.name) + '</p>'
          : '') +
        (mine.status === 'offered'
          ? '<button class="btn btn--ghost btn--sm" data-action="withdraw-offer" data-id="' + attr(mine.id) + '">Withdraw offer</button>'
          : '') +
        '</div>';
    } else {
      panel = '<form class="card form" data-submit="offer">' +
        '<input type="hidden" name="requestId" value="' + attr(req.id) + '">' +
        (mine ? '<input type="hidden" name="responseId" value="' + attr(mine.id) + '">' : '') +
        '<div class="field"><label for="message">Message to the receiver <span class="opt">(optional)</span></label>' +
        '<textarea id="message" name="message" rows="3" placeholder="When you can reach the hospital."></textarea></div>' +
        (elig.ok ? '' : '<p class="hint warn">' + h(elig.detail) + '. You can still offer, but mention it.</p>') +
        '<button class="btn btn--primary btn--block" type="submit">I can donate</button>' +
        '<p class="hint">Your phone number is shared with this receiver once you offer.</p>' +
        '</form>';
    }

    ui.setMain(
      '<section class="detail">' + backLink('#/home', 'Requests') +
      requestSummary(req, stats) +
      '<p class="muted small center">' + h(km === null ? 'Distance unknown' : geo.formatDistance(km)) +
      ' from your saved location.</p>' + panel + '</section>'
    );
  }

  /* ---- find donors ------------------------------------------------------- */

  async function donors(user, requestId) {
    const req = await store.requests.byId(requestId);
    if (!req || req.receiverId !== user.id) return notFound();
    const all = await store.users.list(function (u) { return u.role === 'donor'; });
    const ranked = match.rankDonorsForRequest(req, all);
    const existing = await store.responses.list(function (r) { return r.requestId === req.id; });
    const byDonor = {};
    existing.forEach(function (r) { byDonor[r.donorId] = r; });

    const rows = ranked.map(function (m) {
      const d = m.donor;
      const state = byDonor[d.id];
      const action = state
        ? '<span class="tag">' + h(state.status) + '</span>'
        : '<button class="btn btn--outline btn--sm" data-action="invite-donor" data-request="' +
          attr(req.id) + '" data-donor="' + attr(d.id) + '">Invite</button>';
      return '<article class="card donorrow">' +
        '<div class="donorrow__id"><span class="avatar">' + h(ui.initials(d.name)) + '</span>' +
        '<div><strong>' + h(d.name) + '</strong>' +
        '<p class="muted">' + h(d.area || d.city) + ' · ' + h(m.proximityLabel) + '</p>' +
        '<p class="muted small">' + h(m.eligibility.label) + ' · ' + h(d.donationCount || 0) + ' donations</p></div></div>' +
        groupBadge(d.bloodGroup) +
        '<div class="row-actions">' + action + '</div>' +
        '</article>';
    });

    ui.setMain(
      '<section class="detail">' + backLink('#/request/' + req.id, 'Back to request') +
      pageTitle('Matching donors', ranked.length + ' compatible ' +
        (ranked.length === 1 ? 'donor' : 'donors') + ' for ' + req.bloodGroup + ', nearest first.') +
      '<p class="muted small">Phone numbers stay hidden until a donor accepts your invitation.</p>' +
      (rows.length ? '<div class="list">' + rows.join('') + '</div>'
        : emptyState('No compatible donors yet',
            'No registered donor can give ' + req.bloodGroup + ' blood right now. Your request stays visible to new donors.')) +
      '</section>'
    );
  }

  /* ---- donor history ----------------------------------------------------- */

  async function history(user) {
    const mine = await store.responses.list(function (r) { return r.donorId === user.id; });
    mine.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

    const rows = await Promise.all(mine.map(async function (response) {
      const req = await store.requests.byId(response.requestId);
      if (!req) return '';
      return '<article class="card reqcard">' +
        '<div class="reqcard__top">' + groupBadge(req.bloodGroup) +
        '<div class="reqcard__head"><h3><a href="#/request/' + attr(req.id) + '">' + h(req.hospital) + '</a></h3>' +
        '<p class="muted">' + h(req.patientName) + ' · ' + h(ui.fmtWhen(response.createdAt)) + '</p></div>' +
        '<span class="tag tag--' + attr(response.status) + '">' + h(response.status) + '</span></div>' +
        (response.message ? '<p class="quote">' + h(response.message) + '</p>' : '') +
        '</article>';
    }));

    ui.setMain(
      pageTitle('My offers', 'Every request you have responded to.') +
      (rows.filter(Boolean).length
        ? '<div class="list">' + rows.join('') + '</div>'
        : emptyState('No offers yet', 'When you offer to donate, it shows up here.',
            '<a class="btn btn--primary" href="#/home">See open requests</a>'))
    );
  }

  /* ---- profile ----------------------------------------------------------- */

  async function profile(user) {
    pendingLocation = user.location || null;
    const isDonor = user.role === 'donor';
    const elig = blood.eligibility(user);
    const next = blood.nextEligibleDate(user.lastDonation);

    ui.setMain(
      '<section class="auth">' + pageTitle('Profile', user.email) +
      '<form class="card form" data-submit="save-profile">' +
      '<div class="field"><label for="name">Full name</label>' +
      '<input id="name" name="name" required value="' + attr(user.name) + '"></div>' +
      '<div class="grid2">' +
      '<div class="field"><label for="phone">Phone</label>' +
      '<input id="phone" name="phone" type="tel" required value="' + attr(user.phone) + '"></div>' +
      '<div class="field"><label for="bloodGroup">Blood group</label>' +
      '<select id="bloodGroup" name="bloodGroup">' + groupOptions(user.bloodGroup) + '</select></div>' +
      '</div>' +
      '<div class="grid2">' +
      '<div class="field"><label for="city">City</label>' +
      '<input id="city" name="city" required value="' + attr(user.city) + '"></div>' +
      '<div class="field"><label for="area">Area</label>' +
      '<input id="area" name="area" value="' + attr(user.area) + '"></div>' +
      '</div>' +
      (isDonor
        ? '<div class="field"><label for="lastDonation">Last donation date</label>' +
          '<input id="lastDonation" name="lastDonation" type="date" max="' + attr(new Date().toISOString().slice(0, 10)) + '" value="' + attr(user.lastDonation || '') + '">' +
          '<p class="hint">' + h(elig.label) + (next ? ' · next eligible ' + ui.fmtDate(next) : '') + '</p></div>'
        : '') +
      locationField(user.location) +
      '<button class="btn btn--primary btn--block" type="submit">Save changes</button>' +
      '</form>' +
      (isDonor
        ? '<div class="card"><label class="switch"><input type="checkbox" data-action="toggle-availability"' +
          (user.available ? ' checked' : '') + '><span>Available to donate</span></label>' +
          '<p class="hint">Turning this off hides you from new matches without deleting your account.</p></div>'
        : '') +
      '<div class="danger-zone">' +
      '<button class="btn btn--ghost" data-action="logout">Log out</button>' +
      '<button class="btn btn--danger btn--ghost" data-action="clear-data">Erase all local data</button>' +
      '<p class="hint">Erasing wipes every account and request stored in this browser, including the demo data.</p>' +
      '</div></section>'
    );
  }

  /* ---- actions ----------------------------------------------------------- */

  function formData(form) {
    const data = {};
    new FormData(form).forEach(function (value, key) { data[key] = value; });
    return data;
  }

  const actions = {
    async signup(form) {
      const data = formData(form);
      if (String(data.password).length < 6) throw new Error('Password must be at least 6 characters.');
      const user = await store.auth.signUp({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role,
        bloodGroup: data.bloodGroup,
        city: data.city,
        area: data.area,
        lastDonation: data.lastDonation || '',
        location: pendingLocation
      });
      pendingLocation = null;
      ui.toast('Welcome, ' + user.name.split(' ')[0] + '!', 'success');
      ui.go('#/home');
    },

    async login(form) {
      const data = formData(form);
      await store.auth.logIn(data.email, data.password);
      ui.go('#/home');
    },

    async logout() {
      await store.auth.logOut();
      ui.toast('Logged out.');
      ui.go('#/welcome');
    },

    'go-profile': function () { ui.go('#/profile'); },

    async 'capture-location'(button) {
      const status = document.getElementById('loc-status');
      if (status) status.textContent = 'Getting your location…';
      button.disabled = true;
      try {
        const pos = await geo.currentPosition();
        pendingLocation = { lat: pos.lat, lng: pos.lng };
        if (status) status.textContent = 'Saved: ' + pos.lat.toFixed(4) + ', ' + pos.lng.toFixed(4) +
          ' (±' + Math.round(pos.accuracy) + ' m)';
        ui.toast('Location captured.', 'success');
      } catch (err) {
        if (status) status.textContent = 'Not set — matching will fall back to your city';
        ui.toast(err.message, 'error');
      } finally {
        button.disabled = false;
      }
    },

    async 'create-request'(form) {
      const user = await store.auth.currentUser();
      const data = formData(form);
      const req = await store.requests.create({
        receiverId: user.id,
        patientName: data.patientName,
        bloodGroup: data.bloodGroup,
        units: Number(data.units) || 1,
        hospital: data.hospital,
        city: data.city,
        area: data.area,
        location: pendingLocation || user.location || null,
        urgency: data.urgency,
        neededBy: data.neededBy,
        contactPhone: data.contactPhone,
        notes: data.notes,
        status: 'open'
      });
      pendingLocation = null;
      ui.toast('Request posted. Donors nearby can see it now.', 'success');
      ui.go('#/request/' + req.id);
    },

    async offer(form) {
      const user = await store.auth.currentUser();
      const data = formData(form);
      if (data.responseId) {
        await store.responses.update(data.responseId, { status: 'offered', message: data.message || '' });
      } else {
        await store.responses.create({
          requestId: data.requestId,
          donorId: user.id,
          status: 'offered',
          message: data.message || ''
        });
      }
      ui.toast('Offer sent. The receiver can now see your contact details.', 'success');
      ui.render();
    },

    async 'withdraw-offer'(button) {
      await store.responses.update(button.dataset.id, { status: 'declined' });
      ui.toast('Offer withdrawn.');
      ui.render();
    },

    async 'invite-donor'(button) {
      const user = await store.auth.currentUser();
      const requestId = button.dataset.request;
      const donorId = button.dataset.donor;
      const existing = await responseBetween(requestId, donorId);
      if (existing) throw new Error('This donor has already been contacted.');
      await store.responses.create({
        requestId: requestId,
        donorId: donorId,
        status: 'invited',
        message: 'Invitation from ' + user.name + '.'
      });
      ui.toast('Invitation sent.', 'success');
      ui.render();
    },

    async 'accept-invite'(button) {
      await store.responses.update(button.dataset.id, { status: 'offered' });
      ui.toast('Thank you. The receiver has your contact details now.', 'success');
      ui.render();
    },

    async 'accept-response'(button) {
      const response = await store.responses.update(button.dataset.id, { status: 'accepted' });
      const req = await store.requests.byId(response.requestId);
      if (req) {
        const closed = await refreshFulfilment(req);
        ui.toast(closed ? 'All units confirmed — request closed.' : 'Donor accepted.', 'success');
      }
      ui.render();
    },

    async 'decline-response'(button) {
      await store.responses.update(button.dataset.id, { status: 'declined' });
      ui.toast('Declined.');
      ui.render();
    },

    async 'complete-response'(button) {
      const response = await store.responses.update(button.dataset.id, { status: 'completed' });
      const donor = await store.users.byId(response.donorId);
      if (donor) {
        await store.users.update(donor.id, {
          lastDonation: new Date().toISOString().slice(0, 10),
          donationCount: (donor.donationCount || 0) + 1
        });
      }
      ui.toast('Recorded. The donor is now marked as recently donated.', 'success');
      ui.render();
    },

    async 'cancel-request'(button) {
      await store.requests.update(button.dataset.id, { status: 'cancelled' });
      ui.toast('Request closed.');
      ui.render();
    },

    async 'reopen-request'(button) {
      await store.requests.update(button.dataset.id, { status: 'open' });
      ui.toast('Request reopened.');
      ui.render();
    },

    async 'toggle-availability'(input) {
      const user = await store.auth.currentUser();
      await store.users.update(user.id, { available: input.checked });
      ui.toast(input.checked ? 'You are visible to receivers again.' : 'You are hidden from new matches.');
      ui.render();
    },

    async 'save-profile'(form) {
      const user = await store.auth.currentUser();
      const data = formData(form);
      await store.users.update(user.id, {
        name: data.name,
        phone: data.phone,
        bloodGroup: data.bloodGroup,
        city: data.city,
        area: data.area,
        lastDonation: data.lastDonation || '',
        location: pendingLocation || user.location || null
      });
      ui.toast('Profile saved.', 'success');
      ui.render();
    },

    async 'clear-data'() {
      if (!window.confirm('Erase every account, request and offer stored in this browser? This cannot be undone.')) return;
      await store.reset();
      ui.toast('All local data erased.');
      location.hash = '#/welcome';
      location.reload();
    }
  };

  return {
    welcome: welcome,
    login: login,
    signup: signup,
    home: home,
    newRequest: newRequest,
    request: request,
    donors: donors,
    history: history,
    profile: profile,
    notFound: notFound,
    actions: actions
  };
})();
