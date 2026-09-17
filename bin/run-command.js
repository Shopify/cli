import {spawn} from 'child_process'

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{printOutput?: boolean, input?: string}} [options]
 * @returns {Promise<string>}
 */
export function runCommand(command, args, {printOutput = true, input} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe']})

    if (input !== undefined) child.stdin.end(input)

    let output = ''
    let errorOutput = ''

    child.stdout.on('data', (data) => {
      if (printOutput) console.log(data.toString())
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      if (printOutput) console.log(data.toString())
      errorOutput += data.toString()
    })

    // Without this the event is unhandled and takes the whole process down, so a missing
    // binary looks like a crash instead of a failed command.
    child.on('error', (error) => {
      reject(new Error(`Command \`${command}\` could not be run: ${error.message}`))
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}\n${errorOutput}`))
      } else {
        resolve(output)
      }
    })
  })
}
