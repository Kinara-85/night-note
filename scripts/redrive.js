// ============================================================
// scripts/redrive.js — ADMIN TOOL: resend failed reminders
// Asks the reminder side to move everything from the Dead Letter
// Queue back into the queue (AWS calls this a "redrive").
// Run it after fixing the problem:  npm run redrive
// (The reminder side must be running.)
// ============================================================

const fs = require("fs");
const { file, readJSON } = require("../shared/store");

const count = readJSON("dlq.json", { messages: [] }).messages.length;
if (count === 0) {
  console.log("The Dead Letter Queue is empty. Nothing to resend.");
} else {
  fs.writeFileSync(file("redrive.flag"), new Date().toISOString());
  console.log(`Redrive requested for ${count} reminder(s). The reminder side will resend them within a few seconds.`);
}
