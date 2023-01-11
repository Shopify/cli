import {PromptAnswer, Question, QuestionChoiceType} from '../ui.js'
import fuzzy from 'fuzzy'
import {renderAutocompletePrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function run(question: Question): Promise<string> {
  let mappedQuestion

  switch (question.type) {
    case 'input':
      mappedQuestion = {
        ...question,
        defaultValue: question.default,
        validate: question.validate
          ? (value: string) => {
              const error = question.validate!(value)
              return typeof error === 'string' ? error : undefined
            }
          : undefined,
      }

      return renderTextPrompt(mappedQuestion)
    case 'password':
      mappedQuestion = {
        ...question,
        password: true,
        validate: question.validate
          ? (value: string) => {
              const error = question.validate!(value)
              return typeof error === 'string' ? error : undefined
            }
          : undefined,
      }

      return renderTextPrompt(mappedQuestion)
    case 'select':
      mappedQuestion = {
        ...question,
        choices: question.choices.map((choice) => {
          return {
            label: choice.name,
            value: choice.value,
            group: choice.group?.name,
          }
        }),
      }

      return renderSelectPrompt(mappedQuestion)
    case 'autocomplete': {
      mappedQuestion = {
        ...question,
        choices: question.choices.map((choice) => {
          return {
            label: choice.name,
            value: choice.value,
          }
        }),
      }

      return renderAutocompletePrompt(mappedQuestion)
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
