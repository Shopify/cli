import {CustomInput} from './input.js'
import inquirer from 'inquirer'
import {Interface} from 'readline'

export class CustomPassword extends CustomInput {
  constructor(questions: inquirer.Question<inquirer.Answers>, rl: Interface, answers: inquirer.Answers) {
    super(questions, rl, answers)
    this.isPassword = true
  }
}
