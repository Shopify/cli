# Dev Instance files

Long-running dev commands write an instance JSON file and a JSONL log under
`<project>/.shopify/dev/`. Agents can read these files when dev was started in
another terminal. There is no IPC endpoint or extra command.

The instance JSON includes the command, project directory, PID, `sessionId`,
`status`, `logFile`, and command-specific `details`. `status` is `starting` or
`running`. Use `logFile` to find the log; filenames include an identity hash.
A saved instance file alone does not prove that the process is alive. Check its
PID and lock heartbeat before reusing the session.

## Read new output

Each complete JSONL line contains `timestamp` and `message`, with `source` and
`level` where available. Terminal colors, spinners, and screen redraws are excluded.
Keep a byte offset to read new lines. Wait for an incomplete final line to finish.
If `sessionId` in the instance JSON changes, reset the offset: each new run clears
the log. Logs have no size limit or rotation.

## Agent workflow

1. Find the instance JSON for the intended command and configuration. Check its
   identity details, PID, and lock heartbeat.
2. Reuse an existing session. If none is available, start the dev command through
   the agent's background terminal facility. Supply the required configuration and
   store flags and use `--no-input` when setup and authentication are available.
3. If a second start reports `dev_instance_already_running`, read the reported
   instance and log. Do not stop a session started by the developer.
4. Make the change, read new output, inspect the command-specific status, and test
   the result. Use a bounded wait and report errors or timeouts.

Reported status is a snapshot of the CLI's state, not a health check or proof that
an edit has reached the store. Web-server and browser health require their own checks.

## Shutdown and recovery

Normal shutdown removes the instance JSON and lock, and retains the log until the
next run. Ctrl+C cancels dev work and waits for queued log writes. On Unix,
SIGINT and SIGTERM use the same shutdown path. Sending these signals through
`process.kill()` on Windows forces termination and does not drain queued writes.

A live PID blocks takeover, including after the fixed 15-second stale interval.
Stop an unresponsive owner before starting another instance. Crashes after
startup recover automatically on the next start. If the CLI is killed during the
short lock-acquisition step, a `.lock.acquire` directory can remain. The next
start reports its path. Confirm that no other startup is running before removing
that directory and trying again.

A crash can leave stale metadata or an incomplete log. Keep these local files out
of commits and external reports; output and local URLs can contain secrets.

## App dev

`shopify app dev` owns one session per app configuration. The instance details
include the app configuration, app identity, store, URLs, and `preview`.

Use `shopify app dev --json-schema` to inspect the contract. `definitions.DevInstance`
describes the saved instance JSON, and `definitions.DevPreview` describes
`details.preview`. `definitions.Result` describes each JSONL stream record.
The instance metadata is stored in the file; it is not added to the JSONL stream.
Preview errors remain during retries and clear when the CLI reports success.

Process messages keep their terminal source, including extension handles.
Changes to the status message also produce a log record with source `app dev`.

With `--json`, dev stream records use identical JSONL bytes in stdout and the session
log. The log contains process output, preview URLs, and session status messages.
CLI setup messages and other diagnostics use stderr. Fatal CLI errors use the
standard JSON error output on stdout and are not added to the session log.

## Theme dev

`shopify theme dev` owns one session per store and theme ID in a directory.
Sessions for different listings of the same store and theme cannot run together.
Different stores or theme IDs can run together.

The instance details include `store`, `themeId`, `themeName`, `listing` when set,
`host`, `port`, and `urls` with `local`, `preview`, `themeEditor`, and `giftCard`
links. URLs are added during setup. The instance status becomes `running` after
the server is listening and initial synchronization has completed.

The log includes theme dev messages, file synchronization results, request lines,
errors, and setup progress. Theme records omit the redundant `source` field.
Authentication before the session and fatal CLI errors reported after it are
outside this log.

With `--json`, the session writes identical JSONL bytes to stdout and the log.
Each record contains `timestamp` and `message`, without `type`, `stream`, or
`source`. Request and file synchronization messages omit terminal timestamps,
decoration, and alignment spaces. Request paths are not truncated in JSON mode.
Setup diagnostics use stderr; fatal CLI errors use the standard JSON
error envelope on stdout and are not added to the log. There is no final success
result. Use `--json --no-input` for unattended runs and `--json-schema` to inspect
the stream record and error schemas.
