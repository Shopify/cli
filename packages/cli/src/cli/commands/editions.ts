import {Command} from '@oclif/core'
import {output, ui} from '@shopify/cli-kit'

type Choice = 'bfs' | 'hydrogen' | 'devtools'

const subcommands: {[key in Choice]: () => void | Promise<void>} = {
  bfs: () => {
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
  devtools: () => {
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
  hydrogen: () => {
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
  static hidden = true

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

    const answer: {editionschoice: Choice} = await ui.prompt([
      {
        name: 'editionschoice',
        type: 'select',
        message: 'What are you looking to solve?',
        choices: [
          {
            value: 'bfs',
            name: 'NEW WAYS TO BUILD GREAT APPS',
          },
          {
            value: 'devtools',
            name: 'IMPROVED DEV TOOLS',
          },
          {
            value: 'hydrogen',
            name: 'NEXT LEVEL STOREFRONT BUILDING',
          },
        ],
      },
    ])

    await subcommands[answer.editionschoice]?.()
    output.info(`\n\n\n`)
  }
}

function unindent(value: string): string {
  const lines = value.split('\n')
  // Remove empty lines at start and end
  if (lines[0].trim() === '') lines.shift()
  if (lines.at(-1)?.trim() === '') lines.pop()
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
  const numSpacesToCut = Math.min(...nonEmptyLines.map((line) => (/^[\s]*[^\s]/.exec(line)?.[0].length || 1) - 1))
  return lines.map((line) => line.slice(numSpacesToCut)).join('\n')
}
