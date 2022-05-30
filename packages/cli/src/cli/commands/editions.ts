import {Command} from '@oclif/core'
import {output} from '@shopify/cli-kit'
import {Message, TokenizedString} from '@shopify/cli-kit/src/output'

export default class Editions extends Command {
  static description = 'Shopify editions'

  async run(): Promise<void> {
    output.info(
      output.content`${output.token.green(
        unindent(`
             _____ __                _ ____         ______    ___ __  _
            / ___// /_  ____  ____  (_) __/_  __   / ____/___/ (_) /_(_)___  ____  _____
            \\__ \\/ __ \\/ __ \\/ __ \\/ / /_/ / / /  / __/ / __  / / __/ / __ \\/ __ \\/ ___/
           ___/ / / / / /_/ / /_/ / / __/ /_/ /  / /___/ /_/ / / /_/ / /_/ / / / (__  )
          /____/_/ /_/\\____/ .___/_/_/  \\__, /  /_____/\\__,_/_/\\__/_/\\____/_/ /_/____/
                          /_/          /____/
              ____               __  ___          __
             / __ \\___ _   __   /  |/  /___  ____/ /__
            / / / / _ \\ | / /  / /|_/ / __ \\/ __  / _ \\
           / /_/ /  __/ |/ /  / /  / / /_/ / /_/ /  __/
          /_____/\\___/|___/  /_/  /_/\\____/\\__,_/\\___/
        `),
      )}`,
    )

    output.info(
      unindent(`


        Welcome to Dev Mode for the Summer 2022 Edition
        https://editions.shopify.dev ???? FIXME
      `),
    )
  }
}

function unindent(s: string): string {
  const lines = s.split('\n')
  // Remove empty lines at start and end
  if (lines[0].trim() === '') lines.shift()
  if (lines.at(-1).trim() === '') lines.pop()
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
  const numSpacesToCut = Math.min(...nonEmptyLines.map((line) => (/^[\s]*[^\s]/.exec(line)?.[0].length || 1) - 1))
  return lines.map((line) => line.slice(numSpacesToCut)).join('\n')
}
