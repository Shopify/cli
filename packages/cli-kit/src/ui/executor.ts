import {CustomInput} from './inquirer/input.js'
import {CustomAutocomplete} from './inquirer/autocomplete.js'
import {CustomSelect} from './inquirer/select.js'
import {CustomPassword} from './inquirer/password.js'
import {PromptAnswer, Question, QuestionChoiceType} from '../ui.js'
import inquirer, {Answers, QuestionCollection} from 'inquirer'
import fuzzy from 'fuzzy'

export async function run<
  TName extends string & keyof TAnswers,
  TAnswers extends {[key in TName]: string} = {[key in TName]: string},
>(question: unknown): Promise<TAnswers> {
  const questionName = (question as Question).name
  return (await inquirer.prompt(question as QuestionCollection<Answers>, {...(question as Question).choices}))[
    questionName
  ]
}

export function mapper(question: Question): unknown {
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
        source: getAutocompleteFilterType(),
        choices: question.choices ? groupAndMapChoices(question.choices) : undefined,
      }
    case 'autocomplete':
      inquirer.registerPrompt('autocomplete', CustomAutocomplete)
      const filterType = getAutocompleteFilterType()
      return {
        ...question,
        type: 'autocomplete',
        source: question.source ? question.source(filterType) : filterType,
      }
  }
}

function fuzzyFilter(answers: {name: string; value: string}[], input = ''): Promise<PromptAnswer[]> {
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

function containsFilter(answers: {name: string; value: string}[], input = ''): Promise<PromptAnswer[]> {
  return new Promise((resolve) => {
    resolve(Object.values(answers).filter((answer) => !answer.name || answer.name.includes(input)))
  })
}

function getAutocompleteFilterType() {
  return process.env.SHOPIFY_USE_AUTOCOMPLETE_FILTER === 'fuzzy' ? fuzzyFilter : containsFilter
}

export function groupAndMapChoices(choices: QuestionChoiceType[]) {
  const initialGroups: {name?: string; order: number; choices: {name: string; value: string; order?: number}[]}[] = []

  // Switched from choices with group information to groups with a list of choices
  const groups = choices.reduce((finalChoices, choice) => {
    const currentGroup = choice.group ?? {name: 'Other', order: Number.MAX_SAFE_INTEGER}
    const existingGroup = finalChoices.find((group) => group.name === currentGroup.name)
    if (existingGroup) {
      existingGroup.choices.push(choice)
    } else {
      finalChoices.push({...currentGroup, choices: [choice]})
    }
    return finalChoices
  }, initialGroups)

  const sortedGroups = groups.sort((g1, g2) => g1.order - g2.order)
  const grouped = sortedGroups.length > 1 || sortedGroups[0]!.order !== Number.MAX_SAFE_INTEGER

  // Mapped the group with a list of extensions to a list of inquirer choices including group separators
  return sortedGroups.flatMap((group) => {
    const finalChoices: ({type: string; line: string} | {name: string; value: string})[] = []
    if (grouped && group.name) {
      finalChoices.push({type: 'separator', line: ''})
      finalChoices.push({type: 'separator', line: group.name})
    }
    finalChoices.push(...group.choices)
    return finalChoices
  })
}
