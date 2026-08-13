import {AuthSetupError, readAuthConfig} from './auth-diagnostics.js'

try {
  readAuthConfig()
  process.stdout.write('[e2e][auth] configuration valid\n')
} catch (error) {
  if (!(error instanceof AuthSetupError)) throw error
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
