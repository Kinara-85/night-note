// ============================================================
// reminders/monitor.js — THE ALARM (the "Alarm" part of CloudWatch)
// Watches the Dead Letter Queue. When a reminder lands there, it
// raises an ALARM: shown in the terminal, written to the log, and
// (if ADMIN_NTFY_TOPIC is set in config.js) pushed to the admin.
//
// It also carries out the admin's "redrive" request
// (npm run redrive): failed reminders go back into the queue.
// ============================================================

const fs = require("fs");
const config = require("../config");
const queue = require("./queue");
const push = require("./pushService");
const { file } = require("../shared/store");

const REDRIVE_FLAG = file("redrive.flag");
let log = () => {};
let lastDlqCount = 0;

async function check() {
  // Redrive request from the admin
  if (fs.existsSync(REDRIVE_FLAG)) {
    fs.unlinkSync(REDRIVE_FLAG);
    const n = queue.redriveAll();
    log("Admin", `redrive: ${n} reminder(s) moved from the Dead Letter Queue back to the queue`);
  }

  // Alarm: did the Dead Letter Queue grow?
  const { deadLetters } = queue.stats();
  if (deadLetters > lastDlqCount) {
    const msg = `${deadLetters} reminder(s) in the Dead Letter Queue. Fix the problem, then run: npm run redrive`;
    log("ALARM", msg);
    if (config.ADMIN_NTFY_TOPIC) {
      try {
        await push.publishToTopic(config.ADMIN_NTFY_TOPIC, "Night Note ALARM", msg);
      } catch (err) {
        log("ALARM", `could not alert admin by push (${err.message})`);
      }
    }
  }
  lastDlqCount = deadLetters;
}

function start(logger) {
  log = logger;
  lastDlqCount = queue.stats().deadLetters;
  queue.setOnDeadLetter((m) => log("Queue", `"${m.body.type}" for user ${m.body.userId.slice(0, 8)} moved to Dead Letter Queue`));
  setInterval(() => check().catch((e) => log("ALARM", `error: ${e.message}`)), 3000);
  log("Alarm", "watching the Dead Letter Queue");
}

module.exports = { start };
