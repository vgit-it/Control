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
  apiKey: "AIzaSyB9M2tvdurZdhDq3iUJChu3widjqMpe1IY",
  authDomain: "control-76d7e.firebaseapp.com",
  projectId: "control-76d7e",
  storageBucket: "control-76d7e.firebasestorage.app",
  messagingSenderId: "120759276333",
  appId: "1:120759276333:web:1135c5d1e5f1706c8a79a4"
};

// Email used for the pre-seeded Test account (see PRD section 17).
// Firebase Auth requires an email format, so the username "Test" maps here.
export const TEST_EMAIL = "test@orb.local";
