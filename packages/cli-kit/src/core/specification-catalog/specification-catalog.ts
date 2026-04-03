import {Contract} from '../contract/contract.js'
import {ModuleSpecification} from '../module-specification/module-specification.js'
import {JsonMapType} from '../../public/node/toml/codec.js'
import type {ZodType} from 'zod'

/**
 * The subset of a remote specification that the catalog needs.
 * Callers map their platform-specific types to this shape.
 */
export interface RemoteSpecInput {
  identifier: string
  name: string
  externalName?: string
  externalIdentifier: string
  experience: 'extension' | 'configuration' | 'deprecated'
  options: {
    registrationLimit: number
    uidIsClientProvided: boolean
  }
  validationSchema?: {
    jsonSchema: string
  } | null
  features?: unknown
}

/**
 * Lookup table over the server's module types.
 *
 * Built from remote specs + optional local adapter schemas/transforms.
 * Contracts are assembled during construction from available sources.
 */
export class SpecificationCatalog {
  static async build(options: {
    remoteSpecs: RemoteSpecInput[]
    /** Zod schemas for transitional local validation, keyed by spec identifier. */
    localSchemas?: Record<string, ZodType>
    /** Sync-only forward transforms for validation adapter contracts. */
    syncTransforms?: Record<string, (config: JsonMapType) => JsonMapType>
    /** Identifiers of specs that exist locally but may not be in remoteSpecs. */
    localOnlyIdentifiers?: string[]
  }): Promise<SpecificationCatalog> {
    const {remoteSpecs, localSchemas = {}, syncTransforms = {}, localOnlyIdentifiers = []} = options
    const specs: ModuleSpecification[] = []
    const seenIdentifiers = new Set<string>()

    const contractPromises = remoteSpecs
      .filter((remote) => remote.experience !== 'deprecated')
      .map(async (remote) => {
        const serverContract = remote.validationSchema?.jsonSchema
          ? await Contract.fromJsonSchema(remote.validationSchema.jsonSchema)
          : undefined
        return {remote, serverContract}
      })

    const resolved = await Promise.all(contractPromises)

    for (const {remote, serverContract} of resolved) {
      seenIdentifiers.add(remote.identifier)

      const localSchema = localSchemas[remote.identifier]
      const syncTransform = syncTransforms[remote.identifier]

      let adapterContract: Contract | undefined
      if (localSchema && syncTransform) {
        adapterContract = Contract.withAdapter({schema: localSchema, transform: syncTransform})
      } else if (localSchema) {
        adapterContract = Contract.fromLocalSchema(localSchema)
      }

      const contract =
        serverContract && adapterContract
          ? Contract.compose(serverContract, adapterContract)
          : (serverContract ?? adapterContract)

      specs.push(
        new ModuleSpecification({
          identifier: remote.identifier,
          name: remote.name ?? remote.externalName ?? remote.identifier,
          externalIdentifier: remote.externalIdentifier,
          contract,
          appModuleLimit: remote.options.registrationLimit,
          uidIsClientProvided: remote.options.uidIsClientProvided,
          features: normalizeFeatures(remote),
        }),
      )
    }

    for (const identifier of localOnlyIdentifiers) {
      if (seenIdentifiers.has(identifier)) continue
      const localSchema = localSchemas[identifier]
      specs.push(
        new ModuleSpecification({
          identifier,
          name: identifier,
          externalIdentifier: identifier,
          contract: localSchema ? Contract.fromLocalSchema(localSchema) : undefined,
          appModuleLimit: 1,
          uidIsClientProvided: false,
          features: [],
        }),
      )
    }

    return new SpecificationCatalog(specs)
  }

  private readonly byIdentifier: Map<string, ModuleSpecification>

  private constructor(specs: ModuleSpecification[]) {
    this.byIdentifier = new Map(specs.map((spec) => [spec.identifier, spec]))
  }

  get(identifier: string): ModuleSpecification | undefined {
    return this.byIdentifier.get(identifier)
  }

  all(): ModuleSpecification[] {
    return [...this.byIdentifier.values()]
  }
}

function normalizeFeatures(remote: RemoteSpecInput): string[] {
  const features = remote.features
  if (features && typeof features === 'object' && 'argo' in features && features.argo) {
    return ['argo']
  }
  return []
}
