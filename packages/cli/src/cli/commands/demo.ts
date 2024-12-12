import {AppInitDemoStrategy} from '../demo/app-init-demo-strategy.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AppInitCommand} from '@shopify/app'
import {renderTextPrompt, renderInfo} from '@shopify/cli-kit/node/ui'

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
    appInitCommand.setDemoStrategy(new AppInitDemoStrategy())
    await appInitCommand.run([])
  }
}
