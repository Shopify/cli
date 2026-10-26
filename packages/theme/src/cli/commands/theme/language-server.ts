import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {FlagOutput} from '@shopify/cli-kit/node/base-command'
import {renderCommandEvent, runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {startServer} from '@shopify/theme-language-server-node'
import {Flags} from '@oclif/core'

export default class LanguageServer extends ThemeCommand {
  static summary = 'Start a Language Server Protocol server.'

  static descriptionWithMarkdown = `Starts the [Language Server](https://shopify.dev/docs/themes/tools/cli/language-server).

Communicates using Language Server Protocol (LSP) JSON-RPC messages on stdin and stdout, framed with Content-Length headers. CLI diagnostics use stderr.

--json is accepted for consistency with other commands. The server already uses JSON, so --json and SHOPIFY_FLAG_JSON preserve the native LSP transport and CLI diagnostics. --json-schema is a separate inspection command and reports that no CLI JSON output schema is defined without starting the server. --no-input does not change the LSP transport.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    json: Flags.boolean({
      ...jsonFlag.json,
      description: 'Use native LSP JSON-RPC output (already enabled by default).',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = null

  async command() {
    startServer()
  }

  protected runWithParsedOutput<T>(_flags: FlagOutput, execute: () => T): T {
    // The JSON flag acknowledges native LSP output; CLI diagnostics retain their text context.
    return execute()
  }

  protected async _run<T>(): Promise<T> {
    // Stdout belongs to LSP, including when CLI parsing or initialization fails.
    return runWithCommandEvents(
      {
        outputMode: 'text',
        sink: (event, options) => {
          if (!options?.alreadyRendered) renderCommandEvent(event)
        },
      },
      () => super._run<T>(),
    )
  }
}
