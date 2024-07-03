import {DevServerSession} from '../utilities/theme-environment/types.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {consoleLog} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {createInterface} from 'readline'

export async function repl(adminSession: AdminSession, storefrontToken: string) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    historySize: 1000,
  })

  readline.prompt()

  readline
    .on('line', (line) => {
      try {
        evaluate(line, adminSession, storefrontToken)
          .then((result) => {
            const regex = />([^<]+)</
            const match = result.match(regex)

            if (match && match[1]) {
              consoleLog(match[1])
            }

            readline.prompt()
          })
          .catch((err) => {
            consoleLog(`Error: ${err}`)
          })

        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (err) {
        consoleLog(`Error: ${err}`)
      }
    })
    .on('close', () => {
      consoleLog('Exiting REPL...')
      process.exit(0)
    })
}

export async function evaluate(snippet: string, adminSession: AdminSession, storefrontToken: string) {
  const session: DevServerSession = {
    //           ^------- consider renaming to theme session
    ...adminSession,
    storefrontToken,
    storefrontPassword: 'password',
    //                  ^------- use your store password here
    expiresAt: new Date(),
  }

  const response = await render(session, {
    path: '/',
    query: [],
    themeId: '163477618710',
    //       ^------- use the right theme here
    cookies: '',
    sectionId: 'announcement-bar',

    headers: {},
    replaceTemplates: {
      'sections/announcement-bar.liquid': `{{ ${snippet} }}`,
    },
  })

  return response.text()
}
