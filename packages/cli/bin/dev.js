const {default: runCLI} = await import('../dist/bootstrap.js')

process.removeAllListeners('warning')

runCLI({development: true})
