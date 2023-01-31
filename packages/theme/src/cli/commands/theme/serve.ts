import Dev from './dev.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export default class Serve extends Dev {
  static hidden = true

  async run() {
    renderWarning({
      headline: ['The', {command: 'shopify theme serve'}, 'command is deprecated', {char: '.'}],
      body: ['Use', {command: 'shopify theme dev'}, 'instead', {char: '.'}],
    })

    await super.run()
  }
}
