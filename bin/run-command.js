import {spawn} from 'child_process'

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<string>}
 */
export function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['inherit', 'pipe', 'pipe']})

    let output = ''
    let errorOutput = ''

    child.stdout.on('data', (data) => {
      console.log(data.toString())
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      console.log(data.toString())
      errorOutput += data.toString()
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
