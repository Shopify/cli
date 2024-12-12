import {DemoStrategy, DemoContext} from './demo-strategy.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export class AppInitDemoStrategy implements DemoStrategy {
  async beforeCommand() {
    await renderInfo({
      body: "Let's create a basic app...",
    })
  }

  promptAugmentations(_context?: DemoContext) {
    return {
      templateFlavour: {
        beforePrompt: async () => {
          await renderInfo({
            body: "Let's pick a template flavour...",
          })
        },
        validate: (value: string) => {
          if (value !== 'none') return "That's not the `none` template flavour!" as string
        },
      },
      // orgSwitcher: ...
    }
  }

  async afterCommand() {
    await renderInfo({
      body: "Great! You've created your first app!",
    })
  }
}
