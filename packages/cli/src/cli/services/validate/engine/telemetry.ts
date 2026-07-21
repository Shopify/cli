import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

// Telemetry for `shopify validate <subcommand>`. Records a few public
// `cmd_validate_*` fields via cli-kit's `addPublicMetadata`; the CLI's existing
// public-metadata hook is what forwards them to Monorail. There is NO network
// POST here — the source package's `instrumentation.ts` shopify.dev POST is not
// ported. The fields must be declared in
// `packages/cli-kit/src/public/node/monorail.ts` (`Schemas.public`) or this
// will not type-check.

export interface ValidateMetadataFields {
  /** The subcommand that ran (`graphql`, `functions`, `components`, `theme`). */
  subcommand: string
  /** The overall validation result (`success`, `failed`, `inform`, or `error`). */
  result: string
  /** The API validated against, when the subcommand takes one. */
  api?: string
  /** The resolved API version, when the subcommand resolves one. */
  apiVersion?: string
  /** Whether the command ran in `--json` mode. */
  json?: boolean
}

/**
 * Records the public telemetry fields for a `shopify validate` run. Mirrors the
 * `app config validate` metadata pattern (`packages/app/src/cli/services/validate.ts`):
 * the call is awaited and errors are not swallowed.
 */
export async function recordValidateMetadata(fields: ValidateMetadataFields): Promise<void> {
  await addPublicMetadata(() => ({
    cmd_validate_subcommand: fields.subcommand,
    cmd_validate_result: fields.result,
    cmd_validate_api: fields.api,
    cmd_validate_api_version: fields.apiVersion,
    cmd_validate_json: fields.json,
  }))
}
