// ============================================================
// reminders/service.js — PROGRAM 2: THE REMINDER SIDE (event-driven)
//
// Runs on its own, separate from the API (Program 1):
//   Scheduler -> Queue -> Notification Worker -> Push Service -> phone
//   + Dead Letter Queue + Alarm (monitor)
//
// If you stop the API, this program keeps sending reminders,
// because the schedules are already saved.
//
// Start it alone with:  npm run reminders
// ============================================================

const { createLogger } = require("../shared/logger");
const scheduler = require("./scheduler");
const worker = require("./worker");
const monitor = require("./monitor");
const config = require("../config");

const log = createLogger("reminders");

log("Reminders", `Reminder side running${config.DEMO_MODE ? " (DEMO_MODE: short retry waits)" : ""}`);
monitor.start(log);
scheduler.start(log);
worker.start(log);
