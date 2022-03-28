// Enquirer types are totally broken so we need to disable typescript checks for this file
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import enquirer from 'enquirer'
import * as colors from 'ansi-colors'

export class Select extends enquirer.Select {
  constructor(options) {
    options.result = (value) => {
      return this.focused.value || this.focused.name
    }
    super(options)
    this.styles.primary = colors.magenta
    this.styles.em = colors.magenta
  }

  pointer(_choice: any, i: number) {
    const color = this.styles.primary
    const showPointer = !this.state.multiple && this.state.index === i
    return showPointer ? color('>') : ' '
  }

  prefix(_state: any) {
    const color = this.styles.primary.bold
    return this.state.status === 'submitted' ? color('✔') : color('?')
  }
}
