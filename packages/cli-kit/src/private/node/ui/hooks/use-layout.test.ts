import useLayout from './use-layout.js'
import {OutputStream} from '../../ui.js'
import {describe, expect, test, vi} from 'vitest'
import {useStdout} from 'ink'

vi.mock('ink')

describe('useLayout', async () => {
  test('it returns 2/3rds of the width if that more than the min width of 80', async () => {
    vi.mocked(useStdout).mockReturnValue({
      stdout: new OutputStream({columns: 200}) as any,
      write: () => {},
    })

    const {width} = useLayout()
    expect(width).toBe(133)
  })

  test('it returns the stdout width if that is less than the min width', async () => {
    vi.mocked(useStdout).mockReturnValue({
      stdout: new OutputStream({columns: 70}) as any,
      write: () => {},
    })

    const {width} = useLayout()
    expect(width).toBe(70)
  })

  test('it returns the min width if 2/3rds of the width are less than the min width', async () => {
    vi.mocked(useStdout).mockReturnValue({
      stdout: new OutputStream({columns: 100}) as any,
      write: () => {},
    })

    const {width} = useLayout()
    expect(width).toBe(80)
  })
})
