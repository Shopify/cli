import {AppInterface} from '../../models/app/app.js'
import {ExtensionUuidsByLocalIdentifier} from '../../models/app/identifiers.js'
import {MinimalOrganizationApp} from '../../models/organization.js'
import {AppVersion, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export type PartnersAppForIdentifierMatching = MinimalOrganizationApp

export interface EnsureDeploymentIdsPresenceOptions {
  app: AppInterface
  developerPlatformClient: DeveloperPlatformClient
  appId: string
  appName: string
  envIdentifiers: ExtensionUuidsByLocalIdentifier
  /** If true, allow adding and updating extensions and configuration without user confirmation */
  allowUpdates?: boolean
  /** If true, allow removing extensions and configuration without user confirmation */
  allowDeletes?: boolean
  release: boolean
  remoteApp: PartnersAppForIdentifierMatching
  activeAppVersion?: AppVersion
}

export interface RemoteSource {
  uuid: string
  type: string
  id: string
  title: string
  draftVersion?: {config: string}
  activeVersion?: {config: string}
}

export interface LocalSource {
  uid: string
  localIdentifier: string
  graphQLType: string
  type: string
  handle: string
  contextValue: string
  configuration?: object
}
