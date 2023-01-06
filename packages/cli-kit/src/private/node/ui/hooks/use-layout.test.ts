import useLayout from './use-layout.js'
import {OutputStream} from '../../ui.js'
import {describe, expect, test, vi} from 'vitest'
import {useStdout} from 'ink'

vi.mock('ink')

describe('useLayout', async () => {
  describe('twoThirds', async () => {
    test('it returns 2/3rds of the width if that is more than the min width of 80', async () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: new OutputStream({columns: 200}) as any,
        write: () => {},
      })

      const {twoThirds} = useLayout()
      expect(twoThirds).toBe(133)
    })

    test('it returns the stdout width if that is less than the min width', async () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: new OutputStream({columns: 70}) as any,
        write: () => {},
      })

      const {twoThirds} = useLayout()
      expect(twoThirds).toBe(70)
    })

    test('it returns the min width if 2/3rds of the width are less than the min width', async () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: new OutputStream({columns: 100}) as any,
        write: () => {},
      })

      const {twoThirds} = useLayout()
      expect(twoThirds).toBe(80)
    })
  })

  describe('oneThird', async () => {
    test('it returns the stdout width if that is less than the min width', async () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: new OutputStream({columns: 70}) as any,
        write: () => {},
      })

      const {oneThird} = useLayout()
      expect(oneThird).toBe(70)
    })

    test('it returns the min width if 1/3rd of the width are less than the min width', async () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: new OutputStream({columns: 120}) as any,
        write: () => {},
      })

      const {oneThird} = useLayout()
      expect(oneThird).toBe(80)
    })

    test('it returns 1/3rd of the width if that is more than the min width of 80', async () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: new OutputStream({columns: 300}) as any,
        write: () => {},
      })

      const {oneThird} = useLayout()
      expect(oneThird).toBe(100)
    })
  })
})
