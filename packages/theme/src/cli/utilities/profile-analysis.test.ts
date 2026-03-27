import {
  analyzeProfile,
  classifyFrame,
  normalizeToMs,
  formatTime,
  parseEventedProfile,
  parseSampledProfile,
  generateInsights,
  mergeCallers,
  renderAnalysisResult,
  formatItemLine,
  formatOperationName,
  hasOperationDetail,
  isEntryPointFrame,
  type SpeedscopeSchema,
  type EventedProfile,
  type SampledProfile,
  type SpeedscopeFrame,
  type AnalysisItem,
  type CallerInfo,
  type CategorySummary,
  type FileStats,
} from './profile-analysis.js'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import {vi, describe, expect, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

function makeEventedSchema(
  frames: SpeedscopeFrame[],
  events: {type: 'O' | 'C'; frame: number; at: number}[],
): SpeedscopeSchema {
  return {
    shared: {frames},
    profiles: [
      {
        type: 'evented' as const,
        name: 'test',
        unit: 'milliseconds' as const,
        startValue: 0,
        endValue: events.length > 0 ? events[events.length - 1]!.at : 0,
        events,
      },
    ],
  }
}

function makeSampledSchema(frames: SpeedscopeFrame[], samples: number[][], weights: number[]): SpeedscopeSchema {
  return {
    shared: {frames},
    profiles: [
      {
        type: 'sampled' as const,
        name: 'test',
        unit: 'milliseconds' as const,
        startValue: 0,
        endValue: weights.reduce((first, second) => first + second, 0),
        samples,
        weights,
      },
    ],
  }
}

describe('profile-analysis', () => {
  describe('normalizeToMs', () => {
    test('converts nanoseconds to milliseconds', () => {
      expect(normalizeToMs(1_000_000, 'nanoseconds')).toBe(1)
    })

    test('converts microseconds to milliseconds', () => {
      expect(normalizeToMs(1_000, 'microseconds')).toBe(1)
    })

    test('keeps milliseconds as-is', () => {
      expect(normalizeToMs(42, 'milliseconds')).toBe(42)
    })

    test('converts seconds to milliseconds', () => {
      expect(normalizeToMs(1, 'seconds')).toBe(1000)
    })

    test('returns value unchanged for none unit', () => {
      expect(normalizeToMs(5, 'none')).toBe(5)
    })
  })

  describe('formatTime', () => {
    test('formats large values in milliseconds', () => {
      expect(formatTime(1500)).toBe('1500.00ms')
    })

    test('formats milliseconds for values >= 0.01ms', () => {
      expect(formatTime(42.5)).toBe('42.50ms')
    })

    test('formats small sub-millisecond values in milliseconds', () => {
      expect(formatTime(0.5)).toBe('0.50ms')
    })

    test('formats very small values as < 0.01ms', () => {
      expect(formatTime(0.001)).toBe('< 0.01ms')
    })
  })

  describe('classifyFrame', () => {
    test('classifies snippet files', () => {
      expect(classifyFrame({name: 'render', file: 'snippets/header.liquid'})).toBe('Snippets')
    })

    test('classifies snippet names', () => {
      expect(classifyFrame({name: 'snippet:header'})).toBe('Snippets')
    })

    test('classifies section files', () => {
      expect(classifyFrame({name: 'render', file: 'sections/hero.liquid'})).toBe('Sections')
    })

    test('classifies layout files', () => {
      expect(classifyFrame({name: 'render', file: 'layout/theme.liquid'})).toBe('Layout')
    })

    test('classifies template files', () => {
      expect(classifyFrame({name: 'render', file: 'templates/index.liquid'})).toBe('Templates')
    })

    test('classifies block files', () => {
      expect(classifyFrame({name: 'render', file: 'blocks/slideshow.liquid'})).toBe('Blocks')
    })

    test('classifies render/include names', () => {
      expect(classifyFrame({name: 'render "header"'})).toBe('Render/Include')
      expect(classifyFrame({name: 'include "footer"'})).toBe('Render/Include')
    })

    test('classifies control flow', () => {
      expect(classifyFrame({name: 'for item in collection'})).toBe('Control Flow')
      expect(classifyFrame({name: 'if product.available'})).toBe('Control Flow')
      expect(classifyFrame({name: 'case product.type'})).toBe('Control Flow')
    })

    test('classifies variables', () => {
      expect(classifyFrame({name: 'assign x = 1'})).toBe('Variables')
      expect(classifyFrame({name: 'capture content'})).toBe('Variables')
    })

    test('classifies unknown as Other', () => {
      expect(classifyFrame({name: 'something-unknown'})).toBe('Other')
    })
  })

  describe('isEntryPointFrame', () => {
    test('identifies liquid_template as entry point', () => {
      expect(isEntryPointFrame({name: 'liquid_template', file: 'snippets/card.liquid'})).toBe(true)
    })

    test('identifies section as entry point', () => {
      expect(isEntryPointFrame({name: 'section', file: 'sections/header.liquid'})).toBe(true)
    })

    test('identifies raw_section as entry point', () => {
      expect(isEntryPointFrame({name: 'raw_section', file: 'sections/raw.liquid'})).toBe(true)
    })

    test('does not identify tag:for as entry point', () => {
      expect(isEntryPointFrame({name: 'tag:for item in list', file: 'snippets/card.liquid'})).toBe(false)
    })

    test('does not identify render as entry point', () => {
      expect(isEntryPointFrame({name: 'render', file: 'snippets/card.liquid'})).toBe(false)
    })

    test('does not identify filter as entry point', () => {
      expect(isEntryPointFrame({name: 'filter:asset_url'})).toBe(false)
    })
  })

  describe('parseEventedProfile', () => {
    test('parses evented profile with open/close events', () => {
      const frames: SpeedscopeFrame[] = [{name: 'frame-a'}, {name: 'frame-b'}]
      const profile: EventedProfile = {
        type: 'evented',
        name: 'test',
        unit: 'nanoseconds',
        startValue: 0,
        endValue: 1000,
        events: [
          {type: 'O', frame: 0, at: 0},
          {type: 'O', frame: 1, at: 200},
          {type: 'C', frame: 1, at: 500},
          {type: 'C', frame: 0, at: 1000},
        ],
      }

      const result = parseEventedProfile(profile, frames)

      expect(result.selfTimes.get(0)).toBe(700)
      expect(result.selfTimes.get(1)).toBe(300)
    })

    test('counts call counts from O events', () => {
      const frames: SpeedscopeFrame[] = [{name: 'render', file: 'snippets/card.liquid'}]
      const profile: EventedProfile = {
        type: 'evented',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 30,
        events: [
          {type: 'O', frame: 0, at: 0},
          {type: 'C', frame: 0, at: 10},
          {type: 'O', frame: 0, at: 10},
          {type: 'C', frame: 0, at: 20},
          {type: 'O', frame: 0, at: 20},
          {type: 'C', frame: 0, at: 30},
        ],
      }

      const result = parseEventedProfile(profile, frames)

      expect(result.callCounts.get(0)).toBe(3)
      expect(result.selfTimes.get(0)).toBe(30)
    })

    test('tracks call counts for multiple frames', () => {
      const frames: SpeedscopeFrame[] = [
        {name: 'render', file: 'snippets/card.liquid'},
        {name: 'asset_url', file: 'snippets/card.liquid'},
      ]
      const profile: EventedProfile = {
        type: 'evented',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 20,
        events: [
          {type: 'O', frame: 0, at: 0},
          {type: 'O', frame: 1, at: 2},
          {type: 'C', frame: 1, at: 5},
          {type: 'O', frame: 1, at: 6},
          {type: 'C', frame: 1, at: 8},
          {type: 'C', frame: 0, at: 20},
        ],
      }

      const result = parseEventedProfile(profile, frames)

      expect(result.callCounts.get(0)).toBe(1)
      expect(result.callCounts.get(1)).toBe(2)
      // Frame 0 self time = 20 - (5-2 + 8-6) = 20 - 5 = 15
      expect(result.selfTimes.get(0)).toBe(15)
      // Frame 1 self time = (5-2) + (8-6) = 3 + 2 = 5
      expect(result.selfTimes.get(1)).toBe(5)
    })

    test('tracks render counts for entry-point frames only', () => {
      const frames: SpeedscopeFrame[] = [
        {name: 'liquid_template', file: 'snippets/card.liquid'},
        {name: 'tag:for item in list', file: 'snippets/card.liquid'},
      ]
      const profile: EventedProfile = {
        type: 'evented',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 30,
        events: [
          {type: 'O', frame: 0, at: 0},
          {type: 'O', frame: 1, at: 2},
          {type: 'C', frame: 1, at: 5},
          {type: 'C', frame: 0, at: 10},
          {type: 'O', frame: 0, at: 10},
          {type: 'O', frame: 1, at: 12},
          {type: 'C', frame: 1, at: 15},
          {type: 'C', frame: 0, at: 20},
          {type: 'O', frame: 0, at: 20},
          {type: 'O', frame: 1, at: 22},
          {type: 'C', frame: 1, at: 25},
          {type: 'C', frame: 0, at: 30},
        ],
      }

      const result = parseEventedProfile(profile, frames)

      // liquid_template (frame 0) opened 3 times -> renderCounts = 3
      expect(result.renderCounts.get(0)).toBe(3)
      // tag:for (frame 1) is not an entry-point -> renderCounts should not have it
      expect(result.renderCounts.has(1)).toBe(false)
      // callCounts still tracks all opens
      expect(result.callCounts.get(0)).toBe(3)
      expect(result.callCounts.get(1)).toBe(3)
    })

    test('handles empty events', () => {
      const frames: SpeedscopeFrame[] = [{name: 'frame-a'}]
      const profile: EventedProfile = {
        type: 'evented',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 0,
        events: [],
      }

      const result = parseEventedProfile(profile, frames)
      expect(result.selfTimes.size).toBe(0)
      expect(result.callCounts.size).toBe(0)
      expect(result.callerCounts.size).toBe(0)
    })

    test('tracks parent-child caller relationships', () => {
      const frames: SpeedscopeFrame[] = [
        {name: 'render', file: 'sections/header.liquid'},
        {name: 'render', file: 'snippets/spacing-style.liquid'},
      ]
      const profile: EventedProfile = {
        type: 'evented',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 20,
        events: [
          {type: 'O', frame: 0, at: 0},
          {type: 'O', frame: 1, at: 2},
          {type: 'C', frame: 1, at: 5},
          {type: 'O', frame: 1, at: 6},
          {type: 'C', frame: 1, at: 8},
          {type: 'C', frame: 0, at: 20},
        ],
      }

      const result = parseEventedProfile(profile, frames)

      // Frame 1 (snippets/spacing-style) was called 2 times from frame 0 (sections/header)
      const callersForFrame1 = result.callerCounts.get(1)
      expect(callersForFrame1).toBeDefined()
      expect(callersForFrame1!.get(0)).toBe(2)
    })

    test('tracks multiple callers for same frame', () => {
      const frames: SpeedscopeFrame[] = [
        {name: 'render', file: 'sections/header.liquid'},
        {name: 'render', file: 'sections/footer.liquid'},
        {name: 'render', file: 'snippets/icon.liquid'},
      ]
      const profile: EventedProfile = {
        type: 'evented',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 40,
        events: [
          // header calls icon 2 times
          {type: 'O', frame: 0, at: 0},
          {type: 'O', frame: 2, at: 1},
          {type: 'C', frame: 2, at: 3},
          {type: 'O', frame: 2, at: 4},
          {type: 'C', frame: 2, at: 6},
          {type: 'C', frame: 0, at: 20},
          // footer calls icon 1 time
          {type: 'O', frame: 1, at: 20},
          {type: 'O', frame: 2, at: 22},
          {type: 'C', frame: 2, at: 25},
          {type: 'C', frame: 1, at: 40},
        ],
      }

      const result = parseEventedProfile(profile, frames)

      const callersForIcon = result.callerCounts.get(2)
      expect(callersForIcon).toBeDefined()
      // 2 calls from header
      expect(callersForIcon!.get(0)).toBe(2)
      // 1 call from footer
      expect(callersForIcon!.get(1)).toBe(1)
    })
  })

  describe('parseSampledProfile', () => {
    test('attributes weight to leaf frames', () => {
      const frames: SpeedscopeFrame[] = [{name: 'root'}, {name: 'child'}, {name: 'leaf'}]
      const profile: SampledProfile = {
        type: 'sampled',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 100,
        samples: [
          [0, 1, 2],
          [0, 1, 2],
          [0, 1],
        ],
        weights: [10, 20, 30],
      }

      const result = parseSampledProfile(profile, frames)

      // Frame 2 (leaf) should have weight 10 + 20 = 30
      expect(result.selfTimes.get(2)).toBe(30)
      // Frame 1 (child) should have weight 30 (leaf in third sample)
      expect(result.selfTimes.get(1)).toBe(30)
      // Frame 0 (root) should have no self time (never a leaf)
      expect(result.selfTimes.has(0)).toBe(false)
    })

    test('counts frame appearances in samples', () => {
      const frames: SpeedscopeFrame[] = [
        {name: 'render', file: 'snippets/card.liquid'},
        {name: 'asset_url', file: 'snippets/card.liquid'},
      ]
      const profile: SampledProfile = {
        type: 'sampled',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 30,
        samples: [[0, 1], [0, 1], [0]],
        weights: [10, 10, 10],
      }

      const result = parseSampledProfile(profile, frames)

      expect(result.callCounts.get(0)).toBe(3)
      expect(result.callCounts.get(1)).toBe(2)
    })

    test('does not double-count a frame appearing multiple times in the same sample', () => {
      const frames: SpeedscopeFrame[] = [{name: 'recursive', file: 'snippets/card.liquid'}]
      const profile: SampledProfile = {
        type: 'sampled',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 10,
        samples: [[0, 0, 0]],
        weights: [10],
      }

      const result = parseSampledProfile(profile, frames)

      // Should only count once per sample, not per appearance
      expect(result.callCounts.get(0)).toBe(1)
    })

    test('handles empty samples', () => {
      const frames: SpeedscopeFrame[] = [{name: 'root'}]
      const profile: SampledProfile = {
        type: 'sampled',
        name: 'test',
        unit: 'milliseconds',
        startValue: 0,
        endValue: 0,
        samples: [],
        weights: [],
      }

      const result = parseSampledProfile(profile, frames)
      expect(result.selfTimes.size).toBe(0)
      expect(result.callCounts.size).toBe(0)
    })
  })

  describe('mergeCallers', () => {
    test('merges callers from two lists, summing counts for same name', () => {
      const existing: CallerInfo[] = [
        {name: 'snippets/group', count: 10},
        {name: 'snippets/card-gallery', count: 8},
      ]
      const incoming: CallerInfo[] = [
        {name: 'snippets/group', count: 5},
        {name: 'blocks/price', count: 8},
      ]

      const result = mergeCallers(existing, incoming)

      expect(result).toEqual([
        {name: 'snippets/group', count: 15},
        {name: 'snippets/card-gallery', count: 8},
        {name: 'blocks/price', count: 8},
      ])
    })

    test('returns incoming callers when existing is undefined', () => {
      const incoming: CallerInfo[] = [{name: 'sections/header', count: 3}]

      const result = mergeCallers(undefined, incoming)

      expect(result).toEqual([{name: 'sections/header', count: 3}])
    })

    test('returns existing callers when incoming is undefined', () => {
      const existing: CallerInfo[] = [{name: 'sections/header', count: 3}]

      const result = mergeCallers(existing, undefined)

      expect(result).toEqual([{name: 'sections/header', count: 3}])
    })

    test('returns empty array when both are undefined', () => {
      const result = mergeCallers(undefined, undefined)

      expect(result).toEqual([])
    })

    test('sorts merged callers by count descending', () => {
      const existing: CallerInfo[] = [{name: 'a', count: 1}]
      const incoming: CallerInfo[] = [
        {name: 'b', count: 10},
        {name: 'c', count: 5},
      ]

      const result = mergeCallers(existing, incoming)

      expect(result[0]!.name).toBe('b')
      expect(result[1]!.name).toBe('c')
      expect(result[2]!.name).toBe('a')
    })
  })

  describe('generateInsights', () => {
    test('detects items rendered more than 10 times', () => {
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/icon.liquid', selfTime: 5, percentage: 5, callCount: 156},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      expect(insights.some((i) => i.includes('156 times'))).toBe(true)
      expect(insights.some((i) => i.includes('snippets/icon.liquid'))).toBe(true)
    })

    test('does not flag items rendered 10 or fewer times', () => {
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/icon.liquid', selfTime: 5, percentage: 5, callCount: 10},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      expect(insights.filter((i) => i.includes('times'))).toHaveLength(0)
    })

    test('detects largest loops', () => {
      const items: AnalysisItem[] = [
        {name: 'for loop', file: 'sections/product-list.liquid', selfTime: 20, percentage: 20, callCount: 24},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      expect(insights.some((i) => i.includes('Largest loop') && i.includes('24 iterations'))).toBe(true)
    })

    test('detects categories dominating over 40% of time', () => {
      const categories: CategorySummary[] = [
        {category: 'Snippets', totalTime: 50, percentage: 50, count: 100},
        {category: 'Layout', totalTime: 20, percentage: 20, count: 10},
      ]

      const insights = generateInsights({
        items: [],
        categories,
        fileBreakdown: [],
        totalTime: 100,
      })

      expect(insights.some((i) => i.includes('50%') && i.includes('Snippets'))).toBe(true)
      expect(insights.filter((i) => i.includes('Layout'))).toHaveLength(0)
    })

    test('detects files with over 15% of total time', () => {
      const fileBreakdown: FileStats[] = [
        {file: 'sections/header.liquid', totalTime: 20, percentage: 20, callCount: 1},
        {file: 'snippets/icon.liquid', totalTime: 5, percentage: 5, callCount: 10},
      ]

      const insights = generateInsights({
        items: [],
        categories: [],
        fileBreakdown,
        totalTime: 100,
      })

      expect(insights.some((i) => i.includes('sections/header.liquid') && i.includes('20.0%'))).toBe(true)
      expect(insights.filter((i) => i.includes('snippets/icon.liquid'))).toHaveLength(0)
    })

    test('returns empty array when no patterns detected', () => {
      const insights = generateInsights({
        items: [{name: 'render', file: 'snippets/card.liquid', selfTime: 5, percentage: 5, callCount: 2}],
        categories: [{category: 'Snippets', totalTime: 30, percentage: 30, count: 5}],
        fileBreakdown: [{file: 'snippets/card.liquid', totalTime: 5, percentage: 5, callCount: 2}],
        totalTime: 100,
      })

      expect(insights).toHaveLength(0)
    })

    test('does not include "consider inlining or caching" text', () => {
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/icon.liquid', selfTime: 5, percentage: 5, callCount: 156},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      expect(insights.some((i) => i.includes('consider inlining or caching'))).toBe(false)
      expect(insights.some((i) => i.includes('156 times'))).toBe(true)
    })

    test('does not flag filters/variables/control flow for high call count', () => {
      const items: AnalysisItem[] = [
        {name: 'asset_url', selfTime: 5, percentage: 5, callCount: 200},
        {name: 'replace', selfTime: 3, percentage: 3, callCount: 150},
        {name: 'assign x = 1', selfTime: 2, percentage: 2, callCount: 100},
        {name: 'for item in collection', selfTime: 10, percentage: 10, callCount: 80},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      // None of these should trigger the high call count insight
      // (the for loop triggers "Largest loop" which uses "iterations", not "times")
      const highCallInsights = insights.filter((i) => i.includes('times') && !i.includes('iterations'))
      expect(highCallInsights).toHaveLength(0)
    })

    test('only flags snippets/sections/blocks for high call count', () => {
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/spacing-style.liquid', selfTime: 5, percentage: 5, callCount: 176},
        {name: 'render', file: 'sections/header.liquid', selfTime: 10, percentage: 10, callCount: 80},
        {name: 'render', file: 'blocks/product-card.liquid', selfTime: 3, percentage: 3, callCount: 60},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      expect(insights.some((i) => i.includes('snippets/spacing-style.liquid'))).toBe(true)
      expect(insights.some((i) => i.includes('sections/header.liquid'))).toBe(true)
      expect(insights.some((i) => i.includes('blocks/product-card.liquid'))).toBe(true)
    })

    test('deduplicates insights by file/item name', () => {
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/spacing-style.liquid', selfTime: 5, percentage: 5, callCount: 100},
        {name: 'include', file: 'snippets/spacing-style.liquid', selfTime: 3, percentage: 3, callCount: 80},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      // Should only appear once despite two items with same file
      const spacingInsights = insights.filter((i) => i.includes('snippets/spacing-style.liquid'))
      expect(spacingInsights).toHaveLength(1)
    })

    test('caps insights at 5', () => {
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/a.liquid', selfTime: 5, percentage: 5, callCount: 100},
        {name: 'render', file: 'snippets/b.liquid', selfTime: 5, percentage: 5, callCount: 90},
        {name: 'render', file: 'snippets/c.liquid', selfTime: 5, percentage: 5, callCount: 80},
        {name: 'render', file: 'snippets/d.liquid', selfTime: 5, percentage: 5, callCount: 70},
        {name: 'render', file: 'snippets/e.liquid', selfTime: 5, percentage: 5, callCount: 60},
        {name: 'render', file: 'snippets/f.liquid', selfTime: 5, percentage: 5, callCount: 55},
      ]

      const insights = generateInsights({
        items,
        categories: [{category: 'Snippets', totalTime: 80, percentage: 80, count: 6}],
        fileBreakdown: [],
        totalTime: 100,
      })

      expect(insights.length).toBeLessThanOrEqual(5)
    })

    test('uses aggregated file call count from fileBreakdown in insights', () => {
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/spacing-style.liquid', selfTime: 5, percentage: 5, callCount: 100},
        {name: 'for item in list', file: 'snippets/spacing-style.liquid', selfTime: 3, percentage: 3, callCount: 76},
      ]
      const fileBreakdown: FileStats[] = [
        {file: 'snippets/spacing-style.liquid', totalTime: 8, percentage: 8, callCount: 176},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown,
        totalTime: 100,
      })

      // Should use the aggregated file count (176) not the individual item count (100 or 76)
      expect(insights.some((i) => i.includes('176 times'))).toBe(true)
      expect(insights.some((i) => i.includes('100 times'))).toBe(false)
    })

    test('includes caller info in insights when available', () => {
      const callers: CallerInfo[] = [
        {name: 'sections/header', count: 80},
        {name: 'blocks/_product-card', count: 50},
        {name: 'sections/footer', count: 46},
      ]
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/spacing-style.liquid', selfTime: 5, percentage: 5, callCount: 176, callers},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      expect(insights.some((i) => i.includes('176 times'))).toBe(true)
      expect(insights.some((i) => i.includes('80× from sections/header'))).toBe(true)
      expect(insights.some((i) => i.includes('50× from blocks/_product-card'))).toBe(true)
      expect(insights.some((i) => i.includes('46× from sections/footer'))).toBe(true)
    })

    test('filters out self-references from caller info in insights', () => {
      const callers: CallerInfo[] = [
        {name: 'snippets/spacing-style.liquid', count: 176},
        {name: 'sections/header', count: 80},
        {name: 'blocks/_product-card', count: 50},
      ]
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/spacing-style.liquid', selfTime: 5, percentage: 5, callCount: 306, callers},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      // Self-reference (snippets/spacing-style.liquid calling itself) should be filtered out
      expect(insights.some((i) => i.includes('80× from sections/header'))).toBe(true)
      expect(insights.some((i) => i.includes('50× from blocks/_product-card'))).toBe(true)
      expect(insights.some((i) => i.includes('176× from snippets/spacing-style.liquid'))).toBe(false)
    })

    test('shows no caller lines when all callers are self-references', () => {
      const callers: CallerInfo[] = [{name: 'snippets/spacing-style.liquid', count: 176}]
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/spacing-style.liquid', selfTime: 5, percentage: 5, callCount: 176, callers},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      // Should still show the high call count insight, but no caller lines
      expect(insights.some((i) => i.includes('176 times'))).toBe(true)
      expect(insights.some((i) => i.includes('└─'))).toBe(false)
    })

    test('shows at most 3 callers in insights', () => {
      const callers: CallerInfo[] = [
        {name: 'sections/header', count: 80},
        {name: 'blocks/_product-card', count: 50},
        {name: 'sections/footer', count: 46},
        {name: 'sections/about', count: 10},
      ]
      const items: AnalysisItem[] = [
        {name: 'render', file: 'snippets/spacing-style.liquid', selfTime: 5, percentage: 5, callCount: 186, callers},
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [],
        totalTime: 100,
      })

      // Fourth caller should not appear
      expect(insights.some((i) => i.includes('sections/about'))).toBe(false)
    })
  })

  describe('analyzeProfile', () => {
    test('analyzes evented profile and returns structured result', () => {
      const speedscope: SpeedscopeSchema = {
        shared: {
          frames: [
            {name: 'render', file: 'snippets/header.liquid'},
            {name: 'assign x = 1'},
            {name: 'for item in collection'},
          ],
        },
        profiles: [
          {
            type: 'evented',
            name: 'test',
            unit: 'nanoseconds',
            startValue: 0,
            endValue: 3_000_000,
            events: [
              {type: 'O', frame: 0, at: 0},
              {type: 'C', frame: 0, at: 2_000_000},
              {type: 'O', frame: 1, at: 2_000_000},
              {type: 'C', frame: 1, at: 2_500_000},
              {type: 'O', frame: 2, at: 2_500_000},
              {type: 'C', frame: 2, at: 3_000_000},
            ],
          },
        ],
      }

      const result = analyzeProfile(speedscope, 10)

      expect(result.isEmpty).toBe(false)
      expect(result.profileCount).toBe(1)
      expect(result.unit).toBe('ms')
      expect(result.topItems.length).toBe(3)
      // First item should be the slowest (frame 0, 2ms)
      expect(result.topItems[0]!.name).toBe('render')
      expect(result.topItems[0]!.selfTime).toBe(2)
    })

    test('includes callCount on items for evented profiles', () => {
      const schema = makeEventedSchema(
        [{name: 'render', file: 'snippets/card.liquid'}],
        [
          {type: 'O', frame: 0, at: 0},
          {type: 'C', frame: 0, at: 10},
          {type: 'O', frame: 0, at: 10},
          {type: 'C', frame: 0, at: 20},
        ],
      )

      const result = analyzeProfile(schema, 10)

      expect(result.topItems[0]!.callCount).toBe(2)
    })

    test('includes callCount on items for sampled profiles', () => {
      const schema = makeSampledSchema([{name: 'render', file: 'snippets/card.liquid'}], [[0], [0], [0]], [5, 5, 5])

      const result = analyzeProfile(schema, 10)

      expect(result.topItems[0]!.callCount).toBe(3)
    })

    test('produces fileBreakdown aggregated by file', () => {
      const schema = makeEventedSchema(
        [
          {name: 'render', file: 'snippets/card.liquid'},
          {name: 'asset_url', file: 'snippets/card.liquid'},
          {name: 'content_for_header', file: 'layout/theme.liquid'},
        ],
        [
          {type: 'O', frame: 0, at: 0},
          {type: 'C', frame: 0, at: 10},
          {type: 'O', frame: 1, at: 10},
          {type: 'C', frame: 1, at: 15},
          {type: 'O', frame: 2, at: 15},
          {type: 'C', frame: 2, at: 25},
        ],
      )

      const result = analyzeProfile(schema, 10)

      expect(result.fileBreakdown.length).toBe(2)
      // snippets/card.liquid: 10 + 5 = 15ms
      const cardFile = result.fileBreakdown.find((file) => file.file === 'snippets/card.liquid')
      expect(cardFile).toBeDefined()
      expect(cardFile!.totalTime).toBe(15)
      // layout/theme.liquid: 10ms
      const layoutFile = result.fileBreakdown.find((file) => file.file === 'layout/theme.liquid')
      expect(layoutFile).toBeDefined()
      expect(layoutFile!.totalTime).toBe(10)
    })

    test('produces per-category item lists', () => {
      const schema = makeEventedSchema(
        [
          {name: 'render', file: 'snippets/card.liquid'},
          {name: 'render', file: 'snippets/icon.liquid'},
          {name: 'content_for_header', file: 'layout/theme.liquid'},
        ],
        [
          {type: 'O', frame: 0, at: 0},
          {type: 'C', frame: 0, at: 10},
          {type: 'O', frame: 1, at: 10},
          {type: 'C', frame: 1, at: 15},
          {type: 'O', frame: 2, at: 15},
          {type: 'C', frame: 2, at: 25},
        ],
      )

      const result = analyzeProfile(schema, 10)

      expect(result.categoryItems.Snippets).toBeDefined()
      expect(result.categoryItems.Snippets!.length).toBe(2)
      expect(result.categoryItems.Layout).toBeDefined()
      expect(result.categoryItems.Layout!.length).toBe(1)
    })

    test('aggregates per-category items by file', () => {
      // Two different operations on the same layout file should be merged
      const schema = makeEventedSchema(
        [
          {name: 'content_for_header', file: 'layout/theme.liquid'},
          {name: 'content_for_layout', file: 'layout/theme.liquid'},
          {name: 'render', file: 'snippets/card.liquid'},
        ],
        [
          {type: 'O', frame: 0, at: 0},
          {type: 'C', frame: 0, at: 10},
          {type: 'O', frame: 1, at: 10},
          {type: 'C', frame: 1, at: 20},
          {type: 'O', frame: 0, at: 20},
          {type: 'C', frame: 0, at: 30},
          {type: 'O', frame: 2, at: 30},
          {type: 'C', frame: 2, at: 35},
        ],
      )

      const result = analyzeProfile(schema, 10)

      // Layout category should have one aggregated entry for layout/theme.liquid
      expect(result.categoryItems.Layout).toBeDefined()
      expect(result.categoryItems.Layout!.length).toBe(1)
      const layoutItem = result.categoryItems.Layout![0]!
      expect(layoutItem.file).toBe('layout/theme.liquid')
      // Should aggregate time: 10 + 10 + 10 = 30ms
      expect(layoutItem.selfTime).toBe(30)
    })

    test('includes caller info on items from evented profiles', () => {
      const schema = makeEventedSchema(
        [
          {name: 'render', file: 'sections/header.liquid'},
          {name: 'render', file: 'snippets/icon.liquid'},
        ],
        [
          {type: 'O', frame: 0, at: 0},
          {type: 'O', frame: 1, at: 2},
          {type: 'C', frame: 1, at: 5},
          {type: 'O', frame: 1, at: 6},
          {type: 'C', frame: 1, at: 8},
          {type: 'C', frame: 0, at: 20},
        ],
      )

      const result = analyzeProfile(schema, 10)

      const iconItem = result.topItems.find((i) => i.file === 'snippets/icon.liquid')
      expect(iconItem).toBeDefined()
      expect(iconItem!.callers).toBeDefined()
      expect(iconItem!.callers!.length).toBe(1)
      expect(iconItem!.callers![0]!.name).toBe('sections/header.liquid')
      expect(iconItem!.callers![0]!.count).toBe(2)
    })

    test('includes same-file callers in caller info', () => {
      // Frame 0 is sections/header which calls frame 1 (a tag within snippets/spacing-style)
      // Frame 1's parent on the stack is frame 0 (sections/header) - different file
      // Frame 2 is also in snippets/spacing-style, called by frame 1 (same file) - should be included
      const schema = makeEventedSchema(
        [
          {name: 'render', file: 'sections/header.liquid'},
          {name: 'render', file: 'snippets/spacing-style.liquid'},
          {name: 'for item in list', file: 'snippets/spacing-style.liquid'},
        ],
        [
          {type: 'O', frame: 0, at: 0},
          {type: 'O', frame: 1, at: 2},
          {type: 'O', frame: 2, at: 3},
          {type: 'C', frame: 2, at: 5},
          {type: 'C', frame: 1, at: 8},
          {type: 'C', frame: 0, at: 20},
        ],
      )

      const result = analyzeProfile(schema, 10)

      // Frame 2 (for item in list, file: snippets/spacing-style.liquid) is called by frame 1 (same file)
      // The caller should now be included even though it's the same file
      const forItem = result.topItems.find((i) => i.name === 'for item in list')
      expect(forItem).toBeDefined()
      expect(forItem!.callers).toBeDefined()
      expect(forItem!.callers!.length).toBe(1)
      expect(forItem!.callers![0]!.name).toBe('snippets/spacing-style.liquid')
      expect(forItem!.callers![0]!.count).toBe(1)
    })

    test('filters self-references from callers in categoryItems', () => {
      // Frame 0: sections/header calls frame 1: snippets/spacing-style
      // Frame 2: for item (inside snippets/spacing-style) called by frame 1 (same file)
      // When aggregated by file, snippets/spacing-style should not show itself as a caller
      const schema = makeEventedSchema(
        [
          {name: 'render', file: 'sections/header.liquid'},
          {name: 'render', file: 'snippets/spacing-style.liquid'},
          {name: 'for item in list', file: 'snippets/spacing-style.liquid'},
        ],
        [
          {type: 'O', frame: 0, at: 0},
          {type: 'O', frame: 1, at: 2},
          {type: 'O', frame: 2, at: 3},
          {type: 'C', frame: 2, at: 5},
          {type: 'C', frame: 1, at: 8},
          {type: 'C', frame: 0, at: 20},
        ],
      )

      const result = analyzeProfile(schema, 10)

      // The categoryItems for Snippets should have snippets/spacing-style.liquid
      const snippetItems = result.categoryItems.Snippets
      expect(snippetItems).toBeDefined()
      const spacingItem = snippetItems!.find((i) => i.file === 'snippets/spacing-style.liquid')
      expect(spacingItem).toBeDefined()

      // Self-reference should be filtered out; only sections/header.liquid should remain as caller
      if (spacingItem!.callers) {
        const selfCaller = spacingItem!.callers.find((caller) => caller.name === 'snippets/spacing-style.liquid')
        expect(selfCaller).toBeUndefined()
      }
    })

    test('merges callers from all frames when aggregating categoryItems by file', () => {
      // Frame 0: sections/header calls frame 1 (liquid_template for snippets/spacing-style)
      // Frame 1: liquid_template entry point for snippets/spacing-style (low selfTime)
      // Frame 2: for item in list (inside snippets/spacing-style, called by frame 1)
      // Frame 3: sections/footer calls frame 1 again
      //
      // When aggregated by file, snippets/spacing-style.liquid should have callers from
      // BOTH frame 1 (entry point with external callers) and frame 2 (internal operation)
      const schema = makeEventedSchema(
        [
          {name: 'render', file: 'sections/header.liquid'},
          {name: 'liquid_template', file: 'snippets/spacing-style.liquid'},
          {name: 'for item in list', file: 'snippets/spacing-style.liquid'},
          {name: 'render', file: 'sections/footer.liquid'},
        ],
        [
          // header calls liquid_template for spacing-style
          {type: 'O', frame: 0, at: 0},
          {type: 'O', frame: 1, at: 2},
          {type: 'O', frame: 2, at: 3},
          {type: 'C', frame: 2, at: 8},
          {type: 'C', frame: 1, at: 9},
          {type: 'C', frame: 0, at: 20},
          // footer calls liquid_template for spacing-style
          {type: 'O', frame: 3, at: 20},
          {type: 'O', frame: 1, at: 22},
          {type: 'O', frame: 2, at: 23},
          {type: 'C', frame: 2, at: 28},
          {type: 'C', frame: 1, at: 29},
          {type: 'C', frame: 3, at: 40},
        ],
      )

      const result = analyzeProfile(schema, 10)

      const snippetItems = result.categoryItems.Snippets
      expect(snippetItems).toBeDefined()
      const spacingItem = snippetItems!.find((i) => i.file === 'snippets/spacing-style.liquid')
      expect(spacingItem).toBeDefined()

      // After merging callers from all frames and filtering self-references,
      // we should see both sections/header.liquid and sections/footer.liquid as callers
      expect(spacingItem!.callers).toBeDefined()
      const callerNames = spacingItem!.callers!.map((caller) => caller.name)
      expect(callerNames).toContain('sections/header.liquid')
      expect(callerNames).toContain('sections/footer.liquid')
      // Self-references should be filtered out
      expect(callerNames).not.toContain('snippets/spacing-style.liquid')
    })

    test('merges callers in insights across multiple items for same file', () => {
      // Two items for the same file, each with different callers
      // The insight should show merged callers from both items
      const items: AnalysisItem[] = [
        {
          name: 'liquid_template',
          file: 'snippets/spacing-style.liquid',
          selfTime: 1,
          percentage: 1,
          callCount: 100,
          callers: [
            {name: 'snippets/group', count: 10},
            {name: 'snippets/card-gallery', count: 8},
          ],
        },
        {
          name: 'for item in list',
          file: 'snippets/spacing-style.liquid',
          selfTime: 5,
          percentage: 5,
          callCount: 76,
          callers: [{name: 'snippets/spacing-style.liquid', count: 76}],
        },
      ]

      const insights = generateInsights({
        items,
        categories: [],
        fileBreakdown: [{file: 'snippets/spacing-style.liquid', totalTime: 6, percentage: 6, callCount: 176}],
        totalTime: 100,
      })

      // Should show merged external callers (not self-references)
      expect(insights.some((i) => i.includes('10× from snippets/group'))).toBe(true)
      expect(insights.some((i) => i.includes('8× from snippets/card-gallery'))).toBe(true)
      // Self-reference should be filtered out
      expect(insights.some((i) => i.includes('from snippets/spacing-style.liquid'))).toBe(false)
    })

    test('includes insights in result', () => {
      // Create a profile where one category dominates
      const schema = makeEventedSchema(
        [
          {name: 'render', file: 'snippets/card.liquid'},
          {name: 'assign x', file: 'layout/theme.liquid'},
        ],
        [
          {type: 'O', frame: 0, at: 0},
          {type: 'C', frame: 0, at: 90},
          {type: 'O', frame: 1, at: 90},
          {type: 'C', frame: 1, at: 100},
        ],
      )

      const result = analyzeProfile(schema, 10)

      // Snippets is 90% of time, should trigger the >40% insight
      expect(result.insights.some((i) => i.includes('Snippets'))).toBe(true)
    })

    test('limits results to topN', () => {
      const speedscope: SpeedscopeSchema = {
        shared: {
          frames: [{name: 'frame-0'}, {name: 'frame-1'}, {name: 'frame-2'}, {name: 'frame-3'}, {name: 'frame-4'}],
        },
        profiles: [
          {
            type: 'evented',
            name: 'test',
            unit: 'milliseconds',
            startValue: 0,
            endValue: 50,
            events: [
              {type: 'O', frame: 0, at: 0},
              {type: 'C', frame: 0, at: 10},
              {type: 'O', frame: 1, at: 10},
              {type: 'C', frame: 1, at: 20},
              {type: 'O', frame: 2, at: 20},
              {type: 'C', frame: 2, at: 30},
              {type: 'O', frame: 3, at: 30},
              {type: 'C', frame: 3, at: 40},
              {type: 'O', frame: 4, at: 40},
              {type: 'C', frame: 4, at: 50},
            ],
          },
        ],
      }

      const result = analyzeProfile(speedscope, 2)

      expect(result.topItems.length).toBe(2)
    })

    test('handles empty profile gracefully', () => {
      const speedscope: SpeedscopeSchema = {
        shared: {frames: []},
        profiles: [],
      }

      const result = analyzeProfile(speedscope, 10)

      expect(result.isEmpty).toBe(true)
      expect(result.totalTime).toBe(0)
      expect(result.topItems).toEqual([])
      expect(result.categories).toEqual([])
      expect(result.categoryItems).toEqual({})
      expect(result.fileBreakdown).toEqual([])
      expect(result.insights).toEqual([])
    })

    test('handles missing shared frames gracefully', () => {
      const speedscope: SpeedscopeSchema = {}

      const result = analyzeProfile(speedscope, 10)

      expect(result.isEmpty).toBe(true)
    })

    test('throws an error for invalid JSON input', () => {
      expect(() => analyzeProfile('not valid json', 10)).toThrow('Invalid profile data: the response is not valid JSON')
    })

    test('analyzes sampled profiles', () => {
      const speedscope: SpeedscopeSchema = {
        shared: {
          frames: [{name: 'root'}, {name: 'child', file: 'snippets/header.liquid'}, {name: 'leaf'}],
        },
        profiles: [
          {
            type: 'sampled',
            name: 'test',
            unit: 'milliseconds',
            startValue: 0,
            endValue: 100,
            samples: [
              [0, 1, 2],
              [0, 1],
            ],
            weights: [50, 30],
          },
        ],
      }

      const result = analyzeProfile(speedscope, 10)

      expect(result.isEmpty).toBe(false)
      expect(result.profileCount).toBe(1)
      expect(result.topItems.length).toBe(2)
    })

    test('builds category summaries', () => {
      const speedscope: SpeedscopeSchema = {
        shared: {
          frames: [
            {name: 'render', file: 'snippets/header.liquid'},
            {name: 'render', file: 'snippets/footer.liquid'},
            {name: 'assign x = 1'},
          ],
        },
        profiles: [
          {
            type: 'evented',
            name: 'test',
            unit: 'milliseconds',
            startValue: 0,
            endValue: 30,
            events: [
              {type: 'O', frame: 0, at: 0},
              {type: 'C', frame: 0, at: 10},
              {type: 'O', frame: 1, at: 10},
              {type: 'C', frame: 1, at: 20},
              {type: 'O', frame: 2, at: 20},
              {type: 'C', frame: 2, at: 30},
            ],
          },
        ],
      }

      const result = analyzeProfile(speedscope, 10)

      const snippetsCat = result.categories.find((category) => category.category === 'Snippets')
      const variablesCat = result.categories.find((category) => category.category === 'Variables')

      expect(snippetsCat).toBeDefined()
      expect(snippetsCat!.count).toBe(2)
      expect(snippetsCat!.totalTime).toBe(20)

      expect(variablesCat).toBeDefined()
      expect(variablesCat!.count).toBe(1)
      expect(variablesCat!.totalTime).toBe(10)
    })

    test('JSON output includes all new fields', () => {
      const schema = makeEventedSchema(
        [{name: 'render', file: 'snippets/card.liquid'}],
        [
          {type: 'O', frame: 0, at: 0},
          {type: 'C', frame: 0, at: 10},
        ],
      )

      const result = analyzeProfile(schema, 10)
      const json = JSON.parse(JSON.stringify(result))

      expect(json).toHaveProperty('categoryItems')
      expect(json).toHaveProperty('fileBreakdown')
      expect(json).toHaveProperty('insights')
      expect(json.topItems[0]).toHaveProperty('callCount')
    })
  })

  describe('renderAnalysisResult', () => {
    test('renders empty profile with info message', () => {
      renderAnalysisResult({
        totalTime: 0,
        unit: 'ms',
        topItems: [],
        categories: [],
        categoryItems: {},
        fileBreakdown: [],
        insights: [],
        profileCount: 0,
        isEmpty: true,
      })

      expect(renderInfo).toHaveBeenCalledWith({
        headline: 'Profile Analysis.',
        body: 'No profile data found. The page may not contain any Liquid code, or the profile may be empty.',
      })
    })

    test('renders non-empty profile with success message', () => {
      renderAnalysisResult({
        totalTime: 100,
        unit: 'ms',
        topItems: [
          {name: 'render', file: 'snippets/header.liquid', selfTime: 50, percentage: 50, callCount: 5},
          {name: 'assign x = 1', selfTime: 30, percentage: 30, callCount: 1},
        ],
        categories: [
          {category: 'Snippets', totalTime: 50, percentage: 50, count: 1},
          {category: 'Variables', totalTime: 30, percentage: 30, count: 1},
        ],
        categoryItems: {
          Snippets: [{name: 'render', file: 'snippets/header.liquid', selfTime: 50, percentage: 50, callCount: 5}],
        },
        fileBreakdown: [{file: 'snippets/header.liquid', totalTime: 50, percentage: 50, callCount: 5}],
        insights: ['50% of time spent in Snippets'],
        profileCount: 1,
        isEmpty: false,
      })

      expect(renderSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: 'Liquid Profile Analysis.',
        }),
      )

      // Verify the body contains expected sections
      const call = vi.mocked(renderSuccess).mock.calls[0]![0]
      const body = (call as {body: string}).body
      expect(body).toContain('Top 2 slowest operations:')
      expect(body).toContain('Slowest files (total time):')
      expect(body).toContain('Slowest snippets:')
      expect(body).toContain('By category:')
      expect(body).toContain('Insights:')
      expect(body).toContain('(5 renders)')
      expect(body).toContain('Time shown is direct execution time')
    })
  })

  describe('formatOperationName', () => {
    test('removes tag: prefix', () => {
      expect(formatOperationName('tag:for item in collection')).toBe('for item in collection')
    })

    test('leaves names without tag: prefix unchanged', () => {
      expect(formatOperationName('render "header"')).toBe('render "header"')
    })
  })

  describe('hasOperationDetail', () => {
    test('returns false when item has no file', () => {
      expect(hasOperationDetail({name: 'assign x = 1', selfTime: 1, percentage: 1, callCount: 1})).toBe(false)
    })

    test('returns false when name matches file', () => {
      expect(
        hasOperationDetail({
          name: 'sections/product-list',
          file: 'sections/product-list',
          selfTime: 1,
          percentage: 1,
          callCount: 1,
        }),
      ).toBe(false)
    })

    test('returns true when name differs from file', () => {
      expect(
        hasOperationDetail({
          name: 'tag:for product in collection',
          file: 'sections/product-list',
          selfTime: 1,
          percentage: 1,
          callCount: 1,
        }),
      ).toBe(true)
    })

    test('returns true when name without tag: prefix differs from file', () => {
      expect(
        hasOperationDetail({
          name: 'render "header"',
          file: 'snippets/header.liquid',
          selfTime: 1,
          percentage: 1,
          callCount: 1,
        }),
      ).toBe(true)
    })
  })

  describe('formatItemLine', () => {
    test('uses two-line format when item has file and operation detail', () => {
      const item: AnalysisItem = {
        name: 'tag:for product in collection.products limit: max_items',
        file: 'sections/product-list',
        selfTime: 11.68,
        percentage: 4.3,
        callCount: 1,
      }

      const result = formatItemLine(item, 0)

      expect(result).toContain('sections/product-list')
      expect(result).toContain('for product in collection.products limit: max_items')
      // Should NOT contain the tag: prefix
      expect(result).not.toContain('tag:')
      // Should be two lines
      expect(result.split('\n').length).toBe(2)
    })

    test('uses two-line format with renders count on first line', () => {
      const item: AnalysisItem = {
        name: "tag:render 'resource-image', content_type: 'collections'",
        file: 'blocks/_collection-card-image',
        selfTime: 4.4,
        percentage: 3.5,
        callCount: 3,
      }

      const result = formatItemLine(item, 2)

      const lines = result.split('\n')
      expect(lines.length).toBe(2)
      // First line has file and calls
      expect(lines[0]).toContain('blocks/_collection-card-image')
      expect(lines[0]).toContain('(3 renders)')
      // Second line has operation
      expect(lines[1]).toContain("render 'resource-image', content_type: 'collections'")
    })

    test('uses single-line format when item has no operation detail', () => {
      const item: AnalysisItem = {
        name: 'layout/theme',
        file: 'layout/theme',
        selfTime: 4.01,
        percentage: 3.2,
        callCount: 1,
      }

      const result = formatItemLine(item, 3)

      expect(result.split('\n').length).toBe(1)
      expect(result).toContain('layout/theme')
    })

    test('uses single-line format when item has no file', () => {
      const item: AnalysisItem = {
        name: 'assign x = 1',
        selfTime: 2.0,
        percentage: 1.5,
        callCount: 1,
      }

      const result = formatItemLine(item, 4)

      expect(result.split('\n').length).toBe(1)
      expect(result).toContain('assign x = 1')
    })
  })
})
