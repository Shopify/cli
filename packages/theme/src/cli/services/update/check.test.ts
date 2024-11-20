import {check} from './check.js'
import {test, describe, expect, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import * as file from '@shopify/cli-kit/node/fs'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

describe('check', () => {
  test("when update script does't exist", async () => {
    // Given
    const script = '/tmp/update_extension.json'

    vi.spyOn(file, 'fileExists').mockResolvedValue(false)

    // When
    const got = check(script)

    // Then
    await expect(got).rejects.toThrowError(AbortError)
  })

  test('when update script is valid', async () => {
    // Given
    const script = '/tmp/update_extension.json'

    vi.spyOn(file, 'fileExists').mockResolvedValue(true)
    vi.spyOn(file, 'readFile').mockResolvedValueOnce(mockedFileContent(data()))

    // When
    const errors = await checkErrors(script)

    // Then
    expect(errors).toEqual([])
    expect(renderSuccess).toBeCalledWith({
      body: [`The '/tmp/update_extension.json' script is valid.`],
    })
  })

  test('when update script is invalid', async () => {
    // Given
    const script = '/tmp/update_extension.json'

    vi.spyOn(file, 'fileExists').mockResolvedValue(true)
    vi.spyOn(file, 'readFile').mockResolvedValueOnce(mockedFileContent({}))

    // When
    const errors = await checkErrors(script)

    // Then
    expect(errors).toEqual([
      'The "$schema" property is required',
      'The "theme_name" property is required',
      'The "theme_version" property is required',
      'The "operations" property is required',
    ])
  })

  test('when theme_name is not present', async () => {
    // Given
    const script = '/tmp/update_extension.json'

    vi.spyOn(file, 'fileExists').mockResolvedValue(true)
    vi.spyOn(file, 'readFile').mockResolvedValueOnce(
      mockedFileContent({
        ...data(),
        theme_name: undefined,
      }),
    )

    // When
    const errors = await checkErrors(script)

    // Then
    expect(errors).toEqual(['The "theme_name" property is required'])
  })

  test('when theme_version is not present', async () => {
    // Given
    const script = '/tmp/update_extension.json'

    vi.spyOn(file, 'fileExists').mockResolvedValue(true)
    vi.spyOn(file, 'readFile').mockResolvedValueOnce(
      mockedFileContent({
        ...data(),
        theme_version: undefined,
      }),
    )

    // When
    const errors = await checkErrors(script)

    // Then
    expect(errors).toEqual(['The "theme_version" property is required'])
  })

  test('when operations is not present', async () => {
    // Given
    const script = '/tmp/update_extension.json'

    vi.spyOn(file, 'fileExists').mockResolvedValue(true)
    vi.spyOn(file, 'readFile').mockResolvedValueOnce(
      mockedFileContent({
        ...data(),
        operations: undefined,
      }),
    )

    // When
    const errors = await checkErrors(script)

    // Then
    expect(errors).toEqual(['The "operations" property is required'])
  })

  test('when operations is an empty array', async () => {
    // Given
    const script = '/tmp/update_extension.json'

    vi.spyOn(file, 'fileExists').mockResolvedValue(true)
    vi.spyOn(file, 'readFile').mockResolvedValueOnce(
      mockedFileContent({
        ...data(),
        operations: [],
      }),
    )

    // When
    const errors = await checkErrors(script)

    // Then
    expect(errors).toEqual(['The "operations" array must contain at least 1 element(s)'])
  })

  test(`when an operation doesn't have the id property`, async () => {
    const actions = ['add', 'delete', 'copy', 'move']

    for (const action of actions) {
      // Given
      const script = '/tmp/update_extension.json'

      vi.spyOn(file, 'fileExists').mockResolvedValue(true)
      vi.spyOn(file, 'readFile').mockResolvedValueOnce(
        mockedFileContent({
          ...data(),
          operations: [
            {
              actions: [
                {
                  ...operation(action),
                },
              ],
            },
          ],
        }),
      )

      // When
      // eslint-disable-next-line no-await-in-loop
      const errors = await checkErrors(script)

      // Then
      expect(errors).toEqual([`The "operations/0/id" property is required`])
    }
  })

  test(`when an operation doesn't have the action property`, async () => {
    const actions = ['add', 'delete', 'copy', 'move']

    for (const action of actions) {
      // Given
      const script = '/tmp/update_extension.json'

      vi.spyOn(file, 'fileExists').mockResolvedValue(true)
      vi.spyOn(file, 'readFile').mockResolvedValueOnce(
        mockedFileContent({
          ...data(),
          operations: [
            {
              id: 'operation_x',
            },
          ],
        }),
      )

      // When
      // eslint-disable-next-line no-await-in-loop
      const errors = await checkErrors(script)

      // Then
      expect(errors).toEqual([`The "operations/0/actions" property is required`])
    }
  })

  test(`when operations contain a step with an invalid file property`, async () => {
    const actions = ['add', 'delete', 'copy', 'move']

    for (const action of actions) {
      // Given
      const script = '/tmp/update_extension.json'

      vi.spyOn(file, 'fileExists').mockResolvedValue(true)
      vi.spyOn(file, 'readFile').mockResolvedValueOnce(
        mockedFileContent({
          ...data(),
          operations: [
            {
              id: 'operation_x',
              actions: [
                {
                  ...operation(action),
                  file: 123,
                },
              ],
            },
          ],
        }),
      )

      // When
      // eslint-disable-next-line no-await-in-loop
      const errors = await checkErrors(script)

      // Then
      expect(errors).toEqual([`The "operations/0/actions/0" doesn't have the expected attributes`])
    }
  })

  test(`when operations contain a step with an invalid key property`, async () => {
    const actions = ['add', 'delete']

    for (const action of actions) {
      // Given
      const script = '/tmp/update_extension.json'

      vi.spyOn(file, 'fileExists').mockResolvedValue(true)
      vi.spyOn(file, 'readFile').mockResolvedValueOnce(
        mockedFileContent({
          ...data(),
          operations: [
            {
              id: 'operation_x',
              actions: [
                {
                  ...operation(action),
                  key: 123,
                },
              ],
            },
          ],
        }),
      )

      // When
      // eslint-disable-next-line no-await-in-loop
      const errors = await checkErrors(script)

      // Then
      expect(errors).toEqual([`The "operations/0/actions/0" doesn't have the expected attributes`])
    }
  })

  test(`when operations contain a step with an invalid from_key property`, async () => {
    const actions = ['copy', 'move']

    for (const action of actions) {
      // Given
      const script = '/tmp/update_extension.json'

      vi.spyOn(file, 'fileExists').mockResolvedValue(true)
      vi.spyOn(file, 'readFile').mockResolvedValueOnce(
        mockedFileContent({
          ...data(),
          operations: [
            {
              id: 'operation_x',
              actions: [
                {
                  ...operation(action),
                  from_key: 123,
                },
              ],
            },
          ],
        }),
      )

      // When
      // eslint-disable-next-line no-await-in-loop
      const errors = await checkErrors(script)

      // Then
      expect(errors).toEqual([`The "operations/0/actions/0" doesn't have the expected attributes`])
    }
  })

  test(`when operations contain a step with an invalid action property`, async () => {
    const actions = ['add', 'delete', 'copy', 'move']

    for (const action of actions) {
      // Given
      const script = '/tmp/update_extension.json'

      vi.spyOn(file, 'fileExists').mockResolvedValue(true)
      vi.spyOn(file, 'readFile').mockResolvedValueOnce(
        mockedFileContent({
          ...data(),
          operations: [
            {
              id: 'operation_x',
              actions: [
                {
                  ...operation(action),
                  action: 'action',
                },
              ],
            },
          ],
        }),
      )

      // When
      // eslint-disable-next-line no-await-in-loop
      const errors = await checkErrors(script)

      // Then
      expect(errors).toEqual([`The "operations/0/actions/0" doesn't have the expected attributes`])
    }
  })

  test(`when operations contain a step with an invalid action property`, async () => {
    const actions = ['add', 'delete', 'copy', 'move']

    for (const action of actions) {
      // Given
      const script = '/tmp/update_extension.json'
      vi.spyOn(file, 'fileExists').mockResolvedValue(true)
      vi.spyOn(file, 'readFile').mockResolvedValueOnce(
        mockedFileContent({
          ...data(),
          operations: [
            {
              id: 'operation_x',
              actions: [
                {
                  action,
                  file: 'file.json',
                  key: 123,
                  value: 123,
                },
              ],
            },
          ],
        }),
      )

      // When
      // eslint-disable-next-line no-await-in-loop
      const errors = await checkErrors(script)

      // Then
      expect(errors).toEqual([`The "operations/0/actions/0" doesn't have the expected attributes`])
    }
  })

  test(`when operations contain a step missing required properties`, async () => {
    const actions = ['add', 'delete', 'copy', 'move']

    for (const action of actions) {
      // Given
      const script = '/tmp/update_extension.json'

      vi.spyOn(file, 'fileExists').mockResolvedValue(true)
      vi.spyOn(file, 'readFile').mockResolvedValueOnce(
        mockedFileContent({
          ...data(),
          operations: [
            {
              id: 'operation_x',
              actions: [
                {
                  action,
                  file: 'file.json',
                },
              ],
            },
          ],
        }),
      )

      // When
      // eslint-disable-next-line no-await-in-loop
      const errors = await checkErrors(script)

      // Then
      expect(errors).toEqual([`The "operations/0/actions/0" doesn't have the expected attributes`])
    }
  })

  test(`when script has additional properties`, async () => {
    // Given
    const script = '/tmp/update_extension.json'

    vi.spyOn(file, 'fileExists').mockResolvedValue(true)
    vi.spyOn(file, 'readFile').mockResolvedValueOnce(
      mockedFileContent({
        ...data(),
        extra_property: 'extra_value',
      }),
    )

    // When

    const errors = await checkErrors(script)

    // Then
    expect(errors).toEqual([`The "extra_property" is not a permitted key`])
  })

  test(`when a step has additional properties`, async () => {
    const actions = ['add', 'delete', 'copy', 'move']

    for (const action of actions) {
      // Given
      const script = '/tmp/update_extension.json'

      vi.spyOn(file, 'fileExists').mockResolvedValue(true)
      vi.spyOn(file, 'readFile').mockResolvedValueOnce(
        mockedFileContent({
          ...data(),
          operations: [
            {
              id: 'operation_x',
              actions: [
                {
                  ...operation(action),
                  extra_property: 'extra_value',
                },
              ],
            },
          ],
        }),
      )

      // When
      // eslint-disable-next-line no-await-in-loop
      const errors = await checkErrors(script)

      // Then
      expect(errors).toEqual([`The "extra_property" at "operations/0/actions/0" is not a permitted key`])
    }
  })
})

async function checkErrors(script: string) {
  try {
    await check(script)

    return []
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error: any) {
    return error.tryMessage.list.items
  }
}

function data() {
  return {
    $schema: 'update_extension_schema_v1.json',
    theme_name: 'Dawn',
    theme_version: '1.0.0',
    operations: [
      {
        id: 'operation_x',
        actions: [
          {
            action: 'move',
            file: 'file.json',
            from_key: 'key1',
            to_key: 'key2',
          },
        ],
      },
      {
        id: 'operation_y',
        actions: [
          {
            action: 'add',
            file: 'file.json',
            key: 'key1',
            value: ['key1'],
          },
          {
            action: 'delete',
            file: 'file.json',
            key: 'key1',
          },
        ],
      },
    ],
  }
}

function operation(action: string) {
  return {
    add: {
      action: 'add',
      file: 'file.json',
      key: 'key1',
      value: ['key1'],
    },
    move: {
      action: 'move',
      file: 'file.json',
      from_key: 'key1',
      to_key: 'key2',
    },
    copy: {
      action: 'move',
      file: 'file.json',
      from_key: 'key1',
      to_key: 'key2',
    },
    delete: {
      action: 'delete',
      file: 'file.json',
      key: 'key1',
    },
  }[action]
}

function mockedFileContent(json: any) {
  return Buffer.from(JSON.stringify(json), 'utf-8')
}
