---
'@shopify/app': patch
---

Fixed stale lockfile handling for function extension builds. When a build process crashes or is interrupted (SIGINT/SIGTERM/SIGHUP), the `.build-lock` directory could be left behind causing subsequent builds to hang. The fix adds proactive stale lock detection on startup and signal handlers to release locks on abnormal termination.
