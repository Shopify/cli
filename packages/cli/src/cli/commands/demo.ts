import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AppInitCommand} from '@shopify/app'
import {renderTextPrompt, renderInfo} from '@shopify/cli-kit/node/ui'
import {developerDashboardFqdn} from '@shopify/cli-kit/node/context/fqdn'

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

    const appInitCommand = AppInitCommand
    const {app} = await appInitCommand.run([])

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
