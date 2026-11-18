// ============================================================
// reminders/scheduler.js — THE SCHEDULER (event producer)
// In the cloud this would be: Amazon EventBridge Scheduler.
//
// Reads every user's schedule (written by the Task API) and checks
// the clock IN EACH USER'S TIME ZONE. At bedtime, morning or nudge
// time it puts an EVENT in the queue. It never sends anything itself
// and never talks to the Worker (it only shares the queue).
// ============================================================

const config = require("../config");
const queue = require("./queue");
const schedules = require("../shared/schedules");
const { readJSON, writeJSON } = require("../shared/store");
const { localNow, toMinutes } = require("../shared/time");

const STATE = "scheduler-state.json"; // which events already fired
const EVENTS = ["bedtime", "morning", "nudge"];

let log = () => {};

function checkClock() {
  const all = schedules.readAll();
  const state = readJSON(STATE, { fired: {}, oneTimeDone: [] });
  let changed = false;

  // 1) The daily schedules: one per user, in that user's time zone.
  for (const [userId, sch] of Object.entries(all.schedules)) {
    const now = localNow(sch.timeZone);
    for (const type of EVENTS) {
      const late = now.minutes - toMinutes(sch.times[type]);
      const key = `${userId}:${type}:${now.date}`;
      if (late >= 0 && late < config.FIRE_WINDOW_MINUTES && !state.fired[key]) {
        queue.sendMessage({ userId, type, date: now.date, dedupeKey: key });
        state.fired[key] = Date.now();
        changed = true;
        log("Scheduler", `${now.hhmm} (${sch.timeZone}) -> "${type}" event for user ${userId.slice(0, 8)} put in queue`);
      }
    }
  }

  // 2) One-time schedules (from the demo buttons): fire right away.
  for (const item of all.oneTime) {
    if (state.oneTimeDone.includes(item.id)) continue;
    const sch = all.schedules[item.userId];
    const date = localNow(sch ? sch.timeZone : "UTC").date;
    queue.sendMessage({ userId: item.userId, type: item.type, date, dedupeKey: `${item.userId}:${item.type}:${date}:demo-${item.id}` });
    state.oneTimeDone.push(item.id);
    changed = true;
    log("Scheduler", `one-time "${item.type}" event for user ${item.userId.slice(0, 8)} put in queue`);
  }

  if (changed) {
    // keep the state file small: forget events older than 3 days
    const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
    for (const [k, t] of Object.entries(state.fired)) if (t < cutoff) delete state.fired[k];
    state.oneTimeDone = state.oneTimeDone.slice(-100);
    writeJSON(STATE, state);
  }
}

function start(logger) {
  log = logger;
  checkClock();
  setInterval(() => {
    try { checkClock(); } catch (err) { log("Scheduler", `error: ${err.message}`); }
  }, config.SCHEDULER_EVERY_SECONDS * 1000);
  log("Scheduler", "started");
}

module.exports = { start };
