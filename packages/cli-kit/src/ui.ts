import {AutoComplete} from './ui/autocomplete.js'
import {Input} from './ui/input.js'
import {Select} from './ui/select.js'
import {CancelExecution, Abort} from './error.js'
import {remove, exists} from './file.js'
import {info, completed, content, token, logUpdate, logToFile, Message, Logger, stringifyMessage} from './output.js'
import {colors} from './node/colors.js'
import {relative} from './path.js'
import {isTerminalInteractive} from './environment/local.js'
import {isTruthy} from './environment/utilities.js'
import inquirer from 'inquirer'
import {Listr as OriginalListr, ListrTask, ListrEvent, ListrTaskState} from 'listr2'

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

interface BaseQuestion<TName extends string> {
  name: TName
  message: string
  preface?: string
  validate?: (value: string) => string | true
  default?: string
  result?: (value: string) => string | boolean
}

const started = (content: Message, logger: Logger) => {
  const message = `${colors.yellow('❯')} ${stringifyMessage(content)}`
  info(message, logger)
}

const failed = (content: Message, logger: Logger) => {
  const message = `${colors.red('✖')} ${stringifyMessage(content)}`
  info(message, logger)
}

/**
 * Performs a task with the title kept up to date and stdout available to the
 * task while it runs (there is no re-writing stdout while the task runs).
 */
export interface TaskOptions {
  title: string
  task: () => Promise<void | {successMessage: string}>
}
export const task = async ({title, task}: TaskOptions) => {
  let success
  started(title, logUpdate)
  try {
    const result = await task()
    success = result?.successMessage || title
  } catch (err) {
    failed(title, logUpdate)
    logUpdate.done()
    throw err
  }
  completed(success, logUpdate)
  logUpdate.done()
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
  debugForceInquirer = false,
): Promise<TAnswers> => {
  if (!isTerminalInteractive() && questions.length !== 0) {
    throw new Abort(content`
The CLI prompted in a non-interactive terminal with the following questions:
${token.json(questions)}
    `)
  }

  if (debugForceInquirer || isTruthy(process.env.SHOPIFY_USE_INQUIRER)) {
    const results = []
    for (const question of questions) {
      if (question.preface) {
        info(question.preface)
      }

      const questionName = question.name
      // eslint-disable-next-line no-await-in-loop
      const answer = (await inquirer.prompt([convertQuestionForInquirer(question)]))[questionName]
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

function convertQuestionForInquirer<
  TName extends string & keyof TAnswers,
  TAnswers extends {[key in TName]: string} = {[key in TName]: string},
>(question: Question<TName>): inquirer.DistinctQuestion<TAnswers> {
  switch (question.type) {
    case 'input':
    case 'password':
      return question
    case 'select':
    case 'autocomplete':
      return {
        ...question,
        type: 'list',
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
