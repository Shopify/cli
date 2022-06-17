import {AutoComplete} from './ui/autocomplete'
import {Input} from './ui/input'
import {Select} from './ui/select'
import {Bug, AbortSilent} from './error'
import {remove, exists} from './file'
import {info, content, token} from './output'
import {relative} from './path'
import {isTerminalInteractive} from './environment/local'
import inquirer from 'inquirer'

export {Listr} from 'listr2'
export type {ListrTaskWrapper, ListrDefaultRenderer, ListrTask} from 'listr2'

interface BaseQuestion<TName extends string> {
  name: TName
  message: string
  preface?: string
  validate?: (value: string) => string | true
  default?: string
  result?: (value: string) => string | boolean
}

export type InputQuestion<TName extends string> = BaseQuestion<TName> & {
  type: 'input'
}

export type SelectQuestion<TName extends string> = BaseQuestion<TName> & {
  type: 'select'
  choices: string[] | {name: string; value: string}[]
}

export type AutocompleteQuestion<TName extends string> = BaseQuestion<TName> & {
  type: 'autocomplete'
  choices: string[] | {name: string; value: string}[]
}

export type PasswordQuestion<TName extends string> = BaseQuestion<TName> & {
  type: 'password'
}

export type Question<TName extends string = string> =
  | InputQuestion<TName>
  | SelectQuestion<TName>
  | AutocompleteQuestion<TName>
  | PasswordQuestion<TName>

export const prompt = async <
  TName extends string & keyof TAnswers,
  TAnswers extends {[key in TName]: string} = {[key in TName]: string},
>(
  questions: ReadonlyArray<Question<TName>>,
): Promise<TAnswers> => {
  if (!isTerminalInteractive() && questions.length !== 0) {
    throw new Bug(content`
The CLI prompted in a non-interactive terminal with the following questions:
${token.json(questions)}
    `)
  }

  if (process.env.SHOPIFY_USE_INQUIRER === '1') {
    const results = []
    for (const question of questions) {
      if (question.preface) {
        info(question.preface)
      }

      const questionName = question.name
      // eslint-disable-next-line no-await-in-loop
      const answer = (await inquirer.prompt([question]))[questionName]
      results.push([questionName, answer])
    }

    return Object.fromEntries(results) as TAnswers
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedQuestions: any[] = questions.map(mapper)
    const value = {} as TAnswers
    for (const question of mappedQuestions) {
      if (question.preface) {
        info(question.preface)
      }
      // eslint-disable-next-line no-await-in-loop
      value[question.name as keyof TAnswers] = await question.run()
    }
    return value
  }
}

export async function nonEmptyDirectoryPrompt(directory: string) {
  if (await exists(directory)) {
    const options = [
      {name: 'No, don’t delete the files', value: 'abort'},
      {name: 'Yes, delete the files', value: 'overwrite'},
    ]

    const relativeDirectory = relative(process.cwd(), directory)

    const questions: Question<'value'> = {
      type: 'select',
      name: 'value',
      message: `${relativeDirectory} is not an empty directory. Do you want to delete the existing files and continue?`,
      choices: options,
    }

    const choice = await prompt([questions])

    if (choice.value === 'abort') {
      throw new AbortSilent()
    }

    remove(directory)
  }
}

function mapper(question: Question): unknown {
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
