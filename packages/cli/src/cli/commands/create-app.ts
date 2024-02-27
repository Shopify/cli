import Command from '@shopify/cli-kit/node/base-command'

// This file is added just to hide the `create-app` command that is added automatically by @shopify/create-app
export default class Index extends Command {
  static hidden = true

  async run(): Promise<void> {}
}
