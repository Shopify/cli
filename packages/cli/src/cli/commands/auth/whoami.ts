import Command from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {getCurrentSessionInfo} from '@shopify/cli-kit/node/session'
import {renderInfo} from '@shopify/cli-kit/node/ui'

/**
 * Diagnostic command for inspecting the currently-active CLI session.
 *
 * Intentionally exposes more detail than a typical `whoami` would (scopes,
 * cached application audiences, token previews) because the primary motivating
 * use case is debugging server-side session imports (preview-store placeholder
 * bootstrap, app-automation tokens) where you need to confirm which fields
 * actually landed on disk without leaking the tokens themselves.
 *
 * Token values are masked: only the first 8 characters and the raw length are
 * shown. That's enough to disambiguate "is this the token I just imported?"
 * without writing a secret to a shareable terminal.
 *
 * Marked as a temporary/PoC affordance \u2014 once the preview-store flow is
 * stabilised this can either graduate to a polished command or be removed.
 */
export default class AuthWhoami extends Command {
  static description = 'Show the currently-active Shopify CLI session (diagnostic).'

  static flags = {
    json: Flags.boolean({description: 'Emit the session info as JSON.'}),
    raw: Flags.boolean({
      description:
        'Include the unredacted session row and the full Sessions blob from disk. Implies --json. Contains live access/refresh tokens — do not paste into shared channels.',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthWhoami)
    const info = await getCurrentSessionInfo({raw: flags.raw})

    // --raw always emits JSON because the raw payload isn't worth pretty-printing
    // as text and the JSON form is what callers want to pipe into jq/grep anyway.
    if (flags.json || flags.raw) {
      outputResult(JSON.stringify(info, null, 2))
      return
    }

    if (!info.loggedIn) {
      outputInfo(`Not logged in.\nIdentity FQDN: ${info.identityFqdn}`)
      return
    }

    const lines: string[] = [
      `User ID:        ${info.userId ?? '(none)'}${info.looksLikePlaceholder ? '  (looks like a placeholder)' : ''}`,
      `Identity FQDN:  ${info.identityFqdn}`,
      `Alias:          ${info.alias ?? '(none \u2014 typical for placeholders)'}`,
      `Identity token: ${info.identityToken?.preview ?? '(missing)'} (len=${info.identityToken?.length ?? 0}, exp=${info.identityToken?.expiresAt ?? '?'})`,
      `Refresh token:  ${info.refreshToken?.present ? `present (len=${info.refreshToken.length})` : 'missing'}`,
      `Scopes:         ${info.scopeCount ?? 0} (${(info.scopes ?? []).slice(0, 3).join(', ')}${(info.scopes?.length ?? 0) > 3 ? ', \u2026' : ''})`,
      '',
      `Application tokens cached (${info.applications?.length ?? 0}):`,
    ]
    for (const app of info.applications ?? []) {
      lines.push(`  - ${app.appId}${app.storeFqdn ? ` [store ${app.storeFqdn}]` : ''}: ${app.preview} (len=${app.length}, exp=${app.expiresAt})`)
    }

    renderInfo({headline: 'Current Shopify CLI session', body: lines.join('\n')})
  }
}
