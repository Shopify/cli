import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderCommandEvent, runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {startServer} from '@shopify/theme-language-server-node'

export default class LanguageServer extends ThemeCommand {
  static summary = 'Start a Language Server Protocol server.'

  static descriptionWithMarkdown = `Starts the [Language Server](https://shopify.dev/docs/themes/tools/cli/language-server).

Communicates using Language Server Protocol (LSP) JSON-RPC messages on stdin and stdout, framed with Content-Length headers. CLI diagnostics use stderr.

The server does not support --json. SHOPIFY_FLAG_JSON does not change the protocol or CLI diagnostics. --json-schema is a separate inspection command and reports that no CLI JSON output schema is defined without starting the server. --no-input does not change the LSP transport.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
  }

  static multiEnvironmentsFlags: RequiredFlags = null

  async command() {
    startServer()
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
