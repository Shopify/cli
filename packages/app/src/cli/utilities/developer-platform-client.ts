import {PartnersClient} from './developer-platform-client/partners-client.js'
import {PartnersSession} from '../../cli/services/context/partner-account-info.js'
import {MinimalOrganizationApp, Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import {ExtensionSpecification} from '../models/extensions/specification.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../api/graphql/all_app_extension_registrations.js'
import {ActiveAppVersionQuerySchema} from '../api/graphql/app_active_version.js'
import {ExtensionUpdateDraftInput, ExtensionUpdateSchema} from '../api/graphql/update_draft.js'
import {AppDeploySchema, AppDeployVariables} from '../api/graphql/app_deploy.js'
import {
  GenerateSignedUploadUrlSchema,
  GenerateSignedUploadUrlVariables,
} from '../api/graphql/generate_signed_upload_url.js'
import {ExtensionCreateSchema, ExtensionCreateVariables} from '../api/graphql/extension_create.js'
import {ConvertDevToTestStoreSchema, ConvertDevToTestStoreVariables} from '../api/graphql/convert_dev_to_test_store.js'
import {FindStoreByDomainSchema} from '../api/graphql/find_store_by_domain.js'
import {AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {FunctionUploadUrlGenerateResponse} from '@shopify/cli-kit/node/api/partners'

export type Paginateable<T> = T & {
  hasMorePages: boolean
}

export function selectDeveloperPlatformClient(): DeveloperPlatformClient {
  return new PartnersClient()
}

export interface CreateAppOptions {
  isLaunchable?: boolean
  scopesArray?: string[]
  directory?: string
}

export interface DeveloperPlatformClient {
  session: () => Promise<PartnersSession>
  refreshToken: () => Promise<string>
  accountInfo: () => Promise<PartnersSession['accountInfo']>
  appFromId: (appId: string) => Promise<OrganizationApp | undefined>
  organizations: () => Promise<Organization[]>
  selectOrg: () => Promise<Organization>
  orgFromId: (orgId: string) => Promise<Organization>
  orgAndApps: (orgId: string) => Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>>
  appsForOrg: (orgId: string, term?: string) => Promise<Paginateable<{apps: MinimalOrganizationApp[]}>>
  specifications: (appId: string) => Promise<ExtensionSpecification[]>
  createApp: (org: Organization, name: string, options?: CreateAppOptions) => Promise<OrganizationApp>
  devStoresForOrg: (orgId: string) => Promise<OrganizationStore[]>
  storeByDomain: (orgId: string, shopDomain: string) => Promise<FindStoreByDomainSchema>
  appExtensionRegistrations: (appId: string) => Promise<AllAppExtensionRegistrationsQuerySchema>
  appVersions: (appId: string) => Promise<AppVersionsQuerySchema>
  activeAppVersion: (appId: string) => Promise<ActiveAppVersionQuerySchema>
  functionUploadUrl: () => Promise<FunctionUploadUrlGenerateResponse>
  generateSignedUploadUrl: (input: GenerateSignedUploadUrlVariables) => Promise<GenerateSignedUploadUrlSchema>
  createExtension: (input: ExtensionCreateVariables) => Promise<ExtensionCreateSchema>
  updateExtension: (input: ExtensionUpdateDraftInput) => Promise<ExtensionUpdateSchema>
  deploy: (input: AppDeployVariables) => Promise<AppDeploySchema>
  convertToTestStore: (input: ConvertDevToTestStoreVariables) => Promise<ConvertDevToTestStoreSchema>
}
