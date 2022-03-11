// import type {Env} from 'types';
import chalk from 'chalk'

import {HelpfulError} from '../../utilities'
import {CheckResult} from '../../types'
import Command from '../../core/Command'

import {checkHydrogenVersion, checkEslintConfig, checkNodeVersion} from './check/rules'

export default class Check extends Command {
  static description = 'Check a hydrogen app for common problems.'

  static examples = [`$ shopify hydrogen check`]

  static flags = {
    ...Command.flags,
  }

  static args = []

  async run(): Promise<void> {
    this.interface.say('Running checks...')

    let results

    try {
      results = [
        ...(await checkNodeVersion.call(this)),
        ...(await checkHydrogenVersion.call(this)),
        ...(await checkEslintConfig.call(this)),
      ]
    } catch (error) {
      throw new HelpfulError({title: 'Error running checks'})
    }

    displayCheckResults.call(this, results)

    const failedChecks = results.filter(({success}) => !success)

    if (failedChecks.length) {
      this.interface.say(
        `${chalk.red.bold(`• ${failedChecks.length} errors `)}${chalk.dim(`found in ${results.length} checks`)}`,
      )
    } else {
      this.interface.say(`${chalk.green.bold(`• No errors `)}${chalk.dim(`found in ${results.length} checks`)}`)
    }

    await fixChecks.call(this, results)
    console.log()
  }
}

function displayCheckResults(this: Command, allCheckResults: CheckResult[]) {
  const indent = '          '
  const checksBySection = allCheckResults.reduce((acc, {type, ...rest}) => {
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push({type, ...rest})
    return acc
  }, {} as {[key: string]: CheckResult[]})

  ;[...Object.entries(checksBySection)].forEach(([section, sectionResults]) => {
    const allChecksStatusEmoji = statusEmoji(sectionResults.every(({success}) => success))

    console.log()
    this.interface.say(`${allChecksStatusEmoji} ${chalk.cyan.bold.underline(section)}`)
    console.log()

    sectionResults.forEach(({description, link, success, fix, id}) => {
      const docsLink = link ? chalk.dim(`${indent}${link}\n`) : ''
      const idText = id ? chalk.dim(id) : ''
      const fixedText = success ? '' : statusFixable(fix)
      const lines = [[statusEmoji(success), description, idText, fixedText].join(' '), docsLink]

      this.interface.say(lines.join('\n'))
    })
  })
  console.log()
}

async function fixChecks(this: Command, results: CheckResult[]) {
  let changedFiles = new Map()

  const allFixableResults: CheckResult[] = results.filter(
    ({fix, success}) => !success && fix !== undefined && typeof fix === 'function',
  )

  if (allFixableResults.length === 0) {
    this.interface.say(`No fixable checks`)

    return
  }

  console.log()
  console.log()
  await this.interface.say(`${allFixableResults.length} failed checks might be automatically fixable.`)
  console.log()
  const wantsFix = await this.interface.ask(
    `Do you want to apply automatic fixes to ${allFixableResults.length} failed checks?`,
    {boolean: true, name: 'fix', default: false},
  )

  if (!wantsFix) {
    return
  }

  for await (const {description, files} of runFixers(allFixableResults as Required<CheckResult>[], {
    fs: this.fs,
    package: this.package,
    interface: this.interface,
  })) {
    this.interface.say([statusEmoji(true), description, chalk.green('fixed')].join(' '))

    changedFiles = new Map([...changedFiles, ...files])
  }

  const cleanUpPromises = Array.from(changedFiles).map(async ([path, content]) => {
    const action = (await this.fs.hasFile(path)) ? chalk.red(`{red overwrote`) : chalk.green(`{green wrote}`)

    await this.fs.write(path, content)

    this.interface.say(`${action}${stripPath(path)}`)
  })

  await Promise.all(cleanUpPromises)
}

async function* runFixers(allFixableResults: Required<CheckResult>[], context: any) {
  for (const {fix, description} of allFixableResults) {
    try {
      await fix(context)
    } finally {
      yield {description, files: []}
    }
  }
}

function statusEmoji(success: boolean) {
  return success ? '✓' : `✕`
}

function statusFixable(fix: CheckResult['fix']) {
  return typeof fix === 'function' ? chalk.cyan(` (fixable) `) : ' '
}

function stripPath(path: string) {
  return path.replace(`${process.cwd()}`, '')
}
