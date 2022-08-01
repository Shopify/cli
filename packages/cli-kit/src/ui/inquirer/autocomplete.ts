import {colors} from '../../node/colors.js'
import AutocompletePrompt from 'inquirer-autocomplete-prompt'
import DistinctChoice from 'inquirer/lib/objects/choices'

export class CustomAutocomplete extends AutocompletePrompt {
  protected render(error?: string, isAutocomplete = true) {
    let content = this.getQuestion()
    let bottomContent = ''

    if (this.status !== 'answered') {
      content += colors.gray('… ')
    }

    if (this.status === 'answered') {
      content += `${colors.dim('·')} ${colors.magenta(this.shortAnswer || this.answerName || this.answer)}`
    } else if (this.searching) {
      content += this.rl.line
      bottomContent += `  ${colors.magenta.dim('Searching...')}`
    } else if (this.nbChoices) {
      const choicesStr = listRender(this.currentChoices, this.selected)
      content += isAutocomplete ? this.rl.line : ''
      const indexPosition = this.selected
      let realIndexPosition = 0
      this.currentChoices.choices.every((choice, index: number) => {
        if (index > indexPosition) {
          return false
        }
        if (choice.type === 'separator') {
          return true
        }
        const name = choice.name
        realIndexPosition += name ? name.split('\n').length : 0
        return true
      })
      bottomContent += this.paginator.paginate(choicesStr, realIndexPosition, 10)
    } else {
      content += this.rl.line
      bottomContent += `  ${colors.magenta('No matching choices')}`
    }

    if (error) {
      bottomContent += `\n${colors.magenta('>> ')}${error}`
    }

    this.firstRender = false

    this.screen.render(content, bottomContent)
  }

  protected getQuestion(): string {
    return `${this.prefix()} ${colors.bold(this.opt.message)}${this.opt.suffix}${colors.reset(' ')}`
  }

  protected prefix(): string {
    const color = colors.magenta.bold
    return this.status === 'answered' ? color('✔') : color('?')
  }
}

function listRender(choices: DistinctChoice, pointer: number): string {
  let output = ''
  let separatorOffset = 0

  choices.forEach((choice, i: number) => {
    if (choice.type === 'separator') {
      separatorOffset++
      output += `  ${choice}\n`
      return
    }

    if (choice.disabled) {
      separatorOffset++
      output += `  - ${choice.name}`
      output += ` (${typeof choice.disabled === 'string' ? choice.disabled : 'Disabled'})`
      output += '\n'
      return
    }

    const isSelected = i - separatorOffset === pointer
    let line = (isSelected ? '> ' : '  ') + choice.name

    if (isSelected) {
      line = colors.magenta(line)
    }

    output += `${line} \n`
  })

  return output.replace(/\n$/, '')
}
