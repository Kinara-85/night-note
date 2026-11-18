// ============================================================
// shared/schedules.js — WHERE THE SCHEDULES ARE KEPT
// In the cloud this would be: Amazon EventBridge Scheduler's list
// of schedules. ONE schedule per user, in the user's time zone.
//
//   - The Task API WRITES here (the "save reminder -> update schedule"
//     arrow in the diagram). This is the one control call between flows.
//   - The Scheduler (reminder side) only READS from here.
// So even if the API is stopped, the schedules already saved here
// keep firing.
// ============================================================

const crypto = require("crypto");
const { readJSON, writeJSON } = require("./store");

const FILE = "schedules.json";
const EMPTY = { schedules: {}, oneTime: [] };

// Create or update the user's schedule (called by the Task API).
function upsertSchedule(userId, timeZone, times) {
  const data = readJSON(FILE, EMPTY);
  data.schedules[userId] = { timeZone, times, updatedAt: new Date().toISOString() };
  writeJSON(FILE, data);
}

// A one-time schedule that fires right away (used by the demo buttons).
function createOneTimeSchedule(userId, type) {
  const data = readJSON(FILE, EMPTY);
  const item = { id: crypto.randomUUID(), userId, type, createdAt: new Date().toISOString() };
  data.oneTime.push(item);
  data.oneTime = data.oneTime.slice(-50); // keep the list short
  writeJSON(FILE, data);
  return item;
}

function readAll() {
  return readJSON(FILE, EMPTY);
}

module.exports = { upsertSchedule, createOneTimeSchedule, readAll };
