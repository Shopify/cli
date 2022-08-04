import {AutoComplete} from './enquirer/autocomplete.js'
import {Input} from './enquirer/input.js'
import {Select} from './enquirer/select.js'
import {CustomInput} from './inquirer/input.js'
import {CustomAutocomplete} from './inquirer/autocomplete.js'
import {CustomSelect} from './inquirer/select.js'
import {CustomPassword} from './inquirer/password.js'
import {isTruthy} from '../environment/utilities.js'
import {Question} from '../ui.js'
import inquirer, {Answers, QuestionCollection} from 'inquirer'
import enquirer from 'enquirer'
import fuzzy from 'fuzzy'

export function getMapper(): (question: Question) => unknown {
  return isEnquirer() ? enquirerMapper : inquirerMapper
}

export async function run<
  TName extends string & keyof TAnswers,
  TAnswers extends {[key in TName]: string} = {[key in TName]: string},
>(question: unknown): Promise<TAnswers> {
  const questionName = (question as Question).name
  if (isEnquirer()) {
    // eslint-disable-next-line no-return-await
    return await (question as enquirer.Prompt).run()
  } else {
    return (await inquirer.prompt(question as QuestionCollection<Answers>, {...(question as Question).choices}))[
      questionName
    ]
  }
}

function inquirerMapper(question: Question): unknown {
  switch (question.type) {
    case 'input':
      inquirer.registerPrompt('custom-input', CustomInput)
      return {
        ...question,
        type: 'custom-input',
      }
    case 'password':
      inquirer.registerPrompt('custom-password', CustomPassword)
      return {
        ...question,
        type: 'custom-password',
      }
    case 'select':
      inquirer.registerPrompt('custom-select', CustomSelect)
      return {
        ...question,
        type: 'custom-select',
        source: filterByName,
      }
    case 'autocomplete':
      inquirer.registerPrompt('autocomplete', CustomAutocomplete)
      return {
        ...question,
        type: 'autocomplete',
        source: filterByName,
      }
  }
}

function enquirerMapper(question: Question): unknown {
  switch (question.type) {
    case 'input':
    case 'password':
      return new Input(question)
    case 'select':
      return new Select(question)
    case 'autocomplete':
      return new AutoComplete(question)
    default:
      return undefined
  }
}

function filterByName(answers: {name: string; value: string}[], input = '') {
  return new Promise((resolve) => {
    resolve(
      fuzzy
        .filter(input, Object.values(answers), {
          extract(el: {name: string; value: string}) {
            return el.name
          },
        })
        .map((el) => el.original),
    )
  })
}

function isEnquirer(): boolean {
  return isTruthy(process.env.SHOPIFY_USE_ENQUIRER)
}
