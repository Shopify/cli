// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {Input} from './ui/input'
import {Select} from './ui/select'
import enquirer from 'enquirer'
import * as colors from 'ansi-colors'
import {Listr, PromptOptions} from 'listr2'

/**
 * An interface to define a Prompt question
 * If a `validate` block is provided it may return a boolean or a string.
 * If a string is returned it will be used as the validation error message.
 *
 * Some properties only affect the `input` type:
 * - `default`: The default value for the input
 *
 * Some properties only affect the `select` type:
 * - `choices`: An array of choices to select from
 */
export interface Question {
  type: 'input' | 'select'
  name: string
  message: string
  validate?: (value: string) => string | boolean
  default?: string
  choices?: string[]
}

export const prompt = async <T>(questions: Question[]): Promise<T> => {
  const mappedQuestions: any = questions.map(mapper)
  const value: any = {}
  for (const question of mappedQuestions) {
    // eslint-disable-next-line no-await-in-loop
    value[question.name] = await question.run()
  }
  return value
}

function mapper(question: Question): any {
  if (question.type === 'input') {
    return new Input(question)
  } else if (question.type === 'select') {
    return new Select(question)
  }
  return undefined
}

export interface Task {
  title: string
  output: string
}
export interface Context {}

interface ListTask {
  title: string
  task: (ctx: Context, task: Task) => Promise<void>
}

interface ListOptions {
  concurrent?: boolean
}

export const list = async (tasks: ListTask[], options?: ListOptions): Promise<void> => {
  await new Listr(tasks, options).run()
}
