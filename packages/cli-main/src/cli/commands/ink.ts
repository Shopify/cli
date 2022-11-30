import Command from '@shopify/cli-kit/node/base-command'
import {renderOutputWithFooterMenu} from '@shopify/cli-kit/node/ui'
import { Writable } from 'node:stream'

export default class Ink extends Command {
  static description = 'Ink workshop command'
  static hidden = true

  async run(): Promise<void> {
    renderOutputWithFooterMenu({
      stdout: "Output",
      keyPressCallback: (key: string) => {
        console.log(`Key pressed: ${key}`)
      },
      menu: [{
        label: "first",
        key: "F"
      }, {
        label: 'second',
        key: 'S'
      }, {
        label: 'third',
        key: 'T'
      }]
    })
  }
}
