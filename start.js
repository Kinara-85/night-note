// ============================================================
// start.js — Starts BOTH programs with one command: npm start
//   Program 1: api/server.js        (planning side, 3-tier)
//   Program 2: reminders/service.js (reminder side, event-driven)
// They run separately. To stop one on its own, start them in two
// terminals instead:  npm run api   and   npm run reminders
// ============================================================

const { spawn } = require("child_process");
const path = require("path");

const programs = [
  { name: "API      ", file: "api/server.js" },
  { name: "REMINDERS", file: "reminders/service.js" },
];

const children = programs.map(({ name, file }) => {
  const child = spawn(process.execPath, [path.join(__dirname, file)], { stdio: ["ignore", "pipe", "pipe"] });
  const print = (data) =>
    data.toString().split("\n").filter(Boolean).forEach((line) => console.log(`${name} | ${line}`));
  child.stdout.on("data", print);
  child.stderr.on("data", print);
  child.on("exit", (code) => console.log(`${name} | stopped (code ${code})`));
  return child;
});

process.on("SIGINT", () => {
  children.forEach((c) => c.kill());
  process.exit(0);
});
