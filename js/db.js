// Firestore data access. Data model per PRD section 20:
//   users/{uid}                  - profile + running game state
//   users/{uid}/days/{dayId}     - per-day record (dayId = ISO date string)

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase.js";

function userRef(uid) {
  return doc(db, "users", uid);
}

function dayRef(uid, dayId) {
  return doc(db, "users", uid, "days", dayId);
}

function daysCol(uid) {
  return collection(db, "users", uid, "days");
}

export async function getUserData(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

// Merge-writes partial fields into the user doc.
export function saveUserData(uid, data) {
  return setDoc(userRef(uid), data, { merge: true });
}

export async function getDayRecord(uid, dayId) {
  const snap = await getDoc(dayRef(uid, dayId));
  return snap.exists() ? snap.data() : null;
}

export function saveDayRecord(uid, dayId, data) {
  return setDoc(dayRef(uid, dayId), data, { merge: true });
}

// Returns up to `n` most recent day records, newest first.
export async function getRecentDays(uid, n = 10) {
  const q = query(daysCol(uid), orderBy("date", "desc"), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// Returns all day records ordered oldest -> newest.
export async function getAllDays(uid) {
  const q = query(daysCol(uid), orderBy("date", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// Full wipe for the user: every day doc, then the user doc itself.
export async function resetAllData(uid) {
  const snap = await getDocs(daysCol(uid));
  if (!snap.empty) {
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(userRef(uid));
}
