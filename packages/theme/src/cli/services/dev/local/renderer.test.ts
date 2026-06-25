import {helloWorldRenderer} from './renderer.js'
import {RenderRequest} from './types.js'
import {describe, expect, test} from 'vitest'

const request: RenderRequest = {path: '/', method: 'GET', headers: {}}

describe('helloWorldRenderer', () => {
  test('returns a 200 hello-world HTML response', async () => {
    // Given
    const renderer = helloWorldRenderer('CLIENT_SCRIPT')

    // When
    const result = await renderer.render(request)

    // Then
    expect(result.status).toBe(200)
    expect(result.headers['content-type']).toContain('text/html')
    expect(result.body.toLowerCase()).toContain('hello world')
  })

  test('injects the client script before the closing head tag', async () => {
    // Given
    const renderer = helloWorldRenderer('MY_UNIQUE_SCRIPT')

    // When
    const {body} = await renderer.render(request)

    // Then
    expect(body).toContain('MY_UNIQUE_SCRIPT')
    const scriptIndex = body.indexOf('MY_UNIQUE_SCRIPT')
    const headCloseIndex = body.indexOf('</head>')
    expect(scriptIndex).toBeGreaterThanOrEqual(0)
    expect(headCloseIndex).toBeGreaterThan(scriptIndex)
  })
})
