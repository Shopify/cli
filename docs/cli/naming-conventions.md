## Reserved commands and flags

We’ve designated a list of globally reserved flags to keep common developer commands consistent across the CLI, regardless of module. This doesn't mean that every option needs to be implemented in every module; it means that if your module does implement a feature on this list, then it should use these conventions.

Command/Flag    | Short form(s)     | Action
---             | ---               | ---
`help`          | `--help`, `-h`    | Display detailed help text for a given command.
`init`          |                   | Create a new project type (app, storefront, etc).
`version`       | `--version`, `-v` | Display the CLI version.
`--dry-run`     | `-n`              | For create, update, or delete actions, return and display what would happen when running this command, but don’t modify any local or remote files.
`--quiet`       | `-q`              | Run the command without additional output to the terminal. If the command returns some value, output it to the terminal with no additional text.
`--verbose`     |                   | Print additional contextual information to the terminal during output.
`--debug`       | `-d`              | Print debug information to the terminal during output.
`--ci`          |                   | Run the command with CI-compatible output.
`--path`        |                   | Run the command in this directory context.
`--port <n>`    | `-p`              | When running a server, expose the specified port _n_.
`--json`        |                   | Return command output as JSON.
`--no-color`    |                   | Deactivate all color in the terminal output.
`--store`       | `-s`              | Development store URL.
