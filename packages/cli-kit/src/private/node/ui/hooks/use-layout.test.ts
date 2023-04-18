import {calculateLayout} from './use-layout.js'
import {Stdout} from '../../ui.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('ink')

describe('useLayout-calculateLayout', async () => {
  describe('fullWidth', async () => {
    test('it returns 20 if the stdout width is less than 20', async () => {
      const {fullWidth} = calculateLayout(new Stdout({columns: 10}) as any)
      expect(fullWidth).toBe(20)
    })

    test('it returns the stdout width if that is more than 20', async () => {
      const {fullWidth} = calculateLayout(new Stdout({columns: 200}) as any)
      expect(fullWidth).toBe(200)
    })
  })

  describe('twoThirds', async () => {
    test('it returns 2/3rds of the width if that is more than the min width of 80', async () => {
      const {twoThirds} = calculateLayout(new Stdout({columns: 200}) as any)
      expect(twoThirds).toBe(133)
    })

    test('it returns the stdout width if that is less than the min width', async () => {
      const {twoThirds} = calculateLayout(new Stdout({columns: 70}) as any)
      expect(twoThirds).toBe(70)
    })

    test('it returns the min width if 2/3rds of the width are less than the min width', async () => {
      const {twoThirds} = calculateLayout(new Stdout({columns: 100}) as any)
      expect(twoThirds).toBe(80)
    })

    test('it returns 20 if the stdout width is less than 20', async () => {
      const {twoThirds} = calculateLayout(new Stdout({columns: 10}) as any)
      expect(twoThirds).toBe(20)
    })
  })

  describe('oneThird', async () => {
    test('it returns the stdout width if that is less than the min width', async () => {
      const {oneThird} = calculateLayout(new Stdout({columns: 70}) as any)
      expect(oneThird).toBe(70)
    })

    test('it returns the min width if 1/3rd of the width are less than the min width', async () => {
      const {oneThird} = calculateLayout(new Stdout({columns: 120}) as any)
      expect(oneThird).toBe(80)
    })

    test('it returns 1/3rd of the width if that is more than the min width of 80', async () => {
      const {oneThird} = calculateLayout(new Stdout({columns: 300}) as any)
      expect(oneThird).toBe(100)
    })

    test('it returns 20 if the stdout width is less than 20', async () => {
      const {oneThird} = calculateLayout(new Stdout({columns: 10}) as any)
      expect(oneThird).toBe(20)
    })
  })
})
