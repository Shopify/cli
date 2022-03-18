// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {Input} from './ui/input'
import {Select} from './ui/select'
import enquirer from 'enquirer'
import * as colors from 'ansi-colors'
import {Listr, PromptOptions} from 'listr2'

export interface Question {
  type: 'input' | 'select'
  name: string
  message: string
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
