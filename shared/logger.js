// ============================================================
// shared/logger.js — LOGS (the "Logs" part of CloudWatch)
// Every part writes what it did to the terminal AND to a log file
// in the logs/ folder, so you can check later what happened.
// ============================================================

const fs = require("fs");
const path = require("path");

const LOG_DIR = process.env.NN_LOG_DIR || path.join(__dirname, "..", "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// program: "api" or "reminders" -> logs/api.log or logs/reminders.log
function createLogger(program) {
  const logFile = path.join(LOG_DIR, `${program}.log`);
  return function log(component, message) {
    const time = new Date().toLocaleTimeString();
    const line = `${time}  [${component.padEnd(9)}] ${message}`;
    console.log(line);
    fs.appendFileSync(logFile, line + "\n");
  };
}

module.exports = { createLogger };
