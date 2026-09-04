import {CommandHelp, Help} from '@oclif/core'
import type {Command} from '@oclif/core'

type HelpSectionBody = Parameters<CommandHelp['section']>[1]
type HelpList = [string, string | undefined][]

function isHelpList(body: HelpSectionBody): body is HelpList {
  return Array.isArray(body) && body.every((entry): entry is [string, string | undefined] => Array.isArray(entry))
}

/**
 * Custom command-help renderer that relocates the `[env: ...]` metadata to the
 * end of a flag's description instead of the front.
 *
 * Since oclif 4.8, flag help renders the backing environment variable inline
 * *before* the description, e.g.:
 *
 *   -j, --json  [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
 *
 * Because Shopify CLI's `SHOPIFY_FLAG_*` names are long, that pushes the actual
 * description far to the right and hurts readability. We keep the information
 * (it's useful for scripting and agents) but move it to the end:
 *
 *   -j, --json
 *       Output the result as JSON.
 *       [env: SHOPIFY_FLAG_JSON]
 *
 * We do this by cloning each flag, clearing its `env`, and appending the env
 * label as a trailing summary line before delegating to oclif's own `flags()`
 * renderer. Flag sections then use oclif's multiline list layout so long env
 * labels get the full terminal width instead of being split inside the name.
 */
export class ShopifyCommandHelp extends CommandHelp {
  override section(header: string, body: HelpSectionBody): string {
    if (header.endsWith('FLAGS') && isHelpList(body)) {
      return super.section(
        header,
        this.renderList(body, {
          indentation: 2,
          multiline: true,
          stripAnsi: this.opts.stripAnsi,
        }),
      )
    }

    return super.section(header, body)
  }

  protected override description(): string | undefined {
    const command = this.command
    let description: string | undefined

    if (this.opts.hideCommandSummaryInDescription) {
      description = command.description?.split(/\r?\n/).at(-1) ?? ''
    } else if (command.description) {
      description = command.summary ? `${command.summary}\n\n${command.description}` : command.description
    }

    return description ? wrapDescription(description, (prose) => this.wrap(prose)) : undefined
  }

  protected flags(flags: Command.Flag.Any[]): [string, string | undefined][] | undefined {
    const relocated = flags.map((flag) => {
      if (!flag.env) return flag
      const description = flag.summary ?? flag.description ?? ''
      const envLabel = `[env: ${flag.env}]`
      return {
        ...flag,
        env: undefined,
        summary: description === '' ? envLabel : `${description}\n${envLabel}`,
      } as Command.Flag.Any
    })

    return super.flags(relocated)
  }
}

function wrapDescription(description: string, wrapProse: (prose: string) => string): string {
  const output: string[] = []
  let prose: string[] = []
  let insideCodeBlock = false

  const flushProse = () => {
    if (prose.length === 0) return
    output.push(wrapProse(prose.join('\n')))
    prose = []
  }

  for (const line of description.split(/\r?\n/)) {
    if (line.trimStart().startsWith('```')) {
      flushProse()
      output.push(line)
      insideCodeBlock = !insideCodeBlock
    } else if (insideCodeBlock) {
      output.push(line)
    } else {
      prose.push(line)
    }
  }
  flushProse()

  return output.join('\n')
}

/**
 * Custom help class, wired up via `oclif.helpClass` in this package's
 * `package.json`. It only swaps in {@link ShopifyCommandHelp}; everything else
 * uses oclif's default help behaviour.
 */
export default class ShopifyHelp extends Help {
  protected CommandHelpClass = ShopifyCommandHelp
}
