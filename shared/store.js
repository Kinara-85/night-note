// ============================================================
// shared/store.js — Helper that reads and writes the JSON data files.
// Both programs use these files, so writes are done safely:
// write to a temporary file first, then swap it in.
// Rule used in this project: each file has ONE program that writes it.
// ============================================================

const fs = require("fs");
const path = require("path");

// On the AWS server the data lives OUTSIDE the app folder (NN_DATA_DIR),
// so a new deployment does not delete users and tasks.
const DATA_DIR = process.env.NN_DATA_DIR || path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function file(name) {
  return path.join(DATA_DIR, name);
}

// Small pause (used when a file is busy for a moment).
function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readJSON(name, fallback) {
  const f = file(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (!fs.existsSync(f)) return structuredClone(fallback);
      return JSON.parse(fs.readFileSync(f, "utf8"));
    } catch (err) {
      pause(30); // the other program may be writing it right now
    }
  }
  return structuredClone(fallback);
}

function writeJSON(name, data) {
  const f = file(name);
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      fs.renameSync(tmp, f);
      return;
    } catch (err) {
      pause(30); // Windows: file briefly locked by a reader
    }
  }
  throw new Error(`Could not save ${name}`);
}

module.exports = { readJSON, writeJSON, file, DATA_DIR };
