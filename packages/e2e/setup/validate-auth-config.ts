import {AuthSetupError, validateRemoteE2EEnvironment} from './auth-diagnostics.js'

try {
  validateRemoteE2EEnvironment()
  process.stdout.write('[e2e][auth] configuration valid\n')
} catch (error) {
  if (!(error instanceof AuthSetupError)) throw error
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
