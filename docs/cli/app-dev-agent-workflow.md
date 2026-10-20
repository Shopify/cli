# App dev session files

`shopify app dev` writes one instance JSON file and one JSONL log under
`<app>/.shopify/dev/` for each app configuration. Agents can read these files when
dev was started in another terminal. There is no IPC endpoint or extra command.
Use the instance JSON's `logFile` field to find the log; filenames include an identity hash.

The instance JSON includes the PID, `sessionId`, URLs, `logFile`, and
`details.preview`. The preview contains:

- `state`: `starting`, `updating`, `ready`, or `error`.
- `message`: the current CLI status message, or `null` before one is available.
- `errors`: the current reported errors. Errors remain during retries and clear
  when the CLI reports success.

This is a snapshot of the CLI's reported state, not a health check or proof that a
specific edit has reached the store. Check new output and test the behaviour before
claiming success. Web-server and browser health require their own checks.

Each complete JSONL line contains `timestamp`, `source`, and `message`,
with `stream` or `level` where available. Keep a byte offset to read new lines.
Wait for an incomplete final line to finish. If `sessionId` in the instance JSON
changes, reset the offset: each new run clears the log. Logs have no size limit or
rotation, so a long session can produce a large file.

Process messages keep their terminal source, including extension handles. Changes
to the status message also produce a log record with source `app dev`. Terminal
colors, spinners, and screen redraws are not included.

## Agent workflow

1. Find the instance file for the intended app configuration and check its app and
   store details. Check the PID and lock heartbeat; a saved file alone does not prove
   the process is alive. A live PID blocks takeover even after the fixed 15-second
   stale interval. Stop an unresponsive owner before starting another instance.
2. Reuse an existing session. If none is available, run `shopify app dev` through
   the agent's background terminal facility. Supply the app, configuration, and
   store flags and use `--no-input` when setup and authentication are available.
3. If a second start reports `dev_instance_already_running`, read the reported
   instance and log. Do not stop a session started by the developer.
4. Make the change, read new output, inspect `details.preview`, and test the result
   in the development store. Use a bounded wait and report errors or timeouts.

Normal shutdown removes the instance record and retains the log until the next run.
SIGINT and SIGTERM cancel active dev work and wait for queued log writes before shutdown.
Crashes after startup recover automatically on the next start. If the CLI is killed during
the short lock-acquisition step, a `.lock.acquire` directory can remain. The next start
reports its path. Confirm that no other startup is running before removing that
directory and trying again.

A crash can leave stale metadata or an incomplete log. Keep these local files out
of commits and external reports; application output and local URLs can contain secrets.
