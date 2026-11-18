// ============================================================
// reminders/queue.js — THE REMINDER QUEUE + DEAD LETTER QUEUE
// In the cloud this would be: Amazon SQS (+ an SQS Dead Letter Queue).
//
// Works like SQS:
//   - Messages are SAVED in a file, so they survive a restart.
//   - When the Worker receives a message, it is HIDDEN for a while
//     (the "visibility timeout") instead of being removed.
//   - The Worker DELETES it only after it was sent successfully.
//   - If it fails, the Worker hides it for longer (1, 5, 15 min =
//     exponential backoff), then it becomes visible and is retried.
//   - REDRIVE POLICY: after the first try + 3 retries (4 receives),
//     the message is moved to the Dead Letter Queue (dlq.json).
// ============================================================

const crypto = require("crypto");
const config = require("../config");
const { readJSON, writeJSON } = require("../shared/store");

const QUEUE = "queue.json";
const DLQ = "dlq.json";
const EMPTY = { messages: [] };

// 1 first try + 3 retries = 4 receives allowed (SQS: maxReceiveCount = 4)
const MAX_RECEIVE_COUNT = config.RETRY_DELAYS_SECONDS.length + 1;
// If the Worker crashes while working on a message, it reappears after this.
const VISIBILITY_TIMEOUT_SECONDS = 30;

let onDeadLetter = () => {}; // set by the service, used for logging

// Put a new message at the back of the line.
function sendMessage(body) {
  const q = readJSON(QUEUE, EMPTY);
  const msg = { id: crypto.randomUUID(), body, receiveCount: 0, visibleAt: Date.now(), createdAt: new Date().toISOString() };
  q.messages.push(msg);
  writeJSON(QUEUE, q);
  return msg;
}

// Give the Worker the next VISIBLE message (or null).
function receiveMessage() {
  const q = readJSON(QUEUE, EMPTY);
  const now = Date.now();
  let changed = false;
  let result = null;

  for (const msg of [...q.messages]) {
    if (msg.visibleAt > now) continue; // hidden (waiting for its retry time)

    // Redrive policy: received too many times -> Dead Letter Queue
    if (msg.receiveCount >= MAX_RECEIVE_COUNT) {
      q.messages = q.messages.filter((m) => m.id !== msg.id);
      const dlq = readJSON(DLQ, EMPTY);
      dlq.messages.push({ ...msg, movedAt: new Date().toISOString() });
      writeJSON(DLQ, dlq);
      changed = true;
      onDeadLetter(msg);
      continue;
    }

    msg.receiveCount += 1;
    msg.visibleAt = now + VISIBILITY_TIMEOUT_SECONDS * 1000;
    changed = true;
    result = { ...msg };
    break;
  }

  if (changed) writeJSON(QUEUE, q);
  return result;
}

// Remove a message after it was handled successfully.
function deleteMessage(id) {
  const q = readJSON(QUEUE, EMPTY);
  q.messages = q.messages.filter((m) => m.id !== id);
  writeJSON(QUEUE, q);
}

// Hide a message for N seconds (used for exponential backoff).
function changeVisibility(id, seconds) {
  const q = readJSON(QUEUE, EMPTY);
  const msg = q.messages.find((m) => m.id === id);
  if (msg) {
    msg.visibleAt = Date.now() + seconds * 1000;
    writeJSON(QUEUE, q);
  }
}

// Admin "redrive": move everything from the DLQ back into the queue.
function redriveAll() {
  const dlq = readJSON(DLQ, EMPTY);
  if (dlq.messages.length === 0) return 0;
  const q = readJSON(QUEUE, EMPTY);
  for (const m of dlq.messages) {
    q.messages.push({ id: m.id, body: m.body, receiveCount: 0, visibleAt: Date.now(), createdAt: m.createdAt });
  }
  writeJSON(QUEUE, q);
  writeJSON(DLQ, EMPTY);
  return dlq.messages.length;
}

function stats() {
  return {
    waiting: readJSON(QUEUE, EMPTY).messages.length,
    deadLetters: readJSON(DLQ, EMPTY).messages.length,
  };
}

function setOnDeadLetter(fn) {
  onDeadLetter = fn;
}

module.exports = {
  sendMessage, receiveMessage, deleteMessage, changeVisibility,
  redriveAll, stats, setOnDeadLetter, MAX_RECEIVE_COUNT,
};
