#!/usr/bin/env node

process.removeAllListeners('warning')

import runCLI from '../dist/index.js'

runCLI({development: false})
