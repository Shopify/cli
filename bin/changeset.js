import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import readline from 'node:readline'

const args = process.argv.slice(2)
const changesetBinPath = fileURLToPath(new URL('../node_modules/@changesets/cli/bin.js', import.meta.url))

if (shouldConfirmPublicChangeset(args)) {
  const confirmed = await confirmPublicChangeset()

  if (!confirmed) {
    console.log('No changeset created.')
    process.exit(1)
  }
}

const child = spawn(process.execPath, [changesetBinPath, ...args], {stdio: 'inherit'})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
  }

  process.exit(code ?? 1)
})

function shouldConfirmPublicChangeset(changesetArgs) {
  if (changesetArgs.includes('--empty')) {
    return false
  }

  if (changesetArgs.length === 0 || changesetArgs[0] === 'add') {
    return true
  }

  return (
    changesetArgs[0].startsWith('-') &&
    changesetArgs.some((arg) => ['--message', '--open', '--since'].includes(arg))
  )
}

async function confirmPublicChangeset() {
  if (!process.stdin.isTTY) {
    console.error(
      'Refusing to create a changeset without interactive confirmation. Changesets are public changelog entries; only run `pnpm changeset add` for user-facing changes that are ready to publish.',
    )
    return false
  }

  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await new Promise((resolve) =>
      prompt.question(
        'Changesets are public changelog entries. Is this change user-facing and ready to publish? (y/N) ',
        resolve,
      ),
    )
    return ['y', 'yes'].includes(answer.trim().toLowerCase())
  } finally {
    prompt.close()
  }
}
