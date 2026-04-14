import {ZodSchemaType} from './schemas.js'
import {ModuleDescriptor} from './module-descriptor.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {outputDebug} from '@shopify/cli-kit/node/output'

/**
 * Registry of all known module descriptors.
 *
 * Provides the pre-instantiation API needed by the app loader:
 * - Type lookup: find the right descriptor for a given type string
 * - Schema building: fold all config descriptors into the app config schema
 * - Remote merging: apply remote spec overrides to local descriptors
 * - Dynamic registration: add contract-based descriptors for remote-only types
 *
 * Replaces the flat `ExtensionSpecification[]` array that was previously
 * threaded through the app loading pipeline.
 */
export class ModuleRegistry {
  private descriptors: ModuleDescriptor[] = []

  register(descriptor: ModuleDescriptor): void {
    this.descriptors.push(descriptor)
  }

  /**
   * Find the descriptor that handles a given type string.
   * Matches against identifier, externalIdentifier, and additionalIdentifiers.
   */
  findForType(type: string): ModuleDescriptor | undefined {
    return this.descriptors.find(
      (desc) =>
        desc.identifier === type || desc.externalIdentifier === type || desc.additionalIdentifiers.includes(type),
    )
  }

  /**
   * Build the app configuration schema by folding all descriptor contributions.
   * Each config descriptor merges its schema into the accumulator.
   */
  buildAppConfigurationSchema<T>(baseSchema: ZodSchemaType<T>): ZodSchemaType<unknown> {
    return this.descriptors.reduce<ZodSchemaType<unknown>>(
      (schema, desc) => desc.contributeToAppConfigurationSchema(schema),
      baseSchema,
    )
  }

  allDescriptors(): ModuleDescriptor[] {
    return [...this.descriptors]
  }

  configDescriptors(): ModuleDescriptor[] {
    return this.descriptors.filter((desc) => desc.experience === 'configuration')
  }

  extensionDescriptors(): ModuleDescriptor[] {
    return this.descriptors.filter((desc) => desc.experience === 'extension')
  }

  /**
   * Merge remote spec data into local descriptors.
   * Remote values override local for: externalName, externalIdentifier,
   * registrationLimit, uidStrategy, surface.
   *
   * Returns the list of remote specs that had no local descriptor match
   * (these may need contract-based descriptors created separately).
   */
  mergeRemoteSpecs(remoteSpecs: RemoteSpecification[]): RemoteSpecification[] {
    const unmatchedRemote: RemoteSpecification[] = []

    for (const remoteSpec of remoteSpecs) {
      const local = this.descriptors.find((desc) => desc.identifier === remoteSpec.identifier)
      if (local) {
        local.externalName = remoteSpec.externalName
        local.externalIdentifier = remoteSpec.externalIdentifier
        local.registrationLimit = remoteSpec.registrationLimit
        local.uidStrategy = remoteSpec.uidStrategy
        local.surface = remoteSpec.surface ?? local.surface
      } else {
        unmatchedRemote.push(remoteSpec)
      }
    }

    const presentLocalMissingRemote = this.descriptors.filter(
      (desc) => !remoteSpecs.some((rs) => rs.identifier === desc.identifier),
    )
    if (presentLocalMissingRemote.length > 0) {
      outputDebug(
        `Module descriptors without matching remote spec: ${presentLocalMissingRemote
          .map((desc) => desc.identifier)
          .sort()
          .join(', ')}`,
      )
    }

    if (unmatchedRemote.length > 0) {
      outputDebug(
        `Remote specs without matching local descriptor: ${unmatchedRemote
          .map((rs) => rs.identifier)
          .sort()
          .join(', ')}`,
      )
    }

    return unmatchedRemote
  }

  /**
   * Remove descriptors that have no matching remote spec.
   * Used to filter out gated descriptors the user can't access.
   */
  retainOnlyMatching(remoteSpecs: RemoteSpecification[]): void {
    this.descriptors = this.descriptors.filter((desc) => remoteSpecs.some((rs) => rs.identifier === desc.identifier))
  }

  get size(): number {
    return this.descriptors.length
  }
}
