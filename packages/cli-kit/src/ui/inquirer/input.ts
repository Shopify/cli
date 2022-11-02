import colors from '../../public/node/colors.js'
import Input from 'inquirer/lib/prompts/input.js'
import inquirer from 'inquirer'
import readline, {Interface} from 'readline'

export class CustomInput extends Input {
  protected isPassword: boolean

  constructor(questions: inquirer.Question<inquirer.Answers>, rl: Interface, answers: inquirer.Answers) {
    super(questions, rl, answers)
    this.isPassword = false
  }

  protected render(error?: string): void {
    const color = colors.magenta
    const isFinal = this.status === 'answered'

    let prompt = this.getQuestion()

    let bottomContent = ''
    if (isFinal) {
      prompt += `${colors.dim('·')} ${color(this.formatContent(this.answer))}`
    } else {
      prompt += `\n${color('>')} ${this.rl.line ? this.formatContent(this.rl.line) : color.dim(this.opt.default)}`
      bottomContent = '─'.repeat(Math.max(this.rl.line.length, 30))
      bottomContent = `  ${color(bottomContent)}`
      if (error) {
        bottomContent += `\n\n  ${colors.red(`! ${error}`)}`
      }
    }
    this.screen.render(prompt, bottomContent)
    if (!isFinal && !this.rl.line) {
      readline.cursorTo(process.stdout, 2)
    }
  }

  protected getQuestion() {
    return `${this.prefix()} ${colors.bold(this.opt.message)}${this.opt.suffix}${colors.reset(' ')}`
  }

  protected prefix() {
    const color = colors.magenta.bold
    return this.status === 'answered' ? color('✔') : color('?')
  }

  protected onError(data: {isValid: string; value: string}) {
    this.rl.write(data.value === this.opt.default ? '' : data.value)
    this.render(data.isValid)
  }

  private formatContent(content: string): string {
    return this.isPassword ? colors.gray('*'.repeat(content.length)) : content
  }
}
