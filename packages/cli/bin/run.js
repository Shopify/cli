#!/usr/bin/env node

import {enableCompileCache} from 'node:module'

enableCompileCache()

process.removeAllListeners('warning')

const {default: runCLI} = await import('../dist/bootstrap.js')
runCLI({development: false})
