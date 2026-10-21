# Theme dev session files

`shopify theme dev` writes instance metadata and a JSONL log under
`<theme>/.shopify/dev/`. Agents can read these files to find a session started in
another terminal. No IPC endpoint or extra command is required.

Each instance uses the store and theme ID as its key. Two sessions for the same
store and theme in the same directory cannot run together, including sessions
with different listings. Different stores or theme IDs can run together.

The instance JSON includes the PID, `sessionId`, `logFile`, and `status`:

- `starting`: the CLI is preparing the session or synchronizing the theme.
- `running`: the server is listening and initial synchronization has completed.

`details` contains `store`, `themeId`, `themeName`, `listing` when set, `host`,
`port`, and `urls` with `local`, `preview`, `themeEditor`, and `giftCard` links.
The URLs are added during setup. `running` is not a health check or proof that
later edits have reached the store. Read new output and test the result.

The log contains theme dev messages, file synchronization results, request lines,
errors, and setup progress. Each complete line contains `timestamp`, `source`,
and `message`. Colors and progress redraws are excluded. Authentication before
the dev session and fatal CLI errors reported after it are outside this log.

Read the instance JSON's `logFile` field to find the log. Keep a byte offset to
read new complete lines. Reset the offset if `sessionId` changes: each new run
clears the log. Logs have no size limit or rotation.

Before starting another session, check the PID and lock heartbeat. If a second
start reports `dev_instance_already_running`, use the reported session files.
Do not stop a session started by the developer. The shared lock recovery and
interrupted-start cleanup rules are described in [App dev session files](app-dev-agent-workflow.md).

Ctrl+C and SIGTERM stop dev work and drain queued log messages before exit.
Normal shutdown removes the instance JSON and lock, and retains the log.
