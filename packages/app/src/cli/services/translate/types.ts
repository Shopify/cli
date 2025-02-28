import {AppLinkedInterface} from '../../models/app/app.js'
import {AppTranslateSchema} from '../../api/graphql/app_translate.js'
import {OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export interface TaskContext {
  appTranslates: AppTranslateSchema[]
  allFulfiled: boolean
  errors: string[]
}
export interface TranslateOptions {
  /** The app to be built and uploaded */
  app: AppLinkedInterface

  /** The remote app to be translated */
  remoteApp: OrganizationApp

  /** The developer platform client */
  developerPlatformClient: DeveloperPlatformClient

  /** If true, do not prompt */
  force: boolean
}

export interface TranslationRequestData {
  updatedSourceFiles: TranslationSourceFile[]
  targetFilesToUpdate: TranslationTargetFile[]
}
export interface TranslationSourceFile {
  fileName: string
  language: string
  content: {[key: string]: unknown}
}
export interface TranslationTargetFile {
  fileName: string
  language: string
  keysToCreate: string[]
  keysToDelete: string[]
  keysToUpdate: string[]
  content: {[key: string]: unknown}
  manifestStrings: {[key: string]: string}
}

export interface ManifestEntry {
  file: string
  strings: {[key: string]: string}
}

export type Manifest = ManifestEntry[]
