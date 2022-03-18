// Enquirer types are totally broken so we need to disable typescript checks for this file
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import enquirer from 'enquirer'
import * as colors from 'ansi-colors'

export class Input extends enquirer.StringPrompt {
  constructor(options) {
    super(options)
    this.styles.primary = colors.magenta
    this.styles.submitted = colors.magenta
  }

  prefix(state: any) {
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

    let output = await this.format()
    const help = (await this.error()) || (await this.hint())

    if (help && !output.includes(help)) output += ` ${help}`

    if (this.state.submitted) {
      prompt += ` ${separator} ${output}`
    } else {
      prompt += `\n${color('>')} ${output}`
    }

    this.clear(size)
    this.write([prompt].filter(Boolean).join('\n'))
    this.restore()
  }
}
