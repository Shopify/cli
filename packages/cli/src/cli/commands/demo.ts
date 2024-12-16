import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AppInitCommand, AppDeployCommand} from '@shopify/app'
import {ListCommand, PullCommand, DevCommand} from '@shopify/theme'
import {renderTextPrompt, renderInfo, renderSelectPrompt, renderText} from '@shopify/cli-kit/node/ui'
import {developerDashboardFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {joinPath} from '@shopify/cli-kit/node/path'
import {exec} from '@shopify/cli-kit/node/system'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {outputNewline} from '@shopify/cli-kit/node/output'
import {PassThrough} from 'stream'
// just a chill demo
//                                        .-+.   .-=:
//                                     --. -. -:..:.
//                                     ..  -.-. :.:.
//                                     ..  .=. -. =
//                                     -: ..+:::.=.
//                            .::--===-:...:-.-.=.
//                    .::-=+*+=-..   .----:.   .+.
//           ...:-+*#*=:     :#**#= .::----=.    *.
//    :+%@@@@@@@@%.           .:-@#. ::+@%=       -
//   .#@@@@@@@@@@@*              =-    :*-        *.
//   =@@@@@@@@@@@@%.                              =.
//  .+@@@@@@@@@@@@@.                              :.
//  .*@@@@@@@@@@@@@.                              ..
//   +@@@@@@@@@@@@@.                              :.
//   -%@@@@@@@@@@@@.                              -.
//    +@@@@@@@@@@@@.                       ....   =.
//    .=%@@@@@@@@@=                     ... ..    +.
//      .+#@@@@@#-                    .:=++:      +.
//         .+#=:.               .:::=*=:..        -
//             .+#%*=:..:         ......          .
//                      *         :++:.        .+-=.
//                      -+*:              .=*=:+:   +
//                     .:  .+-      .  :. .=+        +
//                    .=                              =.
//                    +                        -:      =
//                   .: -                      :        -
//                   . :+                       :  .    =
//                   .  =                      .+       -
//                    =  +                     =        +
//                     : =+=.::..           ..=.       =.
//                      ==  =+--*+**####*#+=+===:     +.
//                       -    -::-++*+=-.       +*+=-..
//                       .*    ..:==:               .:.
//                        :         ==.             - .
//                        .=         .              - .
//                         -         :              =:.
//                         ..  ..     .             +-.
//                         .=         :             =+.
//                         .-          :            -#
//                          :     ...  --.::-::.....--=
//                                                    =
//                        ...-=++-::    :            -=
//                      .=     :----+**=-*#**++#***+--.
//                      =        ..+:::-=*+==-++-=:=::.
//                      =         --::+.       -+.::-=.
//                       ++.      ...=-          ::++*
//                        .:-==--:....:            :-
//                                     .-+=-:...-=:
//                                         .....

const APP_NAME_REGEX = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,28}[a-z0-9]$/

export default class Demo extends Command {
  static summary = 'Demo command to showcase CLI functionality'

  static description = 'Demo command that creates a new Shopify app'

  static flags = {
    ...globalFlags,
    name: Flags.string({
      char: 'n',
      description: 'App name',
      env: 'SHOPIFY_FLAG_NAME',
    }),
  }

  async run(): Promise<void> {
    // process.env.USE_APP_MANAGEMENT = '1'
    // why isnt this shit working

    await themeDemo()
    return

    await renderInfo({
      headline: 'Lets learn how to create and deploy a Shopify app!',
      customSections: [
        {
          body: {
            list: {
              items: [
                'This demo will walk you through how to use the CLI commands to create and deploy a Shopify app.',
                "We'll start by creating a new app and then we'll deploy it to the Shopify platform.",
                {
                  link: {
                    label: 'Learn more about creating Shopify apps',
                    url: 'https://shopify.dev/docs/apps/build/scaffold-app',
                  },
                },
                {
                  link: {
                    label: 'Learn more about deploying Shopify apps',
                    url: 'https://shopify.dev/docs/apps/launch/deployment/deploy-app-versions',
                  },
                },
                {bold: 'Completion Time: 5 minutes'},
              ],
            },
          },
        },
      ],
    })

    await renderTextPrompt({
      noUnderline: true,
      message: 'Run the `shopify app init` command to get started:',
      validate: (value) => {
        if (value !== 'shopify app init') return 'Thats not the `shopify app init` command!'
      },
    })

    const {app} = await AppInitCommand.run([])

    const appLink = await appDeepLink({
      id: app?.configuration?.app_id,
      organizationId: app?.configuration?.organization_id,
    })

    await renderInfo({
      headline: 'Good job you created an app!',
      customSections: [
        {
          body: {
            list: {
              items: [
                'When you chose an Organization, the app was created in that organization.',
                {
                  link: {
                    label: 'Go to the link below to see your app in the Developer Dashboard.',
                    url: appLink,
                  },
                },
                'Come back here when you are done, and we can make a change to the app!',
                {bold: 'Completion Time: 1 minute'},
              ],
            },
          },
        },
      ],
    })

    const appConfigPath = joinPath(app.directory, 'shopify.app.toml')
    const initialTOMLContents = await readFile(appConfigPath)
    // await renderInfo({
    //   body: ['Here is your app configuration:', {command: contents}],
    // })

    await exec('open', [appConfigPath])

    await renderInfo({
      body: ['You can now make changes to the app configuration file.'],
      customSections: [
        {
          title: "Let's make changes to your app!",
          body: {
            list: {
              items: [
                'The TOML file is a configuration file that contains the settings for your app.',
                'It lives in the root of your app directory and is named `shopify.app.toml`.',
                {
                  link: {
                    label: 'Learn more about the TOML app configuration file and ',
                    url: 'https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration',
                  },
                },
                {
                  link: {
                    label: 'You can also learn about managing multiple TOML files in your app',
                    url: 'https://shopify.dev/docs/apps/build/cli-for-apps/manage-app-config-files',
                  },
                },
              ],
            },
          },
        },
      ],
    })

    await renderSelectPrompt({
      message: 'Did you make changes to the app configuration file?',
      choices: [
        {label: 'Yes', value: 'Yes'},
        {label: 'No', value: 'No'},
      ],
      validate: async (value) => {
        if (value === 'No') {
          return 'Please make changes to the file and try again.'
        }

        if (value === 'Yes') {
          const currentTOMLContents = await readFile(appConfigPath)
          if (initialTOMLContents === currentTOMLContents) {
            return 'You indicated you made changes but the file has not changed. Please make changes to the file and try again.'
          }

          const nameMatch = currentTOMLContents.match(/^name\s*=\s*"([^"]+)"/m)
          const appName = nameMatch?.[1]

          if (!appName || !APP_NAME_REGEX.test(appName)) {
            return "App name can't start or end with hyphens and must be 1-30 lowercase letters, numbers or hyphens."
          }
        }
      },
    })

    await renderInfo({
      customSections: [
        {
          title: "Let's deploy our changes to our app!",
          body: {
            list: {
              items: [
                "By running the `shopify app deploy` command, we'll deploy our changes to the Shopify platform.",
                'Under the hood, this command will create a new version of the app and deploy it.',
                {bold: 'Completion Time: 2 minutes'},
              ],
            },
          },
        },
      ],
    })

    await renderTextPrompt({
      noUnderline: true,
      message: 'Run the `shopify app deploy` command to deploy your changes:',
      validate: (value) => {
        if (value !== 'shopify app deploy') return 'Thats not the `shopify app deploy` command!'
      },
    })

    await AppDeployCommand.run(['--path', app.directory])
  }
}

async function appDeepLink({
  id,
  organizationId,
}: {
  id: string | undefined
  organizationId: string | undefined
}): Promise<string> {
  if (!id || !organizationId) throw new Error('App ID and Organization ID are required')
  return `https://${await developerDashboardFqdn()}/dashboard/${organizationId}/apps/${numberFromGid(id)}`
}

function numberFromGid(gid: string): number {
  const match = gid.match(/^gid.*\/(\d+)$/)
  if (!match?.[1]) throw new Error('Invalid GID format')
  return Number(match[1])
}

async function themeDemo() {
  // assume authenticated with correct store / permissions

  await renderInfo({
    customSections: [
      {
        title: 'Lets learn how to use the Shopify CLI for Theme Development!',
        body: {
          list: {
            items: [
              "Let's start by listing all the themes on your store",
              {
                link: {
                  label: 'Learn more about using the Shopify CLI for Theme Development',
                  url: 'https://shopify.dev/docs/storefronts/themes/getting-started/customize',
                },
              },
              {bold: 'Completion Time: 5 minutes'},
            ],
          },
        },
      },
    ],
  })

  const currentStoreFlag = '--store montyteststore.myshopify.com'

  await renderTextPrompt({
    message: [
      'Run the',
      {command: `shopify theme list ${currentStoreFlag}`},
      'command to view all current themes on your store:',
    ],
    validate: (value) => {
      if (value !== `shopify theme list ${currentStoreFlag}`)
        return `Thats not the \`shopify theme list ${currentStoreFlag}\` command!`
    },
  })

  await ListCommand.run([])

  outputNewline()
  await renderInfo({
    customSections: [
      {
        title: 'Great! This command lists all of the current themes on your store.',
        body: {
          list: {
            items: [
              "Let's now choose a theme to work on",
              'We will create a new theme directory and pull the code for your live theme into it',
            ],
          },
        },
      },
    ],
  })

  await inTemporaryDirectory(async (_tmpDir) => {
    process.chdir(_tmpDir)
    await renderTextPrompt({
      message: ['Run the', {command: `shopify theme pull --live`}, 'command to pull the code for your live theme:'],
      validate: (value) => {
        if (value !== `shopify theme pull --live`) return `Thats not the \`shopify theme pull --live\` command!`
      },
    })
    await PullCommand.run(['--live', '--force', '--path', _tmpDir])

    await renderTextPrompt({
      message: ['Run the', {command: `ls`}, 'command to list the files in the theme directory:'],
      validate: (value) => {
        if (value !== `ls`) return `Thats not the \`ls\` command!`
      },
    })

    // probably a better way to `ls` lol
    const output = new PassThrough()
    let outputString = ''
    output.on('data', (data: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outputString += (data as any).toString() as string
    })
    await exec('ls', [_tmpDir], {
      stdout: output,
      stdio: undefined,
    })
    await renderText({text: outputString.replaceAll('\n', '\t')})

    await renderInfo({
      customSections: [
        {
          title: 'We now have all our theme files to work with!',
          body: {
            list: {
              items: [
                'You can make edits to your theme files locally, and push them up to your store when ready.',
                {
                  link: {
                    label: 'Learn more about the code contents of a shopify theme',
                    url: 'https://shopify.dev/docs/storefronts/themes/architecture',
                  },
                },
              ],
            },
          },
        },
      ],
    })

    await renderTextPrompt({
      message: [
        'Lets also spin up a local server to test our changes.',
        'Run the',
        {command: `shopify theme dev`},
        'command to start the local server:',
      ],
      validate: (value) => {
        if (value !== `shopify theme dev`) return `Thats not the \`shopify theme dev\` command!`
      },
    })

    await DevCommand.run(['--path', _tmpDir])
  })
}
