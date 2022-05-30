import {Command} from '@oclif/core'
import {output, ui} from '@shopify/cli-kit'

enum Choice {
  BFS,
  Hydrogen,
  DevTools,
}

const subcommands: Record<Choice, () => void | Promise<void>> = {
  [Choice.BFS]: () => {
    output.info(
      unindent(`
        - Built for Shopify: Build great commerce apps that look and perform like they’re part of Shopify
        - Shopify Functions: New ways to extend Shopify: Build custom discounts, shipping, and payments
        - Checkout Extensibility: Apps for checkout are here: Powerful customizations that work with Shop Pay
      `),
    )
    output.info(`\n\n`)
    output.info(output.content`${output.token.yellow('Read more here: https://shopify.com/editions/dev#chapter-1')}`)
  },
  [Choice.DevTools]: () => {
    output.info(
      unindent(`
        - Developer Experience: Simplified updates to write and distribute an app
        - Embedded App Improvements: Offer a truly seamless app experience
        - Data Protection: Future-proof the apps you build
      `),
    )
    output.info(`\n\n`)
    output.info(output.content`${output.token.yellow('Read more here: https://shopify.com/editions/dev#chapter-2')}`)
  },
  [Choice.Hydrogen]: () => {
    output.info(
      unindent(`
        - Hydrogen + Oxygen: The Shopify stack for headless commerce
        - Pixels: Intelligent interactions—powered by secure data
        - Marketplace Kit: Add commerce to any platform
      `),
    )
    output.info(`\n\n`)
    output.info(output.content`${output.token.yellow('Read more here: https://shopify.com/editions/dev#chapter-3')}`)
  },
}
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
        https://shopify.com/editions/dev


      `),
    )

    const answer = await ui.prompt([
      {
        name: 'editionschoice',
        type: 'select',
        message: 'What are you looking to solve?',
        choices: [
          {
            value: Choice[Choice.BFS],
            name: 'NEW WAYS TO BUILD GREAT APPS',
          },
          {
            value: Choice[Choice.DevTools],
            name: 'IMPROVED DEV TOOLS',
          },
          {
            value: Choice[Choice.Hydrogen],
            name: 'NEXT LEVEL STOREFRONT BUILDING',
          },
        ],
      },
    ])

    await subcommands[Choice[answer.editionschoice]]?.()
    output.info(`\n\n\n`)
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
