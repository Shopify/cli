import {handleLiquidThemesSkill} from './liquid_themes.js'
import {describe, test, expect} from 'vitest'

describe('handleLiquidThemesSkill', () => {
  test('returns a single text content item', () => {
    const result = handleLiquidThemesSkill()

    expect(result.content).toHaveLength(1)
    expect(result.content[0]!.type).toBe('text')
    expect(result.content[0]!.text.length).toBeGreaterThan(0)
  })

  test('includes SKILL.md and reference files separated by ---', () => {
    const result = handleLiquidThemesSkill()
    const sections = result.content[0]!.text.split('\n\n---\n\n')

    expect(sections.length).toBe(11)
    for (const section of sections.slice(1)) {
      expect(section).toMatch(/^# Reference: /)
    }
  })

  test('reference files are sorted alphabetically', () => {
    const result = handleLiquidThemesSkill()
    const refNames = result.content[0]!.text
      .split('\n\n---\n\n')
      .slice(1)
      .map((s) => s.split('\n')[0])

    expect(refNames).toEqual([...refNames].sort())
  })
})
