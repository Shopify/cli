import {formatConfigInfoBody} from './format-config-info-body.js'
import {describe, test, expect} from 'vitest'
import {Token} from '@shopify/cli-kit/node/ui'

describe('formatConfigInfoBody', () => {
  test('shows the app name', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    expect(body[0]).toMatchObject({
      list: {
        items: expect.arrayContaining(['App:             test-app']),
      },
    })
  })

  test('if there is an org, it shows an org item', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
      org: 'test-org',
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]

    expect(body[0]).toMatchObject({
      list: {
        items: expect.arrayContaining(['Org:             test-org']),
      },
    })
  })

  test('if there is no org, it does not show an org item', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    expect(body[0]).toMatchObject({
      list: {
        items: expect.not.arrayContaining([expect.stringMatching(/^Org:/)]),
      },
    })
  })

  test('if there are dev stores, it shows an item for each dev store', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
      devStores: ['store1.myshopify.com', 'store2.myshopify.com'],
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    expect(body[0]).toMatchObject({
      list: {
        items: expect.arrayContaining([
          'Dev store:       store1.myshopify.com',
          'Dev store:       store2.myshopify.com',
        ]),
      },
    })
  })

  test('if there are no dev stores, it does not show any dev store items', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    expect(body[0]).toMatchObject({
      list: {
        items: expect.not.arrayContaining([expect.stringMatching(/^Dev store:/)]),
      },
    })
  })

  test('if updateUrls is provided, it shows an item for updateUrls', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
      updateURLs: 'always',
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    expect(body[0]).toMatchObject({
      list: {
        items: expect.arrayContaining(['Update URLs:     always']),
      },
    })
  })

  test('if there are no updateUrls, it does not show an item for updateUrls', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
      updateURLs: '',
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    expect(body[0]).toMatchObject({
      list: {
        items: expect.not.arrayContaining([expect.stringMatching(/^Update URLs:/)]),
      },
    })
  })

  test('if includeConfigOnDeploy is true, it shows an item for includeConfigOnDeploy', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
      includeConfigOnDeploy: true,
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    expect(body[0]).toMatchObject({
      list: {
        items: expect.arrayContaining(['Include config:  Yes']),
      },
    })
  })

  test('if includeConfigOnDeploy is false, it shows an item for includeConfigOnDeploy with No', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
      includeConfigOnDeploy: false,
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    expect(body[0]).toMatchObject({
      list: {
        items: expect.arrayContaining(['Include config:  No']),
      },
    })
  })

  test('if includeConfigOnDeploy is undefined, it does not show an item for includeConfigOnDeploy', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    expect(body[0]).toMatchObject({
      list: {
        items: expect.not.arrayContaining([expect.stringMatching(/^Include config:/)]),
      },
    })
  })

  test('if there are messages, it shows each message as a distinct paragraph', () => {
    // GIVEN
    const message1: Token[] = ['First message']
    const message2: Token[] = ['Second message']
    const options = {
      appName: 'test-app',
      messages: [message1, message2],
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    // [list, '\n', message1, '\n\n', message2]
    expect(body).toHaveLength(5)
    expect(body[0]).toMatchObject({list: {items: expect.any(Array)}})
    expect(body[1]).toBe('\n')
    expect(body[2]).toBe('First message')
    expect(body[3]).toBe('\n\n')
    expect(body[4]).toBe('Second message')
  })

  test('if there are no messages, it does not add paragraphs', () => {
    // GIVEN
    const options = {
      appName: 'test-app',
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    // Just the list
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({list: {items: expect.any(Array)}})
  })

  test('if there are empty messages, it skips them', () => {
    // GIVEN
    const message1: Token[] = ['First message']
    const emptyMessage: Token[] = []
    const message2: Token[] = ['Second message']
    const options = {
      appName: 'test-app',
      messages: [message1, emptyMessage, message2],
    }

    // WHEN
    const result = formatConfigInfoBody(options)

    // THEN
    const body = result as Token[]
    const [, ...messages] = body
    expect(messages).toMatchObject(['\n', 'First message', '\n\n', 'Second message'])
  })
})
