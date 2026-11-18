// ============================================================
// shared/time.js — Dates and times in each USER'S OWN time zone.
// (Users can live in different countries, so "7:00 am" is local.)
// ============================================================

// Returns { date: "2026-11-05", minutes: 420, hhmm: "07:00" } for a time zone.
function localNow(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  const hh = get("hour"), mm = get("minute");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(hh) * 60 + Number(mm),
    hhmm: `${hh}:${mm}`,
  };
}

// "2026-11-05" -> "2026-11-06"
function nextDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

// "07:30" -> 450
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

module.exports = { localNow, nextDay, toMinutes, isValidTimeZone };
