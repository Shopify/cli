# App dev session files

`shopify app dev` writes one instance JSON file and one JSONL log under
`<app>/.shopify/dev/` for each app configuration. Agents can read these files when
dev was started in another terminal. There is no IPC endpoint or extra command.

The instance JSON includes the PID, `sessionId`, URLs, `logFile`, and
`details.preview`. The preview contains:

- `state`: `starting`, `updating`, `ready`, or `error`.
- `message`: the current CLI status message, or `null` before one is available.
- `errors`: the current reported errors. Errors remain during retries and clear
  when the CLI reports success.

This is a snapshot of the CLI's reported state, not a health check or proof that a
specific edit has reached the store. Check new output and test the behaviour before
claiming success. Web-server and browser health require their own checks.

Each complete JSONL line contains `sessionId`, `timestamp`, `source`, and `message`,
with `stream` or `level` where available. Keep a byte offset to read new lines.
Wait for an incomplete final line to finish. If the session ID changes, reset the
offset: each new run clears the log. Logs have no size limit or rotation, so a long
session can produce a large file.

## Agent workflow

1. Find the instance file for the intended app configuration and check its app and
   store details. Use the original PID and lock-heartbeat checks; a saved file alone
   does not prove the process is alive. The stale interval is fixed at 30 seconds.
2. Reuse an existing session. If none is available, run `shopify app dev` through
   the agent's background terminal facility. Supply the app, configuration, and
   store flags and use `--no-input` when setup and authentication are available.
3. If a second start reports `dev_instance_already_running`, read the reported
   instance and log. Do not stop a session started by the developer.
4. Make the change, read new output, inspect `details.preview`, and test the result
   in the development store. Use a bounded wait and report errors or timeouts.

Normal shutdown removes the instance record and retains the log until the next run.
A crash can leave stale metadata or an incomplete log. Keep these local files out of
commits and external reports; application output and local URLs can contain secrets.
