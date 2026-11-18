// ============================================================
// api/auth.js — LOGIN (stands in for Amazon Cognito)
// Signs users up and in. After sign-in the app gets a TOKEN.
// The app sends that token with every request, and API Gateway
// checks it, so each user only sees their own tasks.
// Passwords are never stored; only a scrambled "hash" is kept.
// ============================================================

const crypto = require("crypto");
const db = require("../shared/db");
const config = require("../config");
const { readJSON, writeJSON } = require("../shared/store");

const SESSIONS = "sessions.json";

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

function signUp(email, password, timeZone) {
  if (!email || !email.includes("@")) throw new Error("Enter a valid email");
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
  if (db.getUserByEmail(email)) throw new Error("This email is already registered");
  const salt = crypto.randomBytes(16).toString("hex");
  return db.createUser({ email, passwordHash: hashPassword(password, salt), salt, timeZone });
}

// Returns a token if the email + password are right.
function signIn(email, password) {
  const user = db.getUserByEmail(email || "");
  if (!user) throw new Error("Wrong email or password");
  const attempt = hashPassword(password || "", user.salt);
  const ok = crypto.timingSafeEqual(Buffer.from(attempt, "hex"), Buffer.from(user.passwordHash, "hex"));
  if (!ok) throw new Error("Wrong email or password");

  const token = crypto.randomBytes(32).toString("hex");
  const data = readJSON(SESSIONS, { sessions: {} });
  data.sessions[token] = {
    userId: user.id,
    expires: Date.now() + config.TOKEN_HOURS * 3600 * 1000,
  };
  writeJSON(SESSIONS, data);
  return { token, user };
}

// Returns the userId for a valid token, or null.
function verifyToken(token) {
  if (!token) return null;
  const s = readJSON(SESSIONS, { sessions: {} }).sessions[token];
  if (!s || s.expires < Date.now()) return null;
  return s.userId;
}

function signOut(token) {
  const data = readJSON(SESSIONS, { sessions: {} });
  delete data.sessions[token];
  writeJSON(SESSIONS, data);
}

module.exports = { signUp, signIn, verifyToken, signOut };
