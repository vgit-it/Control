// Authentication: signup, login, logout, and the auth-state listener that
// boots the app. PRD section 4.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { auth } from "./firebase.js";
import { TEST_EMAIL } from "./firebase-config.js";

// Usernames are stored as <name>@orb.local so they satisfy Firebase Auth's
// email-format requirement while the UI only ever shows the username.
const USERNAME_DOMAIN = "@orb.local";

export function usernameToEmail(username) {
  const trimmed = String(username).trim();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed.toLowerCase()}${USERNAME_DOMAIN}`;
}

export function signup(username, password) {
  return createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
}

export function login(username, password) {
  return signInWithEmailAndPassword(auth, usernameToEmail(username), password);
}

export function logout() {
  return signOut(auth);
}

export function isTestAccount() {
  return auth.currentUser && auth.currentUser.email === TEST_EMAIL;
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
