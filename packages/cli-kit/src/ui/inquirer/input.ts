import {colors} from '../../node/colors.js'
// eslint-disable-next-line import/extensions
import Input from 'inquirer/lib/prompts/input.js'

export class CustomInput extends Input {
  protected render(error?: string): void {
    const color = colors.magenta
    const isFinal = this.status === 'answered'

    let prompt = this.getQuestion()

    let bottomContent = ''
    if (isFinal) {
      prompt += `${colors.dim('·')} ${color(this.answer)}`
    } else {
      prompt += `\n${color('>')} ${this.rl.line ? this.rl.line : color.dim(this.opt.default)}`
      if (error && !prompt.includes(error)) prompt += ` ${error}`
      bottomContent = '▔'.repeat(Math.max(this.rl.line.length, 30))
      bottomContent = `  ${color(bottomContent)}`
    }
    this.screen.render(prompt, bottomContent)
  }

  protected getQuestion() {
    return `${this.prefix()} ${colors.bold(this.opt.message)}${this.opt.suffix}${colors.reset(' ')}`
  }

  protected prefix() {
    const color = colors.magenta.bold
    return this.status === 'answered' ? color('✔') : color('?')
  }
}
