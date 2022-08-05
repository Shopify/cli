import {CustomInput} from './inquirer/input.js'
import {CustomAutocomplete} from './inquirer/autocomplete.js'
import {CustomSelect} from './inquirer/select.js'
import {CustomPassword} from './inquirer/password.js'
import {Question} from '../ui.js'
import inquirer, {Answers, QuestionCollection} from 'inquirer'
import fuzzy from 'fuzzy'

export function getMapper(): (question: Question) => unknown {
  return inquirerMapper
}

export async function run<
  TName extends string & keyof TAnswers,
  TAnswers extends {[key in TName]: string} = {[key in TName]: string},
>(question: unknown): Promise<TAnswers> {
  const questionName = (question as Question).name
  return (await inquirer.prompt(question as QuestionCollection<Answers>, {...(question as Question).choices}))[
    questionName
  ]
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
        source: getAutompleteFilterType(),
      }
    case 'autocomplete':
      inquirer.registerPrompt('autocomplete', CustomAutocomplete)
      return {
        ...question,
        type: 'autocomplete',
        source: getAutompleteFilterType(),
      }
  }
}

function fuzzyFilter(answers: {name: string; value: string}[], input = '') {
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

function containsFilter(answers: {name: string; value: string}[], input = '') {
  return new Promise((resolve) => {
    resolve(Object.values(answers).filter((answer) => answer.name.includes(input)))
  })
}

function getAutompleteFilterType() {
  return process.env.SHOPIFY_USE_AUTOCOMPLETE_FILTER === 'fuzzy' ? fuzzyFilter : containsFilter
}
