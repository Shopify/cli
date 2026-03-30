// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {enableCompileCache} from 'node:module'

enableCompileCache()

process.removeAllListeners('warning')

const {default: runCLI} = await import('../dist/bootstrap.js')
runCLI({development: true})
