// Enquirer types are totally broken so we need to disable typescript checks for this file
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {colors} from '../../node/colors.js'
import enquirer from 'enquirer'

export class Input extends enquirer.StringPrompt {
  constructor(options) {
    super(options)
    this.styles.primary = colors.magenta
    this.styles.submitted = colors.magenta
    this.styles.danger = colors.red
    this.symbols.pointer = '!'
  }

  prefix(_state: unknown) {
    const color = this.styles.primary.bold
    return this.state.status === 'submitted' ? color('✔') : color('?')
  }

  async render() {
    const size = this.state.size
    const prefix = await this.prefix()
    const separator = await this.separator()
    const message = await this.message()
    const color = this.styles.primary

    let prompt = [prefix, message].filter(Boolean).join(' ')
    this.state.prompt = prompt

    const output = this.type === 'password' ? await this.formatPassword() : await this.format()
    const help = (await this.error()) || (await this.hint())

    const underline = '▔'.repeat(Math.max(color.unstyle(output).length - 10, 30))
    if (this.state.submitted) {
      prompt += ` ${separator} ${output}`
    } else {
      prompt += `\n${color('>')} ${output}\n  ${color(underline)}`
      if (help && !prompt.includes(help)) prompt += ` ${help}`
    }

    this.clear(size)
    this.write([prompt].filter(Boolean).join('\n'))
    this.restore()
  }

  formatPassword() {
    if (!this.keypressed) return ''
    const color = this.state.submitted ? this.styles.primary : this.styles.muted
    return color(this.symbols.asterisk.repeat(this.input.length))
  }
}
