# App Review: Reviewer Access & Multiplayer Test Steps

Apple requires **full review access** for account-based apps: either an **active demo account** or a **fully featured demo mode**, plus a **live backend** during review. Use this doc to meet those requirements and to paste **App Review Notes** into App Store Connect.

---

## 1. How your app fits Apple’s requirement

- **Account type:** The app uses **anonymous sign-in** (no login form). When the app opens and the backend is configured, it automatically gets a session. No username/password to provide.
- **Demo account:** You do **not** need to create a separate “demo account.” The reviewer gets full access by simply opening the app (backend live). You can still offer a **second test account** (see below) so they can test multiplayer on one device by logging in on two devices with the same test credentials—but with anonymous auth you don’t have classic “credentials.” So the main approach is: **live backend + clear test steps**, and optionally **two devices** for multiplayer.
- **Backend:** Supabase must be **live and reachable** during the entire review window. Do not disable or throttle the project during submission.

---

## 2. Checklist before you submit

- [ ] **Backend live:** Supabase project is up; no IP allowlists that block Apple’s reviewers; Anonymous sign-in enabled in Supabase Auth.
- [ ] **Build has backend config:** The build you submit has valid `SUPABASE_URL` and `SUPABASE_ANON_KEY` (e.g. from `.env` or App Store Connect build settings). Test the same build (TestFlight or dev) with backend configured.
- [ ] **App Review Notes:** Paste the “App Review Notes” section below into App Store Connect → **App Review Information** → **Notes** (and add any login/demo instructions if you add them later).
- [ ] **Contact:** Support URL and contact info are set in App Store Connect and in the app so Apple can reach you if something fails.

---

## 3. App Review Notes (paste into App Store Connect)

Copy the block below into **App Store Connect → Your App → App Review Information → Notes**.

```
REVIEWER ACCESS — ACCOUNT & BACKEND
• This app uses anonymous sign-in only. There is no login screen. Opening the app with an internet connection creates a session automatically. No demo username/password is required.
• Our backend (Supabase) is live for the duration of review. All account-based and multiplayer features work against this backend.

MULTIPLAYER — HOW TO TEST (two devices recommended)
Multiplayer is asynchronous turn-based: two players share one game and take turns over time.

Option A — Two devices (recommended)
1. Install the app on two devices (or one device + one simulator, if you have a second Mac).
2. Device 1: Open app. If prompted, choose a username (e.g. "Reviewer1") and save. Tap "Multiplayer."
3. Device 2: Open app. Choose a different username (e.g. "Reviewer2") and save. Tap "Multiplayer."
4. On Device 1: Open the "Friends" tab. Search for the other username (e.g. "Reviewer2"). Send a friend request.
5. On Device 2: Open the "Friends" tab. Accept the incoming friend request.
6. On either device: Open the "Games" tab. Tap "Play" next to the new friend. Choose game type (e.g. Daily or Random) and send a game request.
7. On the other device: Open "Games" tab. Accept the pending game request. The game opens.
8. Take turns: place tiles, submit a word, then wait for the other device to take a turn. The board and scores sync when each turn is submitted.

Option B — Single device (smoke test)
1. Open app, set a username, tap "Multiplayer."
2. Confirm the "Friends" and "Games" tabs load without errors (you may see empty lists).
3. Confirm "Play" and search/friend UI are visible. Full two-player flow requires a second device or our test partner (contact below).

OTHER FEATURES (no second device needed)
• Single-player: From main menu, tap "Play" → choose mode (Daily / Random / Seed) and start. Play and submit; leaderboard option after game over.
• Leaderboard: Main menu → "Leaderboard." Consent may be requested on first use.
• Settings: Gear icon on main menu → settings, support link, account deletion.

If anything fails during review (e.g. backend timeout, empty screens), please contact us via the Support URL and we will respond promptly.
```

---

## 4. Optional: Second “test” device account for reviewers

Because auth is anonymous, you **cannot** give one set of credentials that work on two devices. Each install gets its own anonymous user. So:

- **Best:** Ask reviewers to use **two devices** and follow Option A above. Many reviewers have two devices or simulator + device.
- **Alternative:** You could add a **“Sign in with Apple” (or email) optional account** and create a **dedicated reviewer account** (e.g. `appreview@yourdomain.com`) that you keep active. Then in Notes you say: “For single-device multiplayer testing, sign in with Apple using our reviewer account: [instructions].” That requires adding non-anonymous auth and maintaining that account. Only do this if you need it.

---

## 5. Optional: In-app “App Review” or demo mode

If you want to satisfy “fully featured demo mode” without two devices, you could add a **review-only path** that lets one user play both sides of a multiplayer game (e.g. a “Demo multiplayer game” that uses a local/second fake player so the reviewer can take turns and see sync). That’s a feature you’d build (e.g. behind a debug flag or a “Try multiplayer (demo)” button). For many apps, **clear two-device steps + live backend** are enough; add demo mode only if review feedback asks for it.

---

## 6. Where to put these in App Store Connect

- **Notes for reviewer:** App Store Connect → **Your App** → **App Review Information** → **Notes**. Paste the “App Review Notes” text there.
- **Demo account (if you add one later):** Same screen → **Sign-in required** / **Demo account** fields. For anonymous-only, leave sign-in as “No” and rely on the Notes.
- **Support URL:** App Store Connect → **App Information** (or **App Review Information**) → **Support URL**. Use a page that includes contact info and, if you like, a link to the same multiplayer test steps.

---

## 7. After submission

- Keep the backend **live** until the app is approved (and avoid breaking changes during review).
- If App Review asks for a second device or a test partner, you can reply with the Option A steps and offer to provide a test partner account if you implement one later.
