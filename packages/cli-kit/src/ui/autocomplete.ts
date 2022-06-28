// Enquirer types are totally broken so we need to disable typescript checks for this file
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {colors} from '../ui.js'
import enquirer from 'enquirer'

export class AutoComplete extends enquirer.AutoComplete {
  constructor(options) {
    const originalResult = options.result
    options.result = (value) => {
      const answer = this.focused.value || this.focused.name || value

      if (originalResult) {
        return originalResult(answer)
      }

      return answer
    }
    super(options)
    this.styles.primary = colors.magenta
    this.styles.em = colors.magenta
  }

  pointer(_choice: unknown, i: number) {
    const color = this.styles.primary
    const showPointer = !this.state.multiple && this.state.index === i
    return showPointer ? color('>') : ' '
  }

  prefix(_state: unknown) {
    const color = this.styles.primary.bold
    return this.state.status === 'submitted' ? color('✔') : color('?')
  }

  format() {
    if (!this.focused) return this.input
    if (this.options.multiple && this.state.submitted) {
      return this.selected.map((ch) => this.styles.primary(ch.message)).join(', ')
    }
    if (this.state.submitted) {
      this.value = this.focused.value
      this.input = this.focused.value
      return this.styles.primary(this.focused.name)
    }
    return this.input
  }
}
