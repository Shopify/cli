import {TerminalSession} from '../../services/terminal.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {isTTY} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedSidekick} from '@shopify/cli-kit/node/session'
import {Flags, Args} from '@oclif/core'

const DEFAULT_API_ENDPOINT =
  process.env.SHOPIFY_SERVICE_ENV === 'local' ? 'https://sidekick-server.shop.dev' : 'https://sidekick.shopify.com'
const SIDEKICK_API_ENDPOINT = process.env.SIDEKICK_API_ENDPOINT ?? DEFAULT_API_ENDPOINT

export default class Sidekick extends Command {
  static description = 'AI-powered business assistant for your Shopify store'

  static flags = {
    ...globalFlags,
    store: Flags.string({
      char: 's',
      description: 'Store to connect to',
      env: 'SHOPIFY_FLAG_STORE',
    }),
    format: Flags.string({
      description: 'Output format',
      options: ['text', 'json', 'csv', 'md'],
      default: 'text',
      env: 'SHOPIFY_FLAG_FORMAT',
    }),
    yolo: Flags.boolean({
      description: 'Auto-approve all tool operations',
      default: false,
      env: 'SHOPIFY_FLAG_YOLO',
    }),
    path: Flags.string({
      char: 'p',
      description: 'The path to use as working directory',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
      noCacheDefault: true,
    }),
  }

  static args = {
    prompt: Args.string({
      description: 'The prompt to send to Sidekick',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {flags, args} = await this.parse(Sidekick)
    const interactive = isTTY() && !args.prompt

    // Read stdin if available
    let stdinContent: string | undefined
    if (!process.stdin.isTTY) {
      stdinContent = await this.readStdin()
      if (stdinContent && !args.prompt) {
        this.error('A prompt argument is required when piping stdin')
      }
    }

    // Auth logic: support dev mode via SIDEKICK_TOKEN, otherwise use OAuth
    let token: string
    let storeHandle: string

    const devToken = process.env.SIDEKICK_TOKEN
    if (devToken) {
      // Dev mode: use provided token directly
      token = devToken
      storeHandle = flags.store ?? 'dev'
    } else {
      // Production mode: use OAuth
      if (!flags.store) {
        this.error('The --store flag is required')
      }
      const sidekickSession = await ensureAuthenticatedSidekick(flags.store)
      token = sidekickSession.token
      storeHandle = sidekickSession.storeFqdn.replace(/\.(myshopify\.com|my\.shop\.dev)$/, '')
    }

    const session = new TerminalSession({
      apiEndpoint: SIDEKICK_API_ENDPOINT,
      token,
      storeHandle,
      format: (flags.format ?? 'text') as 'text' | 'json' | 'csv' | 'md',
      yolo: flags.yolo,
      interactive,
      stdinContent,
      workingDirectory: flags.path,
    })

    try {
      await session.initialize()

      if (args.prompt) {
        await session.oneShot(args.prompt)
      } else if (interactive) {
        await session.interactive()
      } else {
        this.error('A prompt argument is required in non-interactive mode')
      }
    } finally {
      session.shutdown()
    }
  }

  private readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = ''
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', (chunk: string) => {
        data += chunk
      })
      process.stdin.on('end', () => {
        resolve(data)
      })
      process.stdin.on('error', (err: Error) => {
        reject(err)
      })
      // Resume the stream in case it's paused
      process.stdin.resume()
    })
  }
}
