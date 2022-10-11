import { Writable } from "form-data"
import { Signal } from "../../abort.js"
import { renderConcurrent } from "@shopify/cli-kit/node/ui"

let backendPromiseResolve: () => void

const backendPromise = new Promise<void>(function (resolve, _reject) {
  backendPromiseResolve = resolve
})

const backendProcess = {
  prefix: 'backend',
  action: async (stdout: Writable, _stderr: Writable, _signal: Signal) => {
    stdout.write('first backend message')
    stdout.write('second backend message')
    stdout.write('third backend message')

    backendPromiseResolve()
  },
}

const frontendProcess = {
  prefix: 'frontend',
  action: async (stdout: Writable, _stderr: Writable, _signal: Signal) => {
    await backendPromise

    stdout.write('first frontend message')
    stdout.write('second frontend message')
    stdout.write('third frontend message')
  },
}

renderConcurrent({processes: [backendProcess, frontendProcess]})

