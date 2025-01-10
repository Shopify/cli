import {AdminSession} from '@shopify/cli-kit/node/session'

interface MultiRunOptions {
  flags: unknown
  command: (flags: unknown, adminSession?: AdminSession) => Promise<void>
  validateConfig?: boolean
}

export async function multiRun({flags, command, validateConfig = false}: MultiRunOptions) {
  console.log('temp')
  if (flags.environment && flags.environment.length > 1) {
    const sessions: {[key: string]: AdminSession} = {}
  }

  // Authenticate all sessions
}
