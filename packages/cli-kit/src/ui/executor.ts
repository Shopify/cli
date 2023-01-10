import {CustomAutocomplete} from './inquirer/autocomplete.js'
import {CustomSelect} from './inquirer/select.js'
import {PromptAnswer, Question, QuestionChoiceType} from '../ui.js'
import inquirer, {Answers, QuestionCollection} from 'inquirer'
import fuzzy from 'fuzzy'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function run(question: Question): Promise<string> {
  const questionName = question.name
  let mappedQuestion

  switch (question.type) {
    case 'input':
      mappedQuestion = {
        ...question,
        defaultValue: question.default,
      }

      return renderTextPrompt(mappedQuestion)
    case 'password':
      mappedQuestion = {
        ...question,
        password: true,
      }

      return renderTextPrompt(mappedQuestion)
    case 'select':
      inquirer.registerPrompt('custom-select', CustomSelect)
      mappedQuestion = {
        ...question,
        type: 'custom-select',
        source: getAutocompleteFilterType(),
        choices: question.choices ? groupAndMapChoices(question.choices) : undefined,
      }

      return (
        await inquirer.prompt(mappedQuestion as QuestionCollection<Answers>, {
          ...mappedQuestion.choices,
        })
      )[questionName]
    case 'autocomplete': {
      inquirer.registerPrompt('autocomplete', CustomAutocomplete)
      const filterType = getAutocompleteFilterType()
      mappedQuestion = {
        ...question,
        type: 'autocomplete',
        source: question.source ? question.source(filterType) : filterType,
      }

      return (
        await inquirer.prompt(mappedQuestion as QuestionCollection<Answers>, {
          ...mappedQuestion.choices,
        })
      )[questionName]
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
    resolve(
      Object.values(answers).filter(
        (answer) => !answer.name || answer.name.toLowerCase().includes(input.toLowerCase()),
      ),
    )
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
