import {Signal} from '../../abort.js'
import {renderConcurrent} from '../../public/node/ui.js'
import {Writable} from 'form-data'

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

// eslint-disable-next-line @typescript-eslint/no-floating-promises
renderConcurrent({processes: [backendProcess, frontendProcess]})
