// ============================================================
// api/server.js — PROGRAM 1: THE PLANNING SIDE (3-tier)
//
// This file is API GATEWAY (the single front door):
//   - serves the web app (public/ folder = "S3 + CloudFront")
//   - receives every REST request (HTTPS/JSON in the cloud)
//   - checks the login token (with auth.js = "Cognito")
//   - passes the request to the Task API (taskApi.js = "Lambda")
//
// Start it alone with:  npm run api
// ============================================================

const express = require("express");
const path = require("path");

const config = require("../config");
const auth = require("./auth");
const taskApi = require("./taskApi");
const db = require("../shared/db");
const { readJSON } = require("../shared/store");
const { createLogger } = require("../shared/logger");

const log = createLogger("api");
const app = express();
app.use(express.json({ limit: "20kb" }));

// ---------- Presentation tier: the web app files ----------
app.use(express.static(path.join(__dirname, "..", "public")));

// ---------- Login (Cognito) ----------
app.post("/api/signup", (req, res, next) => {
  try {
    const { email, password, timeZone } = req.body;
    const user = auth.signUp(email, password, timeZone || "UTC");
    taskApi.setUpNewUser(user);
    log("Login", `new user signed up: ${user.email}`);
    const { token } = auth.signIn(email, password);
    res.status(201).json({ token });
  } catch (err) { next(err); }
});

app.post("/api/login", (req, res, next) => {
  try {
    const { token, user } = auth.signIn(req.body.email, req.body.password);
    log("Login", `signed in: ${user.email}`);
    res.json({ token });
  } catch (err) { next(err); }
});

// ---------- API Gateway checks the token on every request below ----------
function requireLogin(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const userId = auth.verifyToken(token);
  const user = userId && db.getUserById(userId);
  if (!user) return res.status(401).json({ error: "Please sign in" });
  req.user = user;
  req.token = token;
  next();
}

app.post("/api/logout", requireLogin, (req, res) => {
  auth.signOut(req.token);
  res.status(204).end();
});

// ---------- Tasks (REST: GET / POST / PATCH / DELETE) ----------
app.get("/api/tasks", requireLogin, (req, res) => {
  res.json(taskApi.listTasks(req.user, req.query.day));
});

app.post("/api/tasks", requireLogin, (req, res, next) => {
  try {
    const task = taskApi.addTask(req.user, req.body.text, req.body.day);
    log("Task API", `${req.user.email} added a task for ${task.date}`);
    res.status(201).json(task);
  } catch (err) { next(err); }
});

app.patch("/api/tasks/:id/toggle", requireLogin, (req, res) => {
  const task = taskApi.toggleTask(req.user, req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

app.delete("/api/tasks/:id", requireLogin, (req, res) => {
  if (!taskApi.deleteTask(req.user, req.params.id)) {
    return res.status(404).json({ error: "Task not found" });
  }
  res.status(204).end();
});

// ---------- Settings: times, time zone, device token ----------
app.get("/api/settings", requireLogin, (req, res) => {
  res.json(taskApi.getSettings(req.user));
});

app.put("/api/settings", requireLogin, (req, res, next) => {
  try {
    const s = taskApi.saveSettings(req.user, req.body);
    log("Task API", `${req.user.email} saved settings -> schedule updated`);
    res.json(s);
  } catch (err) { next(err); }
});

// ---------- Demo: send a reminder now ----------
app.post("/api/demo/:type", requireLogin, (req, res, next) => {
  try {
    taskApi.sendNow(req.user, req.params.type);
    log("Task API", `${req.user.email} asked for a "${req.params.type}" reminder now`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- Reminders sent to me + system status (read-only) ----------
app.get("/api/reminders", requireLogin, (req, res) => {
  const queue = readJSON("queue.json", { messages: [] }).messages.length;
  const dlq = readJSON("dlq.json", { messages: [] }).messages.length;
  res.json({ sent: taskApi.sentReminders(req.user), queue, dlq });
});

// ---------- Errors ----------
app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || "Something went wrong" });
});

app.listen(config.PORT, () => {
  log("API", `Planning side running: http://localhost:${config.PORT}`);
});
