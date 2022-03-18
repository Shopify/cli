// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
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
  const prompt = new (enquirer as any).Select({
    name: question.name,
    message: question.message,
    choices: question.choices,
    styles: {em: mainColor},
    pointer(choice: any, i: number) {
      const showPointer = !this.state.multiple && this.state.index === i
      return showPointer ? mainColor('>') : ' '
    },
    prefix(state: any) {
      return state.status === 'submitted' ? mainColor.bold('✔') : mainColor.bold('?')
    },
  })

  return prompt
}

function promptInput(question: Question) {
  const prompt = new UIInput({
    name: question.name,
    message: question.message,
    choices: question.choices,
    styles: {em: mainColor},
    prefix(state: any) {
      return state.status === 'submitted' ? mainColor.bold('✔') : mainColor.bold('?')
    },
  })
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

class UIInput extends enquirer.StringPrompt {
  async render() {
    const size = this.state.size

    const prefix = await this.prefix()
    const separator = await this.separator()
    const message = await this.message()

    let prompt = [prefix, message].filter(Boolean).join(' ')
    this.state.prompt = prompt

    let output = await this.format()
    const help = (await this.error()) || (await this.hint())

    if (help && !output.includes(help)) output += ` ${help}`

    if (this.state.submitted) {
      prompt += ` ${separator} ${mainColor(output)}`
    } else {
      prompt += `\n${mainColor('>')} ${output}`
    }

    this.clear(size)
    this.write([prompt].filter(Boolean).join('\n'))
    this.restore()
  }
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
/* @ts-ignore */
