import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {languageServerJsonOutputSchema} from '../../services/language-server/types.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {FlagOutput} from '@shopify/cli-kit/node/base-command'
import {renderCommandEvent, runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {startServer} from '@shopify/theme-language-server-node'
import {Flags} from '@oclif/core'

export default class LanguageServer extends ThemeCommand {
  static jsonOutputSchema = languageServerJsonOutputSchema

  static summary = 'Start a Language Server Protocol server.'

  static descriptionWithMarkdown = `Starts the [Language Server](https://shopify.dev/docs/themes/tools/cli/language-server).

Communicates using Language Server Protocol (LSP) JSON-RPC messages on stdin and stdout, framed with Content-Length headers. CLI diagnostics use stderr.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    json: Flags.boolean({
      ...jsonFlag.json,
      description: 'Accepted for consistency. Preserves native LSP output and stderr diagnostics.',
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
