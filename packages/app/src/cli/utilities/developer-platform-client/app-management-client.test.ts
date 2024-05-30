import {GatedExtensionTemplate, allowedTemplates, diffAppModules} from './app-management-client.js'
import {AppModule} from './app-management-client/graphql/app-version-by-id.js'
import {testUIExtension, testRemoteExtensionTemplates} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {describe, expect, test} from 'vitest'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

const extensionA = await testUIExtension({uid: 'extension-a-uuid'})
const extensionB = await testUIExtension({uid: 'extension-b-uuid'})
const extensionC = await testUIExtension({uid: 'extension-c-uuid'})

function moduleFromExtension(extension: ExtensionInstance): AppModule {
  return {
    gid: extension.uid,
    uid: extension.uid,
    handle: extension.handle,
    config: extension.configuration,
    specification: {
      identifier: extension.specification.identifier,
      externalIdentifier: extension.specification.externalIdentifier,
      name: extension.specification.externalName,
      experience: extension.specification.experience as 'EXTENSION' | 'CONFIGURATION',
    },
  }
}

describe('diffAppModules', () => {
  test('extracts the added, removed and updated modules between two releases', () => {
    // Given
    const [moduleA, moduleB, moduleC] = [
      moduleFromExtension(extensionA),
      moduleFromExtension(extensionB),
      moduleFromExtension(extensionC),
    ]
    const currentModules: AppModule[] = [moduleA, moduleB]
    const selectedVersionModules: AppModule[] = [moduleB, moduleC]

    // When
    const {added, removed, updated} = diffAppModules({currentModules, selectedVersionModules})

    // Then
    expect(added).toEqual([moduleC])
    expect(removed).toEqual([moduleA])
    expect(updated).toEqual([moduleB])
  })
})

describe('allowedTemplates', () => {
  test('filters templates by betas', async () => {
    // Given
    const templateWithoutRules: GatedExtensionTemplate = testRemoteExtensionTemplates[0]!
    const allowedTemplate: GatedExtensionTemplate = {
      ...testRemoteExtensionTemplates[1]!,
      organizationBetaFlags: ['allowedFlag'],
      minimumCliVersion: '1.0.0',
    }
    const templateDisallowedByCliVersion: GatedExtensionTemplate = {
      ...testRemoteExtensionTemplates[2]!,
      organizationBetaFlags: ['allowedFlag'],
      // minimum CLI version is higher than the current CLI version
      minimumCliVersion: `1${CLI_KIT_VERSION}`,
    }
    const templateDisallowedByBetaFlag: GatedExtensionTemplate = {
      ...testRemoteExtensionTemplates[3]!,
      // organization beta flag is not allowed
      organizationBetaFlags: ['notAllowedFlag'],
      minimumCliVersion: '1.0.0',
    }
    const templates: GatedExtensionTemplate[] = [
      templateWithoutRules,
      allowedTemplate,
      templateDisallowedByCliVersion,
      templateDisallowedByBetaFlag,
    ]

    // When
    const got = await allowedTemplates(templates, () => Promise.resolve({allowedFlag: true, notAllowedFlag: false}))

    // Then
    expect(got.length).toEqual(2)
    expect(got).toEqual([templateWithoutRules, allowedTemplate])
  })
})
