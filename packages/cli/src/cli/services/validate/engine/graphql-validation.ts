import {ValidationResult, GraphQLValidationResult} from './contract.js'
import {analyzeRequiredOfflineScopes, OfflineScopeData} from './offline-scopes.js'
import {buildClientSchema, DocumentNode, GraphQLSchema, NoDeprecatedCustomRule, parse, validate} from 'graphql'
import type {ResolvedApiSchema, SchemaSource} from './schema-source.js'

// GraphQL operation validation, isolated from component-code validation. This
// entry pulls in `graphql` only — never `typescript` — so the graphql (and
// functions) subcommands stay off the TypeScript compiler. Keep it that way.

export interface GraphQLValidationOptions {
  /** The already-resolved schema (API, version, and on-disk path). */
  apiVersion: ResolvedApiSchema
  /**
   * When true (default), deprecated fields FAIL validation. When false, they
   * downgrade to INFORM. The CLI graphql subcommand always passes false.
   */
  failOnDeprecated?: boolean
  /** Where schema bytes and the version catalog come from. */
  schemaSource: SchemaSource
}

interface PerformValidationOptions {
  graphqlCode: string
  schema: GraphQLSchema
  api: string
  offlineScopeData: OfflineScopeData
  failOnDeprecated: boolean
}

/**
 * Validates a GraphQL operation against the resolved schema and returns the
 * result plus the offline access scopes the operation requires.
 */
export async function validateGraphQLOperation(
  graphqlCode: string,
  api: string,
  options: GraphQLValidationOptions,
): Promise<GraphQLValidationResult> {
  const trimmedCode = graphqlCode.trim()
  if (!trimmedCode) {
    return {
      validation: {
        result: ValidationResult.FAILED,
        resultDetail: 'No GraphQL operation found in the provided code.',
      },
      scopes: [],
    }
  }

  const {apiVersion, schemaSource} = options
  const failOnDeprecated = options.failOnDeprecated ?? true

  // Version guard, read from the *injected* source's catalog (not a static
  // constant) so a source may legitimately carry versions the bundled catalog
  // doesn't. Internal APIs absent from the catalog fall through untouched.
  if (apiVersion.name) {
    const supported = (schemaSource.readVersionCatalog()[api] ?? []).map((version) => version.name)
    if (supported.length > 0 && !supported.includes(apiVersion.name)) {
      throw new Error(
        `Unsupported version "${apiVersion.name}" for API "${api}". Available versions: ${supported.join(', ')}.`,
      )
    }
  }

  const {graphQLSchema, offlineScopes} = await loadAndBuildGraphQLSchema(apiVersion, schemaSource)

  return performGraphQLValidation({
    graphqlCode: trimmedCode,
    schema: graphQLSchema,
    api,
    offlineScopeData: offlineScopes,
    failOnDeprecated,
  })
}

async function loadAndBuildGraphQLSchema(
  apiVersion: ResolvedApiSchema,
  source: SchemaSource,
): Promise<{graphQLSchema: GraphQLSchema; offlineScopes: OfflineScopeData}> {
  let schemaContent: string
  try {
    schemaContent = await source.readSchemaContent(apiVersion)
  } catch (error) {
    // Rewrite a missing-file error into an API/version-aware message; rethrow
    // anything else unchanged.
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('Schema file not found')) {
      throw new Error(
        `Unable to load schema for API "${apiVersion.api}" version "${apiVersion.name}" - the schema file doesn't exist`,
      )
    }
    throw error
  }

  const schemaJson = JSON.parse(schemaContent)
  const schemaData = schemaJson.data

  // Workaround for a Shopify Function schema quirk: some function schemas carry
  // INPUT_OBJECT types with zero fields, which violates the GraphQL spec and
  // makes buildClientSchema throw. Patch a placeholder field into those. Guarded
  // by the `functions_` prefix so it never touches the public GraphQL schemas
  // this subcommand validates — it is retained so the functions subcommand can
  // share this exact engine.
  if (apiVersion.api.startsWith('functions_') && schemaData.__schema?.types) {
    const emptyInputTypes = new Set<string>()
    for (const type of schemaData.__schema.types) {
      if (type.kind === 'INPUT_OBJECT' && type.inputFields && type.inputFields.length === 0) {
        emptyInputTypes.add(type.name)
      }
    }

    if (emptyInputTypes.size > 0) {
      for (const type of schemaData.__schema.types) {
        if (emptyInputTypes.has(type.name)) {
          type.inputFields = [
            {
              name: '_placeholder',
              description: 'Placeholder field to satisfy GraphQL spec requirement for non-empty input objects',
              type: {kind: 'SCALAR', name: 'String', ofType: null},
              defaultValue: null,
              isDeprecated: false,
              deprecationReason: null,
            },
          ]
        }
      }
    }
  }

  return {
    graphQLSchema: buildClientSchema(schemaData),
    offlineScopes: (schemaJson.offline_scopes as OfflineScopeData) ?? {items: []},
  }
}

function parseGraphQLDocument(
  operation: string,
): {success: true; document: DocumentNode} | {success: false; error: string} {
  try {
    return {success: true, document: parse(operation)}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (parseError) {
    // A syntax error is a normal validation outcome, not an exceptional one:
    // capture it as a structured failure rather than rethrowing.
    return {
      success: false,
      error: parseError instanceof Error ? parseError.message : String(parseError),
    }
  }
}

function getOperationType(document: DocumentNode): string {
  const [firstDefinition] = document.definitions
  if (firstDefinition && firstDefinition.kind === 'OperationDefinition') {
    return firstDefinition.operation
  }
  return 'operation'
}

async function performGraphQLValidation(options: PerformValidationOptions): Promise<GraphQLValidationResult> {
  const {graphqlCode, schema, api, offlineScopeData, failOnDeprecated} = options
  const operation = graphqlCode.trim()

  const parseResult = parseGraphQLDocument(operation)
  if (!parseResult.success) {
    return {
      validation: {
        result: ValidationResult.FAILED,
        resultDetail: `GraphQL syntax error: ${parseResult.error}`,
      },
      scopes: [],
    }
  }

  const validationErrors = validate(schema, parseResult.document).map((error) => error.message)
  if (validationErrors.length > 0) {
    return {
      validation: {
        result: ValidationResult.FAILED,
        resultDetail: `GraphQL validation errors: ${validationErrors.join('; ')}`,
      },
      scopes: [],
    }
  }

  const deprecatedFieldErrors = validate(schema, parseResult.document, [NoDeprecatedCustomRule])

  // Offline scope analysis is best-effort: a failure here must not fail an
  // otherwise-valid operation.
  let offlineScopes: string[] = []
  try {
    offlineScopes = await analyzeRequiredOfflineScopes(parseResult.document, offlineScopeData, api)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Best-effort: a scope-analysis failure must not fail an otherwise-valid
    // operation, so we leave the scopes list empty.
  }

  const operationType = getOperationType(parseResult.document)

  if (deprecatedFieldErrors.length > 0) {
    const deprecatedMessages = deprecatedFieldErrors.map((error) => error.message).join('; ')

    if (failOnDeprecated) {
      return {
        validation: {
          result: ValidationResult.FAILED,
          resultDetail: `Deprecated fields used: ${deprecatedMessages}`,
        },
        scopes: offlineScopes,
      }
    }

    return {
      validation: {
        result: ValidationResult.INFORM,
        resultDetail: `Successfully validated GraphQL ${operationType} against schema. Note: ${deprecatedMessages}`,
      },
      scopes: offlineScopes,
    }
  }

  return {
    validation: {
      result: ValidationResult.SUCCESS,
      resultDetail: `Successfully validated GraphQL ${operationType} against schema.`,
    },
    scopes: offlineScopes,
  }
}
