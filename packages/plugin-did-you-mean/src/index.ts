import {isAutocorrectEnabled} from './services/conf.js'
import {Hook} from '@oclif/core'
import {bigram} from 'n-gram'
import {renderConfirmationPrompt, renderFatalError, renderInfo} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'

function sanitizeCmd(cmd: string): string {
  return cmd.replace(/:/g, ' ')
}

function relativeScore(commandBigrams: string[], userCommandBigrams: string[]): number {
  const map: {[key: string]: number} = {}
  commandBigrams.forEach((elem) => {
    map[elem] = map[elem] ? map[elem]! + 1 : 1
  })
  const result: string[] = []
  for (const key of userCommandBigrams) {
    if (key in map && map[key]! > 0) {
      result.push(key)
      map[key]--
    }
  }
  return result.length
}

export function findAlternativeCommand(
  opts: Pick<Parameters<Hook.CommandNotFound>[0], 'id' | 'argv' | 'config'>,
): string | undefined {
  if (opts.id.length < 2) return undefined
  const hiddenCommands = new Set(opts.config.commands.filter((cmd) => cmd.hidden).map((cmd) => cmd.id))
  const availableCommands = Array.from(
    new Set(
      [...opts.config.commandIDs, ...opts.config.commands.flatMap((cmd) => cmd.aliases)].filter(
        (cmd) => !hiddenCommands.has(cmd),
      ),
    ),
  )

  const userCommandBigrams = bigram(opts.id)

  const commandsWithScores = availableCommands
    .map((cmd) => {
      const commandBigram = bigram(cmd)
      return {score: relativeScore(commandBigram, userCommandBigrams), cmd}
    })
    // only choose commands that have at least two bigrams in common
    .filter(({score}) => score >= 2)
    .sort((first, second) => {
      // highest score is better, so we sort descending
      const scoreDifference = second.score - first.score
      if (scoreDifference !== 0) return scoreDifference
      // if the scores are equal, we prefer the shorter command
      return first.cmd.length - second.cmd.length
    })

  outputDebug(`'Did you mean' options: ${JSON.stringify(commandsWithScores)}`)

  if (commandsWithScores.length > 0) {
    const {cmd} = commandsWithScores[0]!
    return cmd
  }
}

export async function shouldRunCommand(result: string, userCommand: string) {
  if (isAutocorrectEnabled()) {
    renderInfo({
      body: ['Autocorrecting', {command: sanitizeCmd(userCommand)}, 'to', {command: sanitizeCmd(result)}, {char: '.'}],
    })
    return true
  }

  return renderConfirmationPrompt({
    message: [
      'Command',
      {command: userCommand},
      'not found. Did you mean',
      {command: sanitizeCmd(result)},
      {char: '?'},
    ],
  })
}

// eslint-disable-next-line func-style
const hook: Hook.CommandNotFound = async function (opts) {
  const result = findAlternativeCommand(opts)
  const userCommand = sanitizeCmd(opts.id)
  const useForceFlag = opts.argv && (opts.argv.includes('-f') || opts.argv.includes('--force'))
  if (useForceFlag || !result) {
    renderFatalError(new AbortError(`Command '${userCommand}' not found.`))
    return
  }

  if (await shouldRunCommand(result, userCommand)) {
    await this.config.runCommand(result, opts.argv)
  }
}

export default hook
