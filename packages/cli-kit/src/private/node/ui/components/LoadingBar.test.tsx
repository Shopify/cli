import {LoadingBar} from './LoadingBar.js'
import {render} from '../../testing/ui.js'
import {shouldDisplayColors, unstyled} from '../../../../public/node/output.js'
import useLayout from '../hooks/use-layout.js'
import React from 'react'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../hooks/use-layout.js')
vi.mock('../../../../public/node/output.js', async () => {
  const original: any = await vi.importActual('../../../../public/node/output.js')
  return {
    ...original,
    shouldDisplayColors: vi.fn(),
  }
})

beforeEach(() => {
  // Default terminal width
  vi.mocked(useLayout).mockReturnValue({
    twoThirds: 53,
    oneThird: 27,
    fullWidth: 80,
  })
  vi.mocked(shouldDisplayColors).mockReturnValue(true)
})

describe('LoadingBar', () => {
  test('renders loading bar with default colored characters', async () => {
    // Given
    const title = 'Loading content'

    // When
    const {lastFrame} = render(<LoadingBar title={title} />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      Loading content ..."
    `)
  })

  test('renders loading bar with hill pattern when noColor prop is true', async () => {
    // Given
    const title = 'Processing files'

    // When
    const {lastFrame} = render(<LoadingBar title={title} noColor />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅
      Processing files ..."
    `)
  })

  test('renders loading bar with hill pattern when shouldDisplayColors returns false', async () => {
    // Given
    vi.mocked(shouldDisplayColors).mockReturnValue(false)
    const title = 'Downloading packages'

    // When
    const {lastFrame} = render(<LoadingBar title={title} />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅
      Downloading packages ..."
    `)
  })

  test('handles narrow terminal width correctly', async () => {
    // Given
    vi.mocked(useLayout).mockReturnValue({
      twoThirds: 20,
      oneThird: 10,
      fullWidth: 30,
    })
    const title = 'Building app'

    // When
    const {lastFrame} = render(<LoadingBar title={title} />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      Building app ..."
    `)
  })

  test('handles narrow terminal width correctly in no-color mode', async () => {
    // Given
    vi.mocked(useLayout).mockReturnValue({
      twoThirds: 15,
      oneThird: 8,
      fullWidth: 23,
    })
    const title = 'Installing'

    // When
    const {lastFrame} = render(<LoadingBar title={title} noColor />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇
      Installing ..."
    `)
  })

  test('handles very narrow terminal width in no-color mode', async () => {
    // Given
    vi.mocked(useLayout).mockReturnValue({
      twoThirds: 5,
      oneThird: 3,
      fullWidth: 8,
    })
    const title = 'Wait'

    // When
    const {lastFrame} = render(<LoadingBar title={title} noColor />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂
      Wait ..."
    `)
  })

  test('handles wide terminal width correctly', async () => {
    // Given
    vi.mocked(useLayout).mockReturnValue({
      twoThirds: 100,
      oneThird: 50,
      fullWidth: 150,
    })
    const title = 'Synchronizing data'

    // When
    const {lastFrame} = render(<LoadingBar title={title} />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      Synchronizing data ..."
    `)
  })

  test('handles wide terminal width correctly in no-color mode with pattern repetition', async () => {
    // Given
    vi.mocked(useLayout).mockReturnValue({
      twoThirds: 90,
      oneThird: 45,
      fullWidth: 135,
    })
    const title = 'Analyzing dependencies'

    // When
    const {lastFrame} = render(<LoadingBar title={title} noColor />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁
      Analyzing dependencies ..."
    `)
  })

  test('renders correctly with empty title', async () => {
    // Given
    const title = ''

    // When
    const {lastFrame} = render(<LoadingBar title={title} />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
       ..."
    `)
  })

  test('noColor prop overrides shouldDisplayColors when both would show colors', async () => {
    // Given
    vi.mocked(shouldDisplayColors).mockReturnValue(true)
    const title = 'Testing override'

    // When
    const {lastFrame} = render(<LoadingBar title={title} noColor />)

    // Then
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅
      Testing override ..."
    `)
  })

  test('renders consistently with same props', async () => {
    // Given
    const title = 'Consistent test'
    const props = {title, noColor: false}

    // When
    const {lastFrame: frame1} = render(<LoadingBar {...props} />)
    const {lastFrame: frame2} = render(<LoadingBar {...props} />)

    // Then
    expect(frame1()).toBe(frame2())
  })
})
