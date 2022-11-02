import {CancelExecution, Abort, AbortSilent} from './error.js'
import {remove, exists} from './file.js'
import {info, completed, content, token, logUpdate, Message, Logger, stringifyMessage, debug} from './output.js'
import colors from './public/node/colors.js'
import {relative} from './path.js'
import {isTerminalInteractive} from './environment/local.js'
import {mapper as mapperUI, run as executorUI} from './ui/executor.js'
import {logToFile} from './log.js'
import {Listr as OriginalListr, ListrTask, ListrEvent, ListrTaskState, ListrBaseClassOptions} from 'listr2'
import findProcess from 'find-process'

export function newListr(tasks: ListrTask[], options?: object | ListrBaseClassOptions) {
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
  choices?: QuestionChoiceType[]
}

export interface QuestionChoiceType {
  name: string
  value: string
  group?: {name: string; order: number}
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
export const prompt = async <
  TName extends string & keyof TAnswers,
  TAnswers extends {[key in TName]: string} = {[key in TName]: string},
>(
  questions: ReadonlyArray<Question<TName>>,
): Promise<TAnswers> => {
  if (!isTerminalInteractive() && questions.length !== 0) {
    throw new Abort(content`
The CLI prompted in a non-interactive terminal with the following questions:
${token.json(questions)}
    `)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedQuestions: any[] = questions.map(mapperUI)
  const value = {} as TAnswers
  for (const question of mappedQuestions) {
    if (question.preface) {
      info(question.preface)
    }

    // eslint-disable-next-line no-await-in-loop
    value[question.name as TName] = await executorUI(question)

    logPromptResults(question.message, value[question.name as TName])
  }
  return value
}

function logPromptResults(questionName: string, answer: string) {
  logToFile([questionName, answer].join(' '), 'INFO')
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

    await remove(directory)
  }
}

export async function terminateBlockingPortProcessPrompt(port: number, stepDescription?: string): Promise<boolean> {
  const stepDescriptionContent = stepDescription ?? 'current step'

  const processInfo = await findProcess('port', port)
  const formattedProcessName =
    processInfo && processInfo.length > 0 && processInfo[0]?.name
      ? ` ${content`${token.italic(`(${processInfo[0].name})`)}`.value}`
      : ''

  const options = [
    {name: 'Yes, terminate process in order to log in now', value: 'finish'},
    {name: `No, cancel command and try later`, value: 'cancel'},
  ]

  const choice = await prompt([
    {
      type: 'select',
      name: 'value',
      message: `${stepDescriptionContent} requires a port ${port} that's unavailable because it's running another process${formattedProcessName}. Terminate that process? `,
      choices: options,
    },
  ])
  return choice.value === 'finish'
}

export const keypress = async () => {
  return new Promise((resolve, reject) => {
    const handler = (buffer: Buffer) => {
      process.stdin.setRawMode(false)
      process.stdin.pause()

      const bytes = Array.from(buffer)

      if (bytes.length && bytes[0] === 3) {
        debug('Canceled keypress, User pressed CTRL+C')
        reject(new AbortSilent())
      }
      process.nextTick(resolve)
    }

    process.stdin.resume()
    process.stdin.setRawMode(true)
    process.stdin.once('data', handler)
  })
}
