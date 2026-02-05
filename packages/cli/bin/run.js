#!/usr/bin/env node

import runCLI from '../dist/index.js'

process.removeAllListeners('warning')

runCLI({development: false})
