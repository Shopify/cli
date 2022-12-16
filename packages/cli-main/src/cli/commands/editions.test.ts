import Editions from './editions.js'
import {describe, test, afterEach, vi, beforeEach, expect} from 'vitest'
import {ui, outputMocker} from '@shopify/cli-kit'

describe('upgrade command', () => {
  beforeEach(() => {
    vi.mock('@shopify/cli-kit', async () => {
      return {
        ...(await vi.importActual<typeof import('@shopify/cli-kit')>('@shopify/cli-kit')),
        ui: {
          prompt: vi.fn(),
        },
      }
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    outputMocker.mockAndCaptureOutput().clear()
  })

  test.each(['bfs', 'hydrogen', 'devtools'])('launches service with %s', async (mode) => {
    vi.mocked(ui.prompt).mockResolvedValue({editionschoice: mode})
    const mockOutput = outputMocker.mockAndCaptureOutput()
    await Editions.run([], import.meta.url)
    expect(mockOutput.info()).toMatchSnapshot()
  })
})
