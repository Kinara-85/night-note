// ============================================================
// reminders/worker.js — THE NOTIFICATION WORKER (event consumer)
// In the cloud this would be: AWS Lambda, triggered by SQS.
//
// For each message in the queue:
//   1. Check the SENT LOG: already sent? -> skip (no duplicates)
//   2. Read today's tasks + the user's device token from the database
//   3. Write the reminder (skip the nudge if all tasks are done)
//   4. Send it through the Push Service
//   5. Success -> delete the message and record it in the sent log
//      Failure -> keep it in the queue, hidden for 1, 5, 15 min
//                 (exponential backoff). After 3 failed retries the
//                 queue moves it to the Dead Letter Queue.
// ============================================================

const config = require("../config");
const queue = require("./queue");
const push = require("./pushService");
const db = require("../shared/db");

let log = () => {};

function buildReminder(event, user) {
  const tasks = db.getTasks(user.id, event.date);

  if (event.type === "bedtime") {
    return { title: "Bedtime planning", text: "What's your plan for tomorrow? Open Night Note and add your tasks." };
  }

    if (event.type === "morning") {
    if (tasks.length === 0) return { title: "Good morning", text: "No tasks planned for today. Plan tonight!" };
    const notDone = tasks.filter((t) => !t.done);
    if (notDone.length === 0) return null; // all done already -> skip the morning brief
    const list = notDone.map((t, i) => `${i + 1}. ${t.text}`).join("\n");
    return { title: `Good morning! ${notDone.length} task(s) today`, text: list };
  }

  if (event.type === "nudge") {
    const notDone = tasks.filter((t) => !t.done);
    if (notDone.length === 0) return null; // all done (or none) -> skip the nudge
    return { title: "Friendly nudge", text: `${notDone.length} task(s) still to do. Next up: ${notDone[0].text}` };
  }
  return null;
}

async function handle(msg) {
  const event = msg.body;
  const who = event.userId.slice(0, 8);
  const tag = `"${event.type}" for user ${who} (try ${msg.receiveCount} of ${queue.MAX_RECEIVE_COUNT})`;

  // 1. Sent log: never send the same reminder twice
  if (db.wasSent(event.dedupeKey)) {
    queue.deleteMessage(msg.id);
    log("Worker", `${tag} -> already sent, skipped (duplicate)`);
    return;
  }

  // 2. Read the user (device token, time zone) from the database
  const user = db.getUserById(event.userId);
  if (!user) {
    queue.deleteMessage(msg.id);
    log("Worker", `${tag} -> user not found, removed`);
    return;
  }

  // 3. Write the reminder
  const note = buildReminder(event, user);
  if (!note) {
    queue.deleteMessage(msg.id);
    log("Worker", `${tag} -> all tasks done, nudge skipped`);
    return;
  }

  // 4. Send it
  try {
    await push.publish(user, note.title, note.text);
    db.markSent(event.dedupeKey, { userId: user.id, type: event.type, title: note.title, text: note.text });
    queue.deleteMessage(msg.id);
    log("Worker", `${tag} -> sent to phone`);
  } catch (err) {
    if (err instanceof push.NoDeviceError) {
      queue.deleteMessage(msg.id);
      log("Worker", `${tag} -> ${err.message}, removed (add a device token in Settings)`);
      return;
    }
    const delays = config.RETRY_DELAYS_SECONDS;
    if (msg.receiveCount <= delays.length) {
      const wait = delays[msg.receiveCount - 1];
      queue.changeVisibility(msg.id, wait); // exponential backoff
      log("Worker", `${tag} -> FAILED (${err.message}). Hidden for ${wait}s, then retried`);
    } else {
      queue.changeVisibility(msg.id, 0); // queue will move it to the DLQ
      log("Worker", `${tag} -> FAILED (${err.message}). No retries left`);
    }
  }
}

async function processQueue() {
  for (let i = 0; i < 10; i++) {
    const msg = queue.receiveMessage();
    if (!msg) return;
    await handle(msg);
  }
}

function start(logger) {
  log = logger;
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await processQueue(); } catch (err) { log("Worker", `error: ${err.message}`); }
    busy = false;
  }, config.WORKER_EVERY_SECONDS * 1000);
  log("Worker", "started");
}

module.exports = { start, buildReminder };
