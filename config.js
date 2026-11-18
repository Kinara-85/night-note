// ============================================================
// config.js — Settings for the whole app, kept in one place.
// ============================================================

// DEMO_MODE = true  -> short waits so you can show everything in class.
// DEMO_MODE = false -> the real values from the report (1, 5, 15 minutes).
const DEMO_MODE = true;

module.exports = {
  DEMO_MODE,

  // The web app + API run on this port: http://localhost:3000
  PORT: Number(process.env.PORT) || 3000,

  // How often the Scheduler checks the clock (seconds).
  SCHEDULER_EVERY_SECONDS: 5,

  // How often the Notification Worker checks the queue (seconds).
  WORKER_EVERY_SECONDS: 2,

  // EXPONENTIAL BACKOFF: after a failed send, the message stays in the
  // queue but is HIDDEN for this long before it is tried again.
  // Report: 1, 5 and 15 minutes. Demo: 10, 30 and 90 seconds.
  RETRY_DELAYS_SECONDS: DEMO_MODE ? [10, 30, 90] : [60, 300, 900],

  // A reminder fires only if the app is running within this many minutes
  // after the set time (stops very late reminders after a restart).
  FIRE_WINDOW_MINUTES: 60,

  // The push service address (ntfy.sh is free and needs no account).
  PUSH_SERVER: "https://ntfy.sh",

  // ADMIN ALERTS (the "CloudWatch alarm"): the ntfy topic the admin
  // subscribes to. Leave "" to only show the alarm in the terminal.
  ADMIN_NTFY_TOPIC: "",

  // How long a login token stays valid (hours).
  TOKEN_HOURS: 24 * 7,
};
