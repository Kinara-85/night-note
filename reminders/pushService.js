// ============================================================
// reminders/pushService.js — THE PUSH SERVICE
// In the cloud this would be: Amazon SNS, which forwards to
// Apple (APNs) for iPhones or Google (FCM) for Android.
//
// Here we use ntfy.sh, a free push service. The user's
// "device token" is their ntfy topic name, and the ntfy app on
// the phone receives the notification (it works on iPhone and Android).
// ============================================================

const config = require("../config");

class NoDeviceError extends Error {}

async function publish(user, title, text) {
  if (!user.deviceToken) {
    throw new NoDeviceError("no phone registered for this user");
  }
    const res = await fetch(`${config.PUSH_SERVER}/${user.deviceToken}`, {
    method: "POST",
    headers: { Title: title },
    body: text,
    signal: AbortSignal.timeout(10000), // give up after 10 seconds
  });
  if (!res.ok) throw new Error(`push service replied ${res.status}`);
}

// Used by the alarm to alert the admin.
async function publishToTopic(topic, title, text) {
  const res = await fetch(`${config.PUSH_SERVER}/${topic}`, {
    method: "POST",
    headers: { Title: title, Priority: "high" },
    body: text,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`push service replied ${res.status}`);
}

module.exports = { publish, publishToTopic, NoDeviceError };
