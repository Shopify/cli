import {CustomInput} from './input.js'
import {Question, Answers} from 'inquirer'
import {Interface} from 'readline'

export class CustomPassword extends CustomInput {
  constructor(questions: Question<Answers>, rl: Interface, answers: Answers) {
    super(questions, rl, answers)
    this.isPassword = true
  }
}
