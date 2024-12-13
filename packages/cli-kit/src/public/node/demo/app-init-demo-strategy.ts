import {DemoStrategy, DemoContext, DemoPromptAugmentation} from './demo-strategy.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export class AppInitDemoStrategy implements DemoStrategy {
  async beforeCommand(): Promise<void> {
    await renderInfo({
      customSections: [
        {
          title: "Let's start by creating a basic app! You'll need to:",
          body: {
            list: {
              items: [
                'Pick a template flavor',
                'Choose an organization for app access',
                'Create new or link existing app',
                'Name your app',
              ],
              ordered: true,
            },
          },
        },
      ],
    })
  }

  promptAugmentations(_context?: DemoContext): {
    [key: string]: DemoPromptAugmentation
  } {
    return {
      templateFlavour: {
        beforePrompt: async () => {
          await renderInfo({
            customSections: [
              {
                body: [
                  'The first thing we need to do is pick a template flavour.',
                  "For the purposes of this demo, we'll pick the extension-only template flavour.",
                  {
                    list: {
                      items: [
                        {
                          link: {
                            label: 'Learn more about the extension-only templates here',
                            url: 'https://shopify.dev/docs/apps/build/scaffold-app#extension-only-templates',
                          },
                        },
                        {
                          link: {
                            label: 'Learn more about building a shopify app using Remix here',
                            url: 'https://shopify.dev/docs/apps/build/build?framework=remix',
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          })
        },
        validate: (value: string) => {
          if (value !== 'none') return "That's not the extension-only template flavour!" as string
        },
      },
      selectOrg: {
        beforePrompt: async () => {
          await renderInfo({
            body: [
              'The next thing we need to do is pick an organization for your app to be created in.',
              'This is the organization that contains stores that your app will be able to request access to.',
            ],
          })
        },
      },
      selectApp: {
        beforePrompt: async () => {
          await renderInfo({
            customSections: [
              {
                body: [
                  'Almost done, we just need to decide whether we are creating a new app or linking to an existing app in your organization. Since this is a demo, we will create a new app.',
                  {
                    link: {
                      label: 'You can decide later to link your codebase to an existing app. Read more here.',
                      url: 'https://shopify.dev/docs/apps/build/cli-for-apps/manage-app-config-files#link-and-configure-apps',
                    },
                  },
                ],
              },
            ],
          })
        },
      },
      selectAppName: {
        beforePrompt: async () => {
          await renderInfo({
            body: 'The last thing we need to do is name your app. Name it something creative!',
          })
        },
      },
      deployApp: {
        beforePrompt: async () => {
          await renderInfo({
            body: "Here we are releasing a new version of your app with updated app configuration modules. Select 'Yes, release this new version'.",
          })
        },
      },
    }
  }

  async afterCommand(): Promise<void> {
    await renderInfo({
      body: "Great! You've created your first app!",
    })
  }
}
