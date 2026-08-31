import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isStdinPiped} from '@shopify/cli-kit/node/system'
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
    const signup = signupFlagValue(flags.signup) ?? (await readSignupJwtFromStdin())

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

const MAX_SIGNUP_JWT_BYTES = 8 * 1024
const MISSING_SIGNUP_JWT = 'Missing signup JWT.'
const MISSING_SIGNUP_JWT_GUIDANCE = 'Pass --signup <jwt>, set SHOPIFY_FLAG_SIGNUP, or pipe the JWT to stdin.'

// A blank --signup is a credential that was never supplied rather than an empty one, so it falls
// through to stdin instead of starting an authorization without it.
function signupFlagValue(signup: string | undefined): string | undefined {
  const trimmed = signup?.trim()
  return trimmed === '' ? undefined : trimmed
}

export async function readSignupJwtFromStdin(
  stdin: NodeJS.ReadableStream & AsyncIterable<Buffer | string> = process.stdin,
): Promise<string> {
  // An interactive stdin never ends, so reading it would hang the command instead of reporting the
  // credential that was never supplied.
  if (stdin === process.stdin && !isStdinPiped()) {
    throw new AbortError(MISSING_SIGNUP_JWT, MISSING_SIGNUP_JWT_GUIDANCE)
  }

  const chunks: Buffer[] = []
  let byteLength = 0
  for await (const chunk of stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteLength += buffer.length
    if (byteLength > MAX_SIGNUP_JWT_BYTES) {
      throw new AbortError('The signup JWT piped to stdin is too large.', 'Pipe only the JWT.')
    }
    chunks.push(buffer)
  }

  const signup = Buffer.concat(chunks).toString('utf8').trim()
  if (!signup) throw new AbortError(MISSING_SIGNUP_JWT, MISSING_SIGNUP_JWT_GUIDANCE)

  return signup
}
