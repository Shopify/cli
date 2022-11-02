import {CustomAutocomplete} from './autocomplete.js'

import utils from 'inquirer/lib/utils/readline.js'
import inquirer from 'inquirer'
import {Interface} from 'readline'

export class CustomSelect extends CustomAutocomplete {
  constructor(questions: inquirer.Question<inquirer.Answers>, rl: Interface, answers: inquirer.Answers) {
    super(questions, rl, answers)
    this.isAutocomplete = false
  }

  onKeypress(event: {key: {name: string; ctrl: boolean}; value: string}) {
    let len
    const keyName = (event.key && event.key.name) || undefined

    if (keyName === 'down' || (keyName === 'n' && event.key.ctrl)) {
      len = this.nbChoices
      this.selected = this.selected < len - 1 ? this.selected + 1 : 0
      this.ensureSelectedInRange()
      super.render()
      utils.up(this.rl, 2)
    } else if (keyName === 'up' || (keyName === 'p' && event.key.ctrl)) {
      len = this.nbChoices
      this.selected = this.selected > 0 ? this.selected - 1 : len - 1
      this.ensureSelectedInRange()
      this.render()
    }
  }
}
