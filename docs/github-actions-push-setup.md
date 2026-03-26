# GitHub Actions Push Sender Setup (Free Option)

This setup avoids Firebase Functions billing by using GitHub Actions cron.

## 1) Add GitHub Secret

Create a Firebase service account key JSON with Firestore access and add it as a secret:

- Secret name: FIREBASE_SERVICE_ACCOUNT
- Secret value: entire JSON content (one line or multiline)

How to add:

- GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret
- Name: FIREBASE_SERVICE_ACCOUNT
- Value: paste service account JSON

## 2) Grant required Firestore permissions

The service account should be able to:

- read articles
- read and delete pushTokens
- read/write system/pushSenderState

## 3) Workflow behavior

File: .github/workflows/push-sender.yml

- Runs every 15 minutes
- Also supports manual run (workflow_dispatch)
- Sends push only when a new latest article appears
- Cleans up invalid Expo tokens (DeviceNotRegistered)

## 4) Test

- Push this code to GitHub
- In Actions tab, run `Push Sender Cron` manually
- Check run logs for `[push-cron] Sent notification...`
- Confirm phone receives notification while app is closed

## 5) Notes

- This option can work with zero cost for small usage within GitHub Actions free minutes.
- Private repos have monthly minute limits.
- If your usage grows, move to a dedicated backend (Firebase Functions, Render, Railway, etc.).
