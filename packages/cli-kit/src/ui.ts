import {AutoComplete} from './ui/autocomplete.js'
import {Input} from './ui/input.js'
import {Select} from './ui/select.js'
import {CancelExecution, Abort} from './error.js'
import {remove, exists} from './file.js'
import {info, content, token, logToFile} from './output.js'
import {relative} from './path.js'
import {isTerminalInteractive} from './environment/local.js'
import {isTruthy} from './environment/utilities.js'
import {CustomInput} from './ui/inquirer/input.js'
import {CustomAutocomplete} from './ui/inquirer/autocomplete.js'
import {CustomSelect} from './ui/inquirer/select.js'
import inquirer from 'inquirer'
import {Listr as OriginalListr, ListrTask, ListrEvent, ListrTaskState} from 'listr2'
import fuzzy from 'fuzzy'

export function newListr(tasks: ListrTask[], options?: object) {
  const listr = new OriginalListr(tasks, options)
  listr.tasks.forEach((task) => {
    const loggedSubtaskTitles: string[] = []
    task.subscribe((event: ListrEvent) => {
      if (event.type === 'TITLE' && typeof event.data === 'string') {
        logToFile(event.data, 'INFO')
      }
    })
    task.renderHook$.subscribe(() => {
      if (task.hasSubtasks()) {
        const activeSubtasks = task.subtasks.filter((subtask) => {
          return [ListrTaskState.PENDING, ListrTaskState.COMPLETED].includes(subtask.state as ListrTaskState)
        })
        activeSubtasks.forEach((subtask) => {
          if (subtask.title && !loggedSubtaskTitles.includes(subtask.title)) {
            loggedSubtaskTitles.push(subtask.title)
            logToFile(subtask.title, 'INFO')
          }
        })
      }
    })
  })
  return listr
}

export type ListrTasks = ConstructorParameters<typeof OriginalListr>[0]
export type {ListrTaskWrapper, ListrDefaultRenderer, ListrTask} from 'listr2'

export interface Question<TName extends string = string> {
  name: TName
  message: string
  preface?: string
  validate?: (value: string) => string | true
  default?: string
  result?: (value: string) => string | boolean
  type: 'input' | 'select' | 'autocomplete' | 'password'
  choices?: {name: string; value: string}[]
}

export const prompt = async <
  TName extends string & keyof TAnswers,
  TAnswers extends {[key in TName]: string} = {[key in TName]: string},
>(
  questions: ReadonlyArray<Question<TName>>,
  debugForceInquirer = false,
): Promise<TAnswers> => {
  if (!isTerminalInteractive() && questions.length !== 0) {
    throw new Abort(content`
The CLI prompted in a non-interactive terminal with the following questions:
${token.json(questions)}
    `)
  }

  let mapTo: (question: Question) => unknown = mapper
  const isEnquirer = debugForceInquirer || isTruthy(process.env.SHOPIFY_USE_INQUIRER)
  if (isEnquirer) {
    mapTo = inquirerMapper
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedQuestions: any[] = questions.map(mapTo)
  const value = {} as TAnswers
  for (const question of mappedQuestions) {
    if (question.preface) {
      info(question.preface)
    }

    value[question.name as keyof TAnswers] = isEnquirer
      ? // eslint-disable-next-line no-await-in-loop
        (await inquirer.prompt(question, {...question.choices}))[question.name]
      : // eslint-disable-next-line no-await-in-loop
        await question.run()
  }
  return value
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
      throw new CancelExecution()
    }

    remove(directory)
  }
}

export const keypress = async () => {
  process.stdin.setRawMode(true)
  return new Promise<void>((resolve) =>
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false)
      resolve()
    }),
  )
}

function inquirerMapper(question: Question): unknown {
  switch (question.type) {
    case 'input':
    case 'password':
      inquirer.registerPrompt('custom-input', CustomInput)
      return {
        ...question,
        type: 'custom-input',
      }
    case 'select':
      inquirer.registerPrompt('custom-select', CustomSelect)
      return {
        ...question,
        type: 'custom-select',
        source: filterByName,
      }
    case 'autocomplete':
      inquirer.registerPrompt('autocomplete', CustomAutocomplete)
      return {
        ...question,
        type: 'autocomplete',
        source: filterByName,
      }
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

function filterByName(answers: {name: string; value: string}[], input = '') {
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
