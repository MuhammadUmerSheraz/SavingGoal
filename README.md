# Saving Goal

A dark-themed web app to create saving goals, add credit/debit entries, and track progress with a circular graph (active vs inactive entries). Data can be stored in the browser only or synced with **Firebase** so you can access your goals from any device.

## Features

- **Goals**: Create goals with name, target amount, and end date.
- **Entries**: Add Credit or Debit entries per goal; each entry has an **Active** / **Inactive** toggle and can be edited.
- **Progress**: Circular progress graph (green = active entries, gray = inactive).
- **Persistence**: Uses **localStorage** by default. With Firebase configured, data is synced to the cloud so you can sign in on any device and see the same goals.

## How to run

Open `index.html` in a browser (double-click or use a local server):

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open http://localhost:8000 (or the path to `index.html`).

## Firebase setup (sync across devices)

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project (or use an existing one).
2. **Add a Web app** in the project and copy the config object.
3. Open `firebase-config.js` and replace the placeholder values with your config:
   - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`
4. **Authentication**: In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.
5. **Firestore**: Create a Firestore Database. In **Rules**, paste the contents of `firestore.rules` (or use the Rules tab in the console):
   - Users can only read/write their own document under `users/{userId}`.
6. Reload the app. You’ll see a **Sign in** form. Use **Create account** to register, then **Sign in** on any device with the same email/password to access your goals.

Without Firebase, the app still works and saves goals in **localStorage** (this browser only).

## Usage

1. If using Firebase: sign in (or create an account).
2. Fill **Goal name**, **Target amount**, and **End date** → click **Create goal**.
3. In each goal card, add **Credit** or **Debit** and click **Add**. Use **Edit** to change an entry; **Active** / **Inactive** to include or exclude it from the progress graph.
4. Delete entries with the × button; delete a goal with the × in the card header.
