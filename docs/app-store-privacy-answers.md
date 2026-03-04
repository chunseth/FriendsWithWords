# App Store Connect — Privacy Answers (Words With Real Friends)

Use this when filling out **App Privacy** in App Store Connect so your answers match what the app actually collects. Apple specifically calls out **game saves**, **multiplayer matching**, and **gameplay logic** — you must declare **Gameplay Content** and related data.

---

## What the app actually collects (off-device)

| What | Where it goes | Apple data type |
|------|----------------|------------------|
| **Account / user ID** | Supabase Auth (anonymous); used in profiles, scores, multiplayer_sessions, game_requests, friends | **Identifiers → User ID** |
| **Display name & username** | Supabase `profiles`; shown in multiplayer and leaderboard; submitted with scores | **Contact Info → Name** (or **User ID** as “screen name”) |
| **Multiplayer game saves** | Full multiplayer game state (board, players, turn, seed) in Supabase `multiplayer_sessions.session_payload` | **User Content → Gameplay Content** |
| **Multiplayer matching** | Game requests (sender/receiver, seed, session_id), friends, friend requests in Supabase | **User Content → Gameplay Content** |
| **Leaderboard / gameplay outcomes** | Scores (player_id, display_name, seed, final_score, breakdown) in Supabase `scores` | **User Content → Gameplay Content** |

**Not collected (on-device only):**

- Single-player saved game (AsyncStorage only → not “collected” per Apple).
- Leaderboard consent flag (AsyncStorage).
- Local stats (AsyncStorage).

**Not used:** Third-party advertising, analytics, or tracking.

---

## How to answer in App Store Connect

In **App Store Connect → Your App → App Privacy**, add these **data types** and answer as below. If a question isn’t listed, choose the option that matches “we use this only for app functionality, linked to the user, not for tracking.”

### 1. Gameplay Content (required — game saves, multiplayer, gameplay logic)

- **Data type:** **User Content → Gameplay Content**
- **What to say:** Saved games (multiplayer game state), multiplayer matching (who plays with whom, game requests, session IDs), and gameplay logic (scores, game outcomes for leaderboard).
- **Collected:** Yes.
- **Purpose:** **App Functionality** only (multiplayer, save/resume, leaderboard).
- **Linked to user:** Yes (tied to account / session).
- **Used for tracking:** No.

### 2. User ID (identifiers)

- **Data type:** **Identifiers → User ID**
- **What to say:** Account ID (for auth) and screen name/username (for profiles and multiplayer).
- **Collected:** Yes.
- **Purpose:** **App Functionality** (authentication, multiplayer, leaderboard, profiles).
- **Linked to user:** Yes.
- **Used for tracking:** No.

### 3. Name (display name)

- **Data type:** **Contact Info → Name** (or **Identifiers → User ID** if you describe “display name / username” there; don’t double-count)
- **What to say:** Display name and username chosen by the user, shown in multiplayer and on the leaderboard.
- **Collected:** Yes.
- **Purpose:** **App Functionality** (multiplayer identity, leaderboard).
- **Linked to user:** Yes.
- **Used for tracking:** No.

---

## Short checklist

- [ ] **Gameplay Content** — Declare it; use for: saved games (multiplayer), multiplayer matching, gameplay logic (scores/leaderboard). Purpose: App Functionality. Linked: Yes. Tracking: No.
- [ ] **User ID** — Declare it; use for: auth, profiles, multiplayer, leaderboard. Purpose: App Functionality. Linked: Yes. Tracking: No.
- [ ] **Name** (or fold into User ID) — Declare display name/username; use for: multiplayer, leaderboard. Purpose: App Functionality. Linked: Yes. Tracking: No.
- [ ] **Third-party partners:** If you only use Supabase as your own backend (you control the data), you can describe it as your infrastructure; if Apple’s form asks about “partners,” add Supabase and state they process data on your behalf for app functionality only (no advertising, no tracking).
- [ ] **Privacy Policy URL** — Point to your live privacy policy (e.g. `https://yoursite.com/privacy.html`).
- [ ] **Privacy Choices (optional)** — If you have a “delete account” or “manage data” flow, you can link to a support/contact page.

---

## Optional disclosure

You do **not** get to skip declaring Gameplay Content, User ID, or Name under “optional disclosure.” This data is part of your app’s core functionality (multiplayer, leaderboard, saved games), is linked to the user, and is not “infrequent” or “optional” in the sense Apple uses for that exception. So all of the above must be declared.

---

## Keeping it accurate

- If you add Sign in with Apple or email later, add **Contact Info → Email Address** (or as appropriate) and note “used for account management / recovery.”
- If you add analytics or crash reporting, add the relevant **Usage Data** or **Diagnostics** types and purposes.
- Update this doc and your App Store Connect answers whenever your data practices change.
