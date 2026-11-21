# Night Note

Night Note is a simple to-do and reminder app. The idea is: **plan your tasks at night, and see them first thing in the morning.**

I built this app for my DevOps course at IBA. This repository shows a **CI/CD pipeline** that takes a code change all the way to the live app on AWS, automatically.

## How the pipeline works

When I push a change to GitHub, this happens by itself:

1. **Unit tests** run. If a test fails, the pipeline stops.
2. **Security scan** runs (CodeQL + npm audit).
3. The app is **built** into a zip file.
4. The zip is **uploaded to an AWS S3 bucket**.
5. My **EC2 server** downloads the latest zip from S3 and restarts the app.
6. The pipeline **checks the live app** to make sure the new version is running.

```
Code change → Git push → Tests + Security scan → Build → S3 → EC2 → Live app
```

The pipeline file is here: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

## Tools used

- **GitHub Actions** for the pipeline
- **AWS S3** to store each build
- **AWS EC2** to run the app
- **Node.js + Express** for the app
- **CodeQL** and **npm audit** for security checks

## Folders

| Folder | What's inside |
|---|---|
| `public/` | The web page |
| `api/` | Login and tasks |
| `reminders/` | Sends the reminders |
| `shared/` | Code used by both parts |
| `test/` | Unit tests |
| `ec2/` | Script to set up the EC2 server |

## Run it on your own computer

```
npm install
npm test
npm start
```

Then open http://localhost:3000
