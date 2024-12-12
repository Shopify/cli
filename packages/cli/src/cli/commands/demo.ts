import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AppInitCommand, AppDeployCommand} from '@shopify/app'
import {renderTextPrompt, renderInfo, renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {developerDashboardFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {joinPath} from '@shopify/cli-kit/node/path'
import {exec} from '@shopify/cli-kit/node/system'
import {readFile} from '@shopify/cli-kit/node/fs'

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

    await renderInfo({
      customSections: [
        {
          title: 'Lets learn how to create and deploy a Shopify app!',
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
      customSections: [
        {
          title: 'Good job you created an app!',
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
