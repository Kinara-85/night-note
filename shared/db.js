// ============================================================
// shared/db.js — THE SHARED DATABASE (data tier)
// In the cloud this would be: Amazon DynamoDB.
// It is used by BOTH flows:
//   - the Planning side (API) WRITES users, devices and tasks
//   - the Reminder side (Worker) READS them, and WRITES the sent log
// Each "table" is one JSON file in the data/ folder:
//   users.json   -> users, their reminder times, time zone, device token
//   tasks.json   -> everyone's tasks
//   sentlog.json -> reminders already sent (stops duplicates)
// ============================================================

const crypto = require("crypto");
const { readJSON, writeJSON } = require("./store");

const USERS = "users.json";
const TASKS = "tasks.json";
const SENT = "sentlog.json";

// ---------------- Users table ----------------
function getUsers() {
  return readJSON(USERS, { users: [] }).users;
}

function getUserById(id) {
  return getUsers().find((u) => u.id === id) || null;
}

function getUserByEmail(email) {
  return getUsers().find((u) => u.email === email.toLowerCase()) || null;
}

function createUser({ email, passwordHash, salt, timeZone }) {
  const data = readJSON(USERS, { users: [] });
  const user = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    passwordHash,
    salt,
    timeZone,
    times: { bedtime: "22:00", morning: "07:00", nudge: "10:00" },
    deviceToken: "", // the phone's push address (here: an ntfy topic)
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  writeJSON(USERS, data);
  return user;
}

function updateUser(id, changes) {
  const data = readJSON(USERS, { users: [] });
  const user = data.users.find((u) => u.id === id);
  if (!user) return null;
  Object.assign(user, changes);
  writeJSON(USERS, data);
  return user;
}

// ---------------- Tasks table ----------------
function getTasks(userId, date) {
  return readJSON(TASKS, { tasks: [] }).tasks.filter(
    (t) => t.userId === userId && t.date === date
  );
}

function addTask(userId, text, date) {
  const data = readJSON(TASKS, { tasks: [] });
  const task = { id: crypto.randomUUID(), userId, text, date, done: false };
  data.tasks.push(task);
  writeJSON(TASKS, data);
  return task;
}

function toggleTask(userId, taskId) {
  const data = readJSON(TASKS, { tasks: [] });
  // userId check: a user can only change THEIR OWN tasks
  const task = data.tasks.find((t) => t.id === taskId && t.userId === userId);
  if (!task) return null;
  task.done = !task.done;
  writeJSON(TASKS, data);
  return task;
}

function deleteTask(userId, taskId) {
  const data = readJSON(TASKS, { tasks: [] });
  const before = data.tasks.length;
  data.tasks = data.tasks.filter((t) => !(t.id === taskId && t.userId === userId));
  writeJSON(TASKS, data);
  return data.tasks.length < before;
}

// ---------------- Sent log table ----------------
// key example: "user123:morning:2026-11-05"
function wasSent(key) {
  return Boolean(readJSON(SENT, { sent: {} }).sent[key]);
}

function markSent(key, info) {
  const data = readJSON(SENT, { sent: {} });
  data.sent[key] = { ...info, sentAt: new Date().toISOString() };
  writeJSON(SENT, data);
}

function getSentFor(userId, limit = 10) {
  const all = readJSON(SENT, { sent: {} }).sent;
  return Object.values(all)
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .slice(0, limit);
}

module.exports = {
  getUserById, getUserByEmail, createUser, updateUser,
  getTasks, addTask, toggleTask, deleteTask,
  wasSent, markSent, getSentFor,
};
