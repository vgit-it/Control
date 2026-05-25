// Firebase project configuration.
//
// SETUP (one-time, before the app will run):
//   1. console.firebase.google.com -> create a project
//   2. Authentication -> Sign-in method -> enable Email/Password
//   3. Firestore Database -> create database (production mode)
//   4. Project settings -> Your apps -> add a Web app -> copy the config below
//   5. Deploy firestore.rules (see project root) via the Firebase console or CLI
//   6. (optional) Create the test account in Authentication:
//        email: test@orb.local   password: TestPassword
//
// Replace the placeholder values below with your project's config.

export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

// Email used for the pre-seeded Test account (see PRD section 17).
// Firebase Auth requires an email format, so the username "Test" maps here.
export const TEST_EMAIL = "test@orb.local";
