import {Question} from '../ui.js'
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
