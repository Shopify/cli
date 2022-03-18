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

const mainColor = colors.magentaBright

function mapper(question: Question): any {
  if (question.type === 'input') {
    return promptInput(question)
  } else if (question.type === 'select') {
    return promptSelect(question)
  }
  return undefined
}

function promptSelect(question: Question) {
  const prompt = new Select(question)
  return prompt
}

function promptInput(question: Question) {
  const prompt = new Input(question)
  return prompt
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
