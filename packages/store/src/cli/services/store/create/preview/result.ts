import {type CreatePreviewStoreResult} from './index.js'
import {outputResult, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

type CreatePreviewStoreOutputFormat = 'text' | 'json'

export function writeCreatePreviewStoreResult(
  result: CreatePreviewStoreResult,
  format: CreatePreviewStoreOutputFormat,
): void {
  if (format === 'json') {
    outputResult(serializeAsJson(result))
    return
  }
  renderTextResult(result)
}

function serializeAsJson(result: CreatePreviewStoreResult): string {
  return JSON.stringify(
    {
      shopId: result.shopId,
      shopPermanentDomain: result.shopPermanentDomain,
      placeholderAccountUuid: result.placeholderAccountUuid,
      adminApiToken: result.adminApiToken,
      magicLinkUrl: result.magicLinkUrl,
      magicLinkExpiresAt: result.magicLinkExpiresAt,
      userId: result.userId,
      // True when the orchestrator returned a `cli_identity_bootstrap` and the CLI
      // imported it as an active Identity session. False signals the legacy
      // (synthetic `placeholder:<uuid>` userId) fallback path — typically because
      // the backend isn't yet on the bootstrap-emitting branch.
      identityImported: result.identityImported,
    },
    null,
    2,
  )
}

function renderTextResult(result: CreatePreviewStoreResult): void {
  renderSuccess({
    headline: `Preview store created: ${result.shopPermanentDomain}`,
    customSections: [
      {
        title: 'Store',
        body: {
          list: {
            items: [
              `Shop ID: ${result.shopId}`,
              `Permanent domain: ${result.shopPermanentDomain}`,
              `Placeholder account: ${result.placeholderAccountUuid}`,
            ],
          },
        },
      },
      {
        title: 'Magic link (one-time-use, expires in ~30 minutes)',
        body: result.magicLinkUrl,
      },
      {
        title: 'CLI identity',
        body: result.identityImported
          ? `Logged in as placeholder ${result.placeholderAccountUuid}. Run shopify-authed commands (e.g. \`shopify organization list\`) without an extra login.`
          : `Stored under synthetic user id \`${result.userId}\`. The orchestrator did not return a CLI identity bootstrap, so no Identity-backed session was imported.`,
      },
    ],
    nextSteps: [
      [
        'Run an Admin GraphQL query against the new store:',
        {
          command: `shopify store execute --store ${result.shopPermanentDomain} --query '{ shop { name } }'`,
        },
      ],
      ['Open the magic link above in a browser to land in admin without an Identity login.'],
    ],
  })

  // The admin token is not displayed in the rendered text output to avoid accidental
  // copy-paste leakage. JSON output (used by AI agents) still surfaces it, since the
  // agent needs it to reason about the session shape.
  outputResult(
    outputContent`Preview store admin token stored locally and accessible via ${outputToken.genericShellCommand(
      `shopify store execute --store ${result.shopPermanentDomain}`,
    )}.`.value,
  )
}
