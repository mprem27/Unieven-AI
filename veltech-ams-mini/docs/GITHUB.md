# Publish the project to GitHub

Create your own empty repository. Extract the full source ZIP and open PowerShell in the folder containing `package.json` and `compose.yaml`. Your Windows computer uses Docker Desktop; GitHub's hosted Linux CI runner below is independent and does not require an Ubuntu installation on your computer.

```powershell
git init
git add .
git status --short
git diff --cached --stat
git commit -m "Publish veltech-ams-mini"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Push `frontend`, `shared`, `services`, `docker`, `scripts`, `android` source/config example and lockfile, `docs`, `.github`, package/lock files, non-secret environment examples, PowerShell launchers and Compose files. Use the supplied `.gitignore`. Check the staged file list before committing.

Keep `.private`, real `.env` files, Atlas URIs/passwords, SMTP/VAPID/payment keys, student source captures, uploaded media/proofs, logs, `node_modules`, build outputs, APK/AAB files and Android signing keys outside Git. Preserve server/private-key backups separately. Signing certificates and `assetlinks.json` fingerprints are public; signing private keys are not. If a credential was committed, revoke/rotate it and clean repository history; deleting it in a later commit does not remove it from history.

The included CI workflow installs frozen dependencies, tests against a temporary Mongo fixture and builds the web app. CI tests use fictional records and do not log into AMS. It does not deploy or create production credentials. The workflow has been reviewed locally; a real GitHub Actions run occurs only after you push it.

Deploy using [deployment.md](deployment.md), then set the public HTTPS address for Android using [ANDROID.md](ANDROID.md). Do not deploy only `frontend/dist` and expect private AMS, events or community APIs to work: keep the campus API on the same public origin and the academic worker private.
