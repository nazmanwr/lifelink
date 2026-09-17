# LifeLink — Blood Donor Connect

A web app that connects people who need blood with donors nearby. Donors sign up with
their blood group and location; receivers post a request for a patient. The app filters
by real red-cell compatibility and ranks matches by GPS distance and donation eligibility.

No build step, no install, no server. Open `index.html` in a browser and it runs.

## Run it

Double-click `index.html`, or:

```powershell
start index.html
```

It works the same on a phone — copy the folder across, or host it (see *Deploy* below).

Demo accounts are preloaded on first run. Password for all of them: `demo1234`

| Email | Role | Blood group | Area |
| --- | --- | --- | --- |
| `rafiq@demo.app` | Donor | O− | Dhanmondi |
| `sabbir@demo.app` | Donor | O− | Uttara |
| `priya@demo.app` | Donor | A+ | Dhanmondi |
| `kamal@demo.app` | Receiver | A+ | Dhanmondi |
| `roksana@demo.app` | Receiver | O+ | Uttara |

Log in as `kamal@demo.app` to see the receiver side, or `rafiq@demo.app` for the donor side.
"Erase all local data" on the Profile screen resets everything, including the demo data.

## Tests

Open `tests.html`. It checks the compatibility matrix, the 90-day eligibility rule,
haversine distances, ranking order, and the storage layer. Everything runs in the browser.

## How matching works

1. **Blood group is a hard filter.** A donor only ever sees requests their group can
   serve, using the standard red-cell table in `js/blood.js` — e.g. an A+ patient can
   receive O−, O+, A−, A+. This filter is never relaxed for convenience.
2. **Eligibility ranks next.** Donors inside the 90-day gap since their last donation
   sort below eligible ones, but stay visible and flagged.
3. **Distance decides the rest.** With GPS on both sides, matches sort by real
   kilometres. Without it, a same-city match still beats an unknown location.
4. **Urgency lifts a request** in a donor's feed — critical cases outrank routine ones
   at similar distance.

## Privacy

Phone numbers are never browsable. A receiver sees a donor's contact details only after
that donor offers; a donor sees the receiver's only after being invited or offering.
Everything else shown in a list is name, area, blood group and eligibility.

## Structure

| File | What it holds |
| --- | --- |
| `index.html` | Page shell and script order |
| `css/styles.css` | All styling, light and dark |
| `js/blood.js` | Compatibility table and the 90-day eligibility rule |
| `js/geo.js` | Geolocation capture and haversine distance |
| `js/store.js` | Data + auth layer (localStorage) |
| `js/backend.js` | Picks the backend at startup: local, or Firebase if configured |
| `js/store.firebase.js` | Same interface, backed by Firebase (opt-in) |
| `js/match.js` | Ranking engine |
| `js/seed.js` | Demo accounts and requests |
| `js/ui.js` | Helpers, header, toasts, hash router |
| `js/views.js` | Every screen and its actions |
| `js/app.js` | Bootstrap |
| `tests.html` | Browser test suite |
| `serve.ps1` | Optional local dev server (`powershell -ExecutionPolicy Bypass -File serve.ps1`) |
| `firestore.rules` | Firebase security rules |

Scripts are classic `<script>` tags rather than ES modules on purpose: browsers block
module imports on `file://`, and this app is meant to run without a server.

## Limits you should know about

This is a working prototype, and two of its properties matter before anyone relies on it:

- **Data is per-browser.** With the local store, a donor on one phone and a receiver on
  another cannot see each other. They are separate databases. Fixing this is what the
  Firebase step below is for.
- **Local auth is not real security.** Passwords are salted and hashed with PBKDF2, but
  they live in the same browser storage as everything else, and anyone with the device
  can read it. Firebase Auth replaces this properly.

Medical screening is also out of scope — the app checks the donation interval and blood
group, nothing else. Real eligibility (weight, haemoglobin, illness, medication, travel)
is decided by the blood bank at donation time.

## Going multi-device with Firebase

`js/store.firebase.js` implements the same interface as the local store, so no screen or
matching code changes. Two steps:

1. Create a free project at [console.firebase.google.com](https://console.firebase.google.com) —
   step-by-step in [FIREBASE-SETUP.md](FIREBASE-SETUP.md), including why the free Spark
   plan is enough. Enable **Authentication → Email/Password** and **Firestore Database**,
   and publish the rules from [firestore.rules](firestore.rules).
2. Copy `firebase-config.example.js` to `firebase-config.js` and paste in your web app's
   config values.

That is all. `js/backend.js` looks for `firebase-config.js` at startup: finding a real
one, it loads the Firebase SDK and the adapter, and skips the demo seed. With no config
file — the default — nothing is downloaded and the local store is used, so the app still
opens offline from `file://`. An unedited copy of the example file is ignored too.

Security rules live in [firestore.rules](firestore.rules). Read the warning in that file
before letting strangers sign up: the rules let any signed-in user read every profile,
and phone numbers currently sit on the profile document, so the database does not yet
enforce the privacy the screens promise.

The wiring is verified: detection, SDK load, and the in-place store swap. What is **not**
verified is live Firestore reads and writes, which need a real project — expect to check
those once yours is connected.

## Deploy

Any static host works, since there is no backend: GitHub Pages, Netlify drop, Firebase
Hosting, Cloudflare Pages. For GitHub Pages, push this folder and enable Pages on the
branch root. Note that **browser geolocation needs HTTPS** — it works on `localhost` and
`file://`, and on any of those hosts, but not over plain `http://`.
