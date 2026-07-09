import {executeGenerateGraphqlTypesStep} from './generate-graphql-types-step.js'
import * as typegen from '../../extension/typegen.js'
import {BuildContext, LifecycleStep} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../extension/typegen.js')

describe('executeGenerateGraphqlTypesStep', () => {
  let mockContext: BuildContext

  const step: LifecycleStep = {
    id: 'generate-graphql-types',
    name: 'Generate GraphQL types',
    type: 'generate_graphql_types',
  }

  beforeEach(() => {
    mockContext = {
      extension: {
        directory: '/test/extension',
        configuration: {},
      } as ExtensionInstance,
      options: {
        stdout: {write: vi.fn()} as any,
        stderr: {write: vi.fn()} as any,
        app: {} as any,
        environment: 'production',
      },
      stepResults: new Map(),
    }
  })

  test('runs typegen when a target declares an input_query', async () => {
    // Given
    mockContext.extension.configuration = {
      extension_points: [{target: 'purchase.checkout.block.render', input_query: 'src/run.graphql'}],
    } as ExtensionInstance['configuration']

    // When
    await executeGenerateGraphqlTypesStep(step, mockContext)

    // Then
    expect(typegen.buildGraphqlTypes).toHaveBeenCalledWith(mockContext.extension, mockContext.options)
  })

  test('runs typegen when any of several targets declares an input_query', async () => {
    // Given
    mockContext.extension.configuration = {
      extension_points: [
        {target: 'purchase.checkout.block.render'},
        {target: 'purchase.checkout.footer.render', input_query: 'src/footer.graphql'},
      ],
    } as ExtensionInstance['configuration']

    // When
    await executeGenerateGraphqlTypesStep(step, mockContext)

    // Then
    expect(typegen.buildGraphqlTypes).toHaveBeenCalledOnce()
  })

  test('is a no-op when no target declares an input_query', async () => {
    // Given
    mockContext.extension.configuration = {
      extension_points: [{target: 'purchase.checkout.block.render'}],
    } as ExtensionInstance['configuration']

    // When
    await executeGenerateGraphqlTypesStep(step, mockContext)

    // Then
    expect(typegen.buildGraphqlTypes).not.toHaveBeenCalled()
  })

  test('is a no-op when input_query is present but empty', async () => {
    // Given
    mockContext.extension.configuration = {
      extension_points: [{target: 'purchase.checkout.block.render', input_query: ''}],
    } as ExtensionInstance['configuration']

    // When
    await executeGenerateGraphqlTypesStep(step, mockContext)

    // Then
    expect(typegen.buildGraphqlTypes).not.toHaveBeenCalled()
  })

  test('is a no-op when there are no extension_points', async () => {
    // Given
    mockContext.extension.configuration = {} as ExtensionInstance['configuration']

    // When
    await executeGenerateGraphqlTypesStep(step, mockContext)

    // Then
    expect(typegen.buildGraphqlTypes).not.toHaveBeenCalled()
  })
})
