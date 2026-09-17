# Connecting RoktoDaan to Firebase (free tier)

Fifteen minutes, no credit card. At the end, a donor on one phone and a receiver on
another see each other for real.

## Does this cost anything?

No. Firebase's default plan is **Spark**, which is free and does not ask for a billing
account. This app uses exactly two Firebase products, both included:

| | Free allowance on Spark | What this app does |
| --- | --- | --- |
| **Firestore** | 1 GiB stored, 50,000 reads and 20,000 writes per day | Stores users, requests and offers |
| **Authentication** | Unlimited email/password accounts | Signs people in |

What forces the paid **Blaze** plan is Cloud Functions, some extensions, and outbound
networking. RoktoDaan uses none of them, so there is nothing to upgrade.

For scale: one donor opening the app and scrolling their request feed costs roughly a
few dozen reads. 50,000 a day is a lot of scrolling.

If the console ever offers to upgrade you to Blaze, you can decline and keep going.

## Steps

**1. Create the project**

Go to [console.firebase.google.com](https://console.firebase.google.com) → **Create a
project**. Name it anything (`roktodaan` is fine). Turn **Google Analytics off** — it is
not needed and adds a consent step.

**2. Turn on Authentication**

**Build → Authentication → Get started → Email/Password → Enable → Save.**

Leave "Email link (passwordless sign-in)" off.

**3. Create the database**

**Build → Firestore Database → Create database.**

- Pick the location closest to your users. **This cannot be changed later** —
  `asia-south1` (Mumbai) is the nearest region to Bangladesh.
- When asked for a starting mode, pick either one; the next step replaces it.

**4. Apply the security rules**

Open the **Rules** tab, delete what is there, paste the contents of
[`firestore.rules`](firestore.rules) from this repo, and click **Publish**.

Do not skip this and leave "test mode" on. Test mode lets anyone on the internet read
and write your database for 30 days, and then blocks your own app without warning.

**5. Register a web app and copy the config**

Project **Settings** (the gear) → **General** → scroll to *Your apps* → the **web icon
(`</>`)**. Give it a nickname, do **not** tick Firebase Hosting, then **Register app**.

Firebase shows a snippet containing `const firebaseConfig = { ... }`. That object is
what I need — six values: `apiKey`, `authDomain`, `projectId`, `storageBucket`,
`messagingSenderId`, `appId`.

**Paste that object into the chat and I will wire it in and test it.**

These values are safe to share and safe to ship in client code — they identify your
project, they do not grant access to it. Access is controlled entirely by the rules from
step 4.

`firebase-config.js` is committed to this repo on purpose: GitHub Pages serves only
what is in the repo, so the hosted app needs it to reach the database.

## Status for the roktodaan-69692 project

Connected and verified end to end on 18 Sep 2026, with two separate accounts:

| | |
| --- | --- |
| Adapter activates, SDK loads | works |
| Email/Password signup and sign-in | works |
| Receiver posts a request | works |
| **A different account sees that request** | **works** — this is the whole point of the app |
| Compatibility + live distance ranking | works (O− donor matched to A+ patient, 9.7 km) |
| Donor sends an offer | works |
| Receiver reads the offer back after signing in again | works |
| Receiver updates their own request | works |

Also verified: the app talks to Firebase correctly from a plain `file://` URL, so no
local server is needed.

Two notes from that run. `allow delete: if false` on `/users` meant nobody could remove
their own profile, so test cleanup was refused; the rule now permits deleting your own
document only, which is also what a real "delete my account" needs. And `/responses`
still forbids deletion by design, to keep an audit trail of who offered what.

## What happens when you paste it

I create `firebase-config.js`, and [`js/backend.js`](js/backend.js) picks it up at
startup: it loads the Firebase SDK, swaps the storage layer, and skips the demo seed.
No screen or matching code changes — that is what the adapter is for.

Then I test a real signup, post a request from one account, and confirm another account
sees it, so we know reads and writes actually work against your project rather than
assuming they do.

## One thing to fix before strangers use it

The rules in step 4 let any signed-in user read every profile and every response. Since
phone numbers currently live on the profile document, someone signed in could read
contact details that the app's screens deliberately hide.

That is fine while it is you and a few testers. Before opening it up, the phone numbers
need to move out of the profile into a private per-user document, with a contact
snapshot copied into a response only when two people actually connect. It is a
data-model change rather than a rules tweak, and it is much easier to do before there is
real data. Worth doing as the next step once we have your project connected and working.
