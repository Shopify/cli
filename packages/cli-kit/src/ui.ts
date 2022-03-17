// @ts-ignore
import enquirer, {Select} from 'enquirer'
import * as colors from 'ansi-colors'
import {Listr, PromptOptions} from 'listr2'

export interface Question {
  type: 'input' | 'select'
  name: string
  message: string
  default?: string
  choices?: string[]
}

export const prompt = <T>(questions: Question[]): Promise<T> => {
  const extra = {numbered: true}
  const options = {...questions, extra}
  return enquirer.prompt(questions)
}

export function promptSelect() {
  const prompt = new Select({
    name: 'color',
    message: 'Pick a flavor',
    choices: ['apple', 'grape', 'watermelon', 'cherry', 'orange'],
    pointer(choice: any, i: number) {
      return this.state.index === i ? colors.green('→') : ' '
    },
  })
  return prompt.run()
}

// const pointer = (choice: any, i: number) => {
//   return thisstate.index === i ? colors.green('→') : ' '
// }

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
