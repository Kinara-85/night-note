# Night Note (version 2)

Plan at night, see it first thing in the morning.
This version of the code follows the architecture diagram and report:
**3-tier (planning) + event-driven (reminders)**, running as **two separate programs**.

---

## 1. How the code matches the diagram

| Diagram box | AWS service | File in this project |
|---|---|---|
| Web App | S3 + CloudFront | `public/index.html` |
| API Gateway | API Gateway | `api/server.js` |
| Login | Cognito | `api/auth.js` |
| Task API | Lambda | `api/taskApi.js` |
| Shared Database | DynamoDB | `shared/db.js` (files in `data/`) |
| save reminder → update schedule | EventBridge schedules | `shared/schedules.js` |
| Scheduler | EventBridge Scheduler | `reminders/scheduler.js` |
| Reminder Queue + Dead Letter Queue | SQS + SQS DLQ | `reminders/queue.js` |
| Notification Worker | Lambda | `reminders/worker.js` |
| Push Service | SNS → APNs / FCM | `reminders/pushService.js` (uses ntfy.sh) |
| Alarms + Logs | CloudWatch | `reminders/monitor.js` + `shared/logger.js` (files in `logs/`) |

**Program 1, the planning side:** `api/server.js` (+ auth, taskApi, web app)
**Program 2, the reminder side:** `reminders/service.js` (+ scheduler, queue, worker, push, monitor)
They never call each other. They share only the database files, plus the schedule list that the Task API updates.

---

## 2. First-time setup (Windows + VS Code)

1. Unzip this folder somewhere easy, e.g. your Desktop. Keep your old `night-note` folder as it is; this is a new one.
2. In VS Code: **File → Open Folder…** → choose this folder (you should see `package.json`, `api`, `reminders`…).
3. **Terminal → New Terminal**, then type:
   ```
   npm install
   ```
   (If you see "running scripts is disabled", switch the terminal to **Command Prompt** with the ⌄ arrow next to **+**.)

## 3. Run it

```
npm start
```
This starts **both programs**. The terminal shows lines starting with `API |` and `REMINDERS |`.
Open **http://localhost:3000** in your browser.

1. Click **"New here? Create an account"** and sign up with any email + a password (min 6 characters).
2. Add tasks under **Today** and **Plan for tomorrow**.
3. In **Reminder settings**:
   - Time zone is filled in for you (e.g. `Asia/Karachi`).
   - **Phone (device token):** type your ntfy topic, e.g. `nightnote-faiza-48213`. Subscribe to the same topic in the **ntfy** app on your phone.
   - Click **Save settings**. This also updates your reminder schedule.
4. Click **Morning brief**. Your phone should buzz within a few seconds.

To stop: click in the terminal and press **Ctrl + C**.

---

## 4. Demos for the viva / class

### A. Normal flow
Add tasks → **Morning brief** → phone buzzes. Tick all of today's tasks → **Nudge** → the terminal says *"all tasks done, nudge skipped"*.

### B. Failure → retry → Dead Letter Queue → alarm → resend
1. Turn **Wi-Fi off**, then click **Morning brief**.
2. The terminal shows `FAILED … Hidden for 10s, then retried`, then 30s, then 90s (**exponential backoff**).
3. After the 3rd retry fails: `moved to Dead Letter Queue`, then `[ALARM] …`.
4. Turn **Wi-Fi on**. Open a **second terminal** (click **+**) and type:
   ```
   npm run redrive
   ```
   The reminder goes back into the queue and is sent. Your phone buzzes.

### C. The Task API is down, but reminders still go out
Run the two programs in **two terminals** instead of `npm start`:
- Terminal 1: `npm run api`
- Terminal 2: `npm run reminders`

Then:
1. In the app, set **Nudge** to **2 minutes from now** and click **Save settings**. Make sure at least one of today's tasks is **not** ticked.
2. In Terminal 1 press **Ctrl + C**. The API is now stopped, and the web page stops working.
3. Wait. At the nudge time, Terminal 2 still shows `"nudge" … sent to phone`, and your phone buzzes.

This proves what the report says: *existing schedules keep firing even if the Task API is down.*

### D. No duplicate reminders
Each daily reminder is recorded in the **sent log** (`data/sentlog.json`). If the same message ever arrives twice, the Worker says *"already sent, skipped (duplicate)"*.

---

## 5. Settings (`config.js`)

| Setting | What it does |
|---|---|
| `DEMO_MODE` | `true`: retries after 10, 30, 90 seconds (quick to show). `false`: the real 1, 5, 15 minutes from the report |
| `ADMIN_NTFY_TOPIC` | Set an ntfy topic here to get the **ALARM** on your phone too |
| `FIRE_WINDOW_MINUTES` | If the app was off at reminder time, it still sends within this many minutes; later than that it skips |

## 6. Where things are saved
- `data/`: the database files (users, tasks, sent log), schedules, and the queue + dead letter queue. Delete this folder to start fresh.
- `logs/`: `api.log` and `reminders.log`, which record everything each program did.

## 7. What is still different from real AWS (be honest in the viva)
- Runs on one laptop: if the laptop is off, reminders stop. On AWS the services run 24/7.
- Each service is a local file or module that **behaves like** the AWS service; it is not the real one.
- ntfy.sh stands in for SNS → Apple/Google push. The "device token" is the ntfy topic.
- No web hosting: the web app is served by the API program instead of S3 + CloudFront.
