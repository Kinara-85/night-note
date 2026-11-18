// ============================================================
// test/app.test.js — UNIT TESTS
// Run them with:  npm test
// GitHub Actions runs these on every push. If ONE test fails,
// the pipeline stops and nothing is deployed.
// ============================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Use a temporary, empty data folder so tests never touch real data.
process.env.NN_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nn-data-"));
process.env.NN_LOG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nn-logs-"));

const { nextDay, toMinutes, isValidTimeZone, localNow } = require("../shared/time");
const auth = require("../api/auth");
const taskApi = require("../api/taskApi");

// ---------- Time helpers ----------
test("nextDay moves to the next day, month and year", () => {
  assert.strictEqual(nextDay("2026-11-05"), "2026-11-06");
  assert.strictEqual(nextDay("2026-11-30"), "2026-12-01");
  assert.strictEqual(nextDay("2026-12-31"), "2027-01-01");
});

test("toMinutes turns a clock time into minutes", () => {
  assert.strictEqual(toMinutes("00:00"), 0);
  assert.strictEqual(toMinutes("07:30"), 450);
  assert.strictEqual(toMinutes("22:00"), 1320);
});

test("time zones are checked", () => {
  assert.strictEqual(isValidTimeZone("Asia/Karachi"), true);
  assert.strictEqual(isValidTimeZone("Not/AZone"), false);
});

test("localNow uses the user's own time zone", () => {
  const noonUTC = new Date("2026-11-05T12:00:00Z");
  assert.strictEqual(localNow("Asia/Karachi", noonUTC).hhmm, "17:00"); // UTC+5
});

// ---------- Login ----------
test("sign up rejects a bad email or short password", () => {
  assert.throws(() => auth.signUp("not-an-email", "secret123", "UTC"), /valid email/);
  assert.throws(() => auth.signUp("a@b.com", "123", "UTC"), /at least 6/);
});

test("sign in works with the right password only", () => {
  auth.signUp("test@nightnote.com", "secret123", "UTC");
  const { token } = auth.signIn("test@nightnote.com", "secret123");
  assert.ok(auth.verifyToken(token));
  assert.throws(() => auth.signIn("test@nightnote.com", "wrong-pass"), /Wrong email or password/);
});

// ---------- Tasks ----------
test("tasks are saved, and empty tasks are rejected", () => {
  const user = auth.signUp("tasks@nightnote.com", "secret123", "UTC");
  const task = taskApi.addTask(user, "  Read a poem  ", "today");
  assert.strictEqual(task.text, "Read a poem");
  assert.strictEqual(taskApi.listTasks(user, "today").tasks.length, 1);
  assert.throws(() => taskApi.addTask(user, "   ", "today"), /empty/);
});
