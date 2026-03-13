#!/usr/bin/env node

import runCLI from '../dist/bootstrap.js'

process.removeAllListeners('warning')

runCLI({development: false})
