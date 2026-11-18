// ============================================================
// api/taskApi.js — THE TASK API (application tier)
// In the cloud this would be: AWS Lambda.
// Does the actual work for each request: tasks, reminder times,
// device token. When reminder times change, it also UPDATES THE
// USER'S SCHEDULE (the one control call to the reminder side).
// ============================================================

const db = require("../shared/db");
const schedules = require("../shared/schedules");
const { localNow, nextDay, isValidTimeZone } = require("../shared/time");

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function dayToDate(user, day) {
  const today = localNow(user.timeZone).date; // "today" where the USER lives
  return day === "tomorrow" ? nextDay(today) : today;
}

// ---------- New account ----------
// After sign-up, create the user's first schedule with default times.
function setUpNewUser(user) {
  schedules.upsertSchedule(user.id, user.timeZone, user.times);
}

// ---------- Tasks ----------
function listTasks(user, day) {
  const date = dayToDate(user, day);
  return { date, tasks: db.getTasks(user.id, date) };
}

function addTask(user, text, day) {
  text = (text || "").trim();
  if (!text) throw new Error("Task text is empty");
  if (text.length > 200) throw new Error("Task is too long (max 200 characters)");
  return db.addTask(user.id, text, dayToDate(user, day));
}

function toggleTask(user, taskId) {
  return db.toggleTask(user.id, taskId);
}

function deleteTask(user, taskId) {
  return db.deleteTask(user.id, taskId);
}

// ---------- Settings: reminder times, time zone, device ----------
function getSettings(user) {
  return { email: user.email, timeZone: user.timeZone, times: user.times, deviceToken: user.deviceToken };
}

function saveSettings(user, { timeZone, times, deviceToken }) {
  const changes = {};
  if (timeZone !== undefined) {
    if (!isValidTimeZone(timeZone)) throw new Error("Unknown time zone");
    changes.timeZone = timeZone;
  }
  if (times !== undefined) {
    for (const k of ["bedtime", "morning", "nudge"]) {
      if (!TIME.test(times[k] || "")) throw new Error(`Invalid ${k} time`);
    }
    changes.times = { bedtime: times.bedtime, morning: times.morning, nudge: times.nudge };
  }
  if (deviceToken !== undefined) {
    // Registering the phone: the device token is where push messages go.
    if (deviceToken && !/^[A-Za-z0-9_-]{6,64}$/.test(deviceToken)) {
      throw new Error("Device token: 6-64 letters, numbers, - or _");
    }
    changes.deviceToken = deviceToken;
  }

  const updated = db.updateUser(user.id, changes);

  // CONTROL CALL: create / update this user's schedule (EventBridge).
  schedules.upsertSchedule(updated.id, updated.timeZone, updated.times);

  return getSettings(updated);
}

// ---------- Demo: fire a reminder now ----------
// Creates a one-time schedule; the reminder side picks it up.
function sendNow(user, type) {
  if (!["bedtime", "morning", "nudge"].includes(type)) throw new Error("Unknown reminder type");
  return schedules.createOneTimeSchedule(user.id, type);
}

// ---------- Reminders already sent to this user ----------
function sentReminders(user) {
  return db.getSentFor(user.id);
}

module.exports = {
  setUpNewUser,
  listTasks, addTask, toggleTask, deleteTask,
  getSettings, saveSettings, sendNow, sentReminders,
};
