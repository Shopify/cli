import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Flags} from '@oclif/core'

export default class StoreStripeAuth extends StoreCommand {
  static hidden = true

  static summary = 'Authenticate for store commands.'

  static descriptionWithMarkdown = `Authenticates to a store then stores an online access token for later reuse. Pass the provided JWT to --signup or stdin.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products --signup <signup-jwt>',
    'printf %s <signup-jwt> | <%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products --signup <signup-jwt> --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
    scopes: Flags.string({
      description: 'Comma-separated Admin API scopes to request for the app.',
      env: 'SHOPIFY_FLAG_SCOPES',
      required: true,
    }),
    signup: Flags.string({
      description: 'Provide JWT for the store. When omitted, the JWT is read from stdin.',
      env: 'SHOPIFY_FLAG_SIGNUP',
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreStripeAuth)
    const signup = flags.signup ?? (await readSignupJwtFromStdin())

    await authenticateStoreWithApp(
      {
        store: flags.store,
        scopes: flags.scopes,
        signup,
      },
      {
        presenter: createStoreAuthPresenter(flags.json ? 'json' : 'text'),
      },
    )
  }
}

export async function readSignupJwtFromStdin(
  stdin: NodeJS.ReadableStream & AsyncIterable<Buffer | string> = process.stdin,
): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const signup = Buffer.concat(chunks).toString('utf8').trim()
  if (!signup) {
    throw new AbortError(
      'Missing signup JWT.',
      'Pass --signup <jwt>, set SHOPIFY_FLAG_SIGNUP, or pipe the JWT to stdin.',
    )
  }

  return signup
}
