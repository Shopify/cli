import Validate from './validate.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {validateApp} from '../../../services/validate.js'
import {testAppLinked} from '../../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/validate.js')

describe('app config validate command', () => {
  test('calls validateApp with json: false by default', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    // When
    await Validate.run([], import.meta.url)

    // Then
    expect(validateApp).toHaveBeenCalledWith(app, {json: false})
  })

  test('calls validateApp with json: true when --json flag is passed', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    // When
    await Validate.run(['--json'], import.meta.url)

    // Then
    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
  })

  test('calls validateApp with json: true when -j flag is passed', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    // When
    await Validate.run(['-j'], import.meta.url)

    // Then
    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
  })
})
