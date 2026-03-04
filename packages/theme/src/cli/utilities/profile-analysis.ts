import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {renderTasksToStdErr} from '../utilities/theme-ui.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderInfo, renderSuccess, Task} from '@shopify/cli-kit/node/ui'

export interface SpeedscopeSchema {
  $schema?: string
  shared?: {frames: SpeedscopeFrame[]}
  profiles?: SpeedscopeProfile[]
  name?: string
  exporter?: string
}

export interface SpeedscopeFrame {
  name: string
  file?: string
  line?: number
  col?: number
}

type SpeedscopeProfile = EventedProfile | SampledProfile

export interface EventedProfile {
  type: 'evented'
  name: string
  unit: TimeUnit
  startValue: number
  endValue: number
  events: ProfileEvent[]
}

export interface SampledProfile {
  type: 'sampled'
  name: string
  unit: TimeUnit
  startValue: number
  endValue: number
  samples: number[][]
  weights: number[]
}

interface ProfileEvent {
  type: 'O' | 'C'
  frame: number
  at: number
}

type TimeUnit = 'nanoseconds' | 'microseconds' | 'milliseconds' | 'seconds' | 'none'

export interface AnalysisResult {
  totalTime: number
  unit: string
  topItems: AnalysisItem[]
  categories: CategorySummary[]
  categoryItems: {[category: string]: AnalysisItem[]}
  fileBreakdown: FileStats[]
  insights: string[]
  profileCount: number
  isEmpty: boolean
}

export interface CallerInfo {
  name: string
  count: number
}

export interface AnalysisItem {
  name: string
  file?: string
  selfTime: number
  percentage: number
  callCount: number
  callers?: CallerInfo[]
}

export interface CategorySummary {
  category: string
  totalTime: number
  percentage: number
  count: number
}

export interface FileStats {
  file: string
  totalTime: number
  percentage: number
  callCount: number
}

export function classifyFrame(frame: SpeedscopeFrame): string {
  const name = frame.name
  const file = frame.file ?? ''

  if (file.includes('snippets/') || name.includes('snippet:')) return 'Snippets'
  if (file.includes('sections/') || name.includes('section:')) return 'Sections'
  if (file.includes('layout/') || name.includes('layout:')) return 'Layout'
  if (file.includes('templates/') || name.includes('template:')) return 'Templates'
  if (file.includes('blocks/') || name.includes('block:')) return 'Blocks'
  if (name.startsWith('render') || name.startsWith('include')) return 'Render/Include'
  if (name.startsWith('for') || name.startsWith('if') || name.startsWith('case')) return 'Control Flow'
  if (name.startsWith('assign') || name.startsWith('capture')) return 'Variables'
  return 'Other'
}

export function normalizeToMs(value: number, unit: TimeUnit): number {
  switch (unit) {
    case 'nanoseconds':
      return value / 1_000_000
    case 'microseconds':
      return value / 1_000
    case 'milliseconds':
      return value
    case 'seconds':
      return value * 1_000
    case 'none':
      return value
  }
}

export function formatTime(ms: number): string {
  if (ms < 0.01) {
    return '< 0.01ms'
  }
  return `${ms.toFixed(2)}ms`
}

interface ProfileParseResult {
  selfTimes: Map<number, number>
  callCounts: Map<number, number>
  renderCounts: Map<number, number>
  callerCounts: Map<number, Map<number, number>>
}

const ENTRY_POINT_NAMES = new Set(['liquid_template', 'section', 'raw_section'])

export function isEntryPointFrame(frame: SpeedscopeFrame): boolean {
  return ENTRY_POINT_NAMES.has(frame.name)
}

export function parseEventedProfile(profile: EventedProfile, frames: SpeedscopeFrame[]): ProfileParseResult {
  const selfTimes = new Map<number, number>()
  const callCounts = new Map<number, number>()
  const renderCounts = new Map<number, number>()
  const callerCounts = new Map<number, Map<number, number>>()
  const stack: {frame: number; at: number; childTime: number}[] = []

  for (const event of profile.events) {
    if (event.type === 'O') {
      stack.push({frame: event.frame, at: event.at, childTime: 0})
      const currentCount = callCounts.get(event.frame) ?? 0
      callCounts.set(event.frame, currentCount + 1)

      // Track render counts for entry-point frames only
      const frame = frames[event.frame]
      if (frame && isEntryPointFrame(frame)) {
        const currentRenderCount = renderCounts.get(event.frame) ?? 0
        renderCounts.set(event.frame, currentRenderCount + 1)
      }

      // Track caller: the current top of stack before this push is the parent
      if (stack.length > 1) {
        const parentEntry = stack[stack.length - 2]
        if (!parentEntry) continue
        const parentFrame = parentEntry.frame
        let callersForFrame = callerCounts.get(event.frame)
        if (!callersForFrame) {
          callersForFrame = new Map<number, number>()
          callerCounts.set(event.frame, callersForFrame)
        }
        const parentCount = callersForFrame.get(parentFrame) ?? 0
        callersForFrame.set(parentFrame, parentCount + 1)
      }
    } else if (event.type === 'C') {
      const openIndex = findLastIndex(stack, (entry) => entry.frame === event.frame)
      if (openIndex === -1) continue

      const open = stack[openIndex]
      if (!open) continue
      const totalFrameTime = event.at - open.at
      const selfTime = totalFrameTime - open.childTime

      const current = selfTimes.get(event.frame) ?? 0
      selfTimes.set(event.frame, current + selfTime)

      stack.splice(openIndex, 1)

      if (stack.length > 0) {
        const parent = stack[stack.length - 1]
        if (parent) {
          parent.childTime += totalFrameTime
        }
      }
    }
  }

  return {selfTimes, callCounts, renderCounts, callerCounts}
}

export function mergeCallers(existing: CallerInfo[] | undefined, incoming: CallerInfo[] | undefined): CallerInfo[] {
  const callerMap = new Map<string, number>()
  for (const caller of existing ?? []) {
    callerMap.set(caller.name, (callerMap.get(caller.name) ?? 0) + caller.count)
  }
  for (const caller of incoming ?? []) {
    callerMap.set(caller.name, (callerMap.get(caller.name) ?? 0) + caller.count)
  }
  return Array.from(callerMap.entries())
    .map(([name, count]) => ({name, count}))
    .sort((left, right) => right.count - left.count)
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let idx = arr.length - 1; idx >= 0; idx--) {
    const element = arr[idx]
    if (element && predicate(element)) return idx
  }
  return -1
}

export function parseSampledProfile(profile: SampledProfile, _frames: SpeedscopeFrame[]): ProfileParseResult {
  const selfTimes = new Map<number, number>()
  const callCounts = new Map<number, number>()
  const renderCounts = new Map<number, number>()
  const callerCounts = new Map<number, Map<number, number>>()

  for (let i = 0; i < profile.samples.length; i++) {
    const sample = profile.samples[i]
    if (!sample) continue
    const weight = profile.weights[i] ?? 0

    // Count appearances of each frame in samples
    const seen = new Set<number>()
    for (const frameIndex of sample) {
      if (!seen.has(frameIndex)) {
        seen.add(frameIndex)
        const currentCount = callCounts.get(frameIndex) ?? 0
        callCounts.set(frameIndex, currentCount + 1)
      }
    }

    // In sampled profiles, the last frame in each sample is the leaf (active) frame
    if (sample.length > 0) {
      const leafFrame = sample[sample.length - 1]
      if (leafFrame !== undefined) {
        const current = selfTimes.get(leafFrame) ?? 0
        selfTimes.set(leafFrame, current + weight)
      }
    }
  }

  return {selfTimes, callCounts, renderCounts, callerCounts}
}

interface InsightInput {
  items: AnalysisItem[]
  categories: CategorySummary[]
  fileBreakdown: FileStats[]
  totalTime: number
}

const HIGH_CALL_COUNT_CATEGORIES = new Set(['Snippets', 'Sections', 'Blocks'])

export function generateInsights(input: InsightInput): string[] {
  const insights: string[] = []
  const {items, categories, fileBreakdown, totalTime} = input
  const seen = new Set<string>()

  // Build a file-level call count lookup from fileBreakdown for consistent counts
  const fileCallCounts = new Map<string, number>()
  for (const file of fileBreakdown) {
    fileCallCounts.set(file.file, file.callCount)
  }

  // Build file-level merged callers from all items
  const fileMergedCallers = new Map<string, CallerInfo[]>()
  for (const item of items) {
    const fileKey = item.file ?? item.name
    if (item.callers && item.callers.length > 0) {
      const existing = fileMergedCallers.get(fileKey)
      const merged = mergeCallers(existing, item.callers)
      fileMergedCallers.set(fileKey, merged)
    }
  }

  // Detect files called more than 10 times (only snippets/sections/blocks)
  const highCallItems = items
    .filter((item) => {
      const fileKey = item.file ?? item.name
      const aggregatedCount = fileCallCounts.get(fileKey) ?? item.callCount
      if (aggregatedCount <= 10) return false
      const frame: SpeedscopeFrame = {name: item.name, file: item.file}
      const category = classifyFrame(frame)
      return HIGH_CALL_COUNT_CATEGORIES.has(category)
    })
    .sort((left, right) => {
      const leftCount = fileCallCounts.get(left.file ?? left.name) ?? left.callCount
      const rightCount = fileCallCounts.get(right.file ?? right.name) ?? right.callCount
      return rightCount - leftCount
    })

  for (const item of highCallItems) {
    const key = item.file ?? item.name
    if (seen.has(key)) continue
    seen.add(key)

    const aggregatedCount = fileCallCounts.get(key) ?? item.callCount
    let insight = `${key} rendered ${aggregatedCount} times`

    // Add caller info if available, filtering out self-references
    const mergedCallersForFile = fileMergedCallers.get(key)
    if (mergedCallersForFile && mergedCallersForFile.length > 0) {
      const externalCallers = mergedCallersForFile.filter((caller) => caller.name !== key)
      const topCallers = externalCallers.slice(0, 3)
      for (const caller of topCallers) {
        insight += `\n    └─ ${caller.count}× from ${caller.name}`
      }
    }

    insights.push(insight)
  }

  // Detect single files with >15% of total time
  for (const file of fileBreakdown) {
    if (file.percentage > 15 && totalTime > 0) {
      const key = file.file
      if (seen.has(key)) continue
      seen.add(key)
      insights.push(`${file.file} accounts for ${file.percentage.toFixed(1)}% of total render time`)
    }
  }

  // Detect largest loops by looking for items with "for" or "tablerow" in name
  const loopItems = items
    .filter((item) => item.name.startsWith('for') || item.name.startsWith('tablerow'))
    .sort((left, right) => right.selfTime - left.selfTime)

  for (const loopItem of loopItems.slice(0, 2)) {
    const location = loopItem.file ? ` in ${loopItem.file}` : ''
    if (loopItem.callCount > 1) {
      insights.push(`Largest loop: ${loopItem.callCount} iterations${location}`)
    }
  }

  // Detect categories dominating >40% of time
  for (const category of categories) {
    if (category.percentage > 40 && totalTime > 0) {
      insights.push(`${Math.round(category.percentage)}% of time spent in ${category.category}`)
    }
  }

  // Cap insights at 5
  return insights.slice(0, 5)
}

export function analyzeProfile(input: string | SpeedscopeSchema, topN: number): AnalysisResult {
  let speedscopeJson: SpeedscopeSchema
  if (typeof input === 'string') {
    try {
      speedscopeJson = JSON.parse(input) as SpeedscopeSchema
    } catch {
      throw new AbortError(
        'Invalid profile data: the response is not valid JSON',
        'This usually means the page did not return a Liquid profile. Verify the URL is correct and the theme is published.',
      )
    }
  } else {
    speedscopeJson = input
  }

  const frames = speedscopeJson.shared?.frames ?? []
  const profiles = speedscopeJson.profiles ?? []

  if (frames.length === 0 || profiles.length === 0) {
    return {
      totalTime: 0,
      unit: 'ms',
      topItems: [],
      categories: [],
      categoryItems: {},
      fileBreakdown: [],
      insights: [],
      profileCount: 0,
      isEmpty: true,
    }
  }

  const aggregatedSelfTimes = new Map<number, number>()
  const aggregatedCallCounts = new Map<number, number>()
  const aggregatedRenderCounts = new Map<number, number>()
  let totalRawTime = 0

  const prof = profiles[0]
  if (!prof) {
    return {
      totalTime: 0,
      unit: 'ms',
      topItems: [],
      categories: [],
      categoryItems: {},
      fileBreakdown: [],
      insights: [],
      profileCount: 0,
      isEmpty: true,
    }
  }
  const unit: TimeUnit = prof.unit
  let parseResult: ProfileParseResult

  if (prof.type === 'evented') {
    parseResult = parseEventedProfile(prof, frames)
  } else if (prof.type === 'sampled') {
    parseResult = parseSampledProfile(prof, frames)
  } else {
    parseResult = {selfTimes: new Map(), callCounts: new Map(), renderCounts: new Map(), callerCounts: new Map()}
  }

  for (const [frameIndex, time] of parseResult.selfTimes) {
    const current = aggregatedSelfTimes.get(frameIndex) ?? 0
    aggregatedSelfTimes.set(frameIndex, current + time)
  }

  for (const [frameIndex, count] of parseResult.callCounts) {
    const current = aggregatedCallCounts.get(frameIndex) ?? 0
    aggregatedCallCounts.set(frameIndex, current + count)
  }

  for (const [frameIndex, count] of parseResult.renderCounts) {
    const current = aggregatedRenderCounts.get(frameIndex) ?? 0
    aggregatedRenderCounts.set(frameIndex, current + count)
  }

  // Build file-level render counts by summing entry-point frame render counts per file
  const fileRenderCounts = new Map<string, number>()
  for (const [frameIndex, count] of aggregatedRenderCounts) {
    const frame = frames[frameIndex]
    if (frame) {
      const fileKey = frame.file ?? frame.name
      const current = fileRenderCounts.get(fileKey) ?? 0
      fileRenderCounts.set(fileKey, current + count)
    }
  }

  // Convert to ms and build items
  const items: AnalysisItem[] = []
  for (const [frameIndex, rawTime] of aggregatedSelfTimes) {
    const timeMs = normalizeToMs(rawTime, unit)
    totalRawTime += timeMs
    const frame = frames[frameIndex]
    if (frame) {
      // Build caller info from callerCounts
      let callers: CallerInfo[] | undefined
      const callerMap = parseResult.callerCounts.get(frameIndex)
      if (callerMap && callerMap.size > 0) {
        callers = []
        for (const [callerFrameIndex, count] of callerMap) {
          const callerFrame = frames[callerFrameIndex]
          if (callerFrame) {
            const callerName = callerFrame.file ?? callerFrame.name
            callers.push({
              name: callerName,
              count,
            })
          }
        }
        callers.sort((left, right) => right.count - left.count)
        if (callers.length === 0) callers = undefined
      }

      // Use file-level render count if available, otherwise fall back to call count
      const fileKey = frame.file ?? frame.name
      const callCount = fileRenderCounts.get(fileKey) ?? aggregatedCallCounts.get(frameIndex) ?? 0

      items.push({
        name: frame.name,
        file: frame.file,
        selfTime: timeMs,
        // Percentage is calculated after total is known
        percentage: 0,
        callCount,
        callers,
      })
    }
  }

  // Calculate percentages
  for (const item of items) {
    item.percentage = totalRawTime > 0 ? (item.selfTime / totalRawTime) * 100 : 0
  }

  // Sort by self time descending, take topN
  items.sort((left, right) => right.selfTime - left.selfTime)
  const topItems = items.slice(0, topN)

  // Build category summaries and per-category item lists (aggregated by file)
  const categoryMap = new Map<string, {totalTime: number; count: number}>()
  const categoryFileMap = new Map<string, Map<string, {selfTime: number; callCount: number; callers?: CallerInfo[]}>>()
  for (const [frameIndex, rawTime] of aggregatedSelfTimes) {
    const frame = frames[frameIndex]
    if (!frame) continue
    const category = classifyFrame(frame)
    const timeMs = normalizeToMs(rawTime, unit)
    const existing = categoryMap.get(category) ?? {totalTime: 0, count: 0}
    existing.totalTime += timeMs
    existing.count += 1
    categoryMap.set(category, existing)

    // Aggregate per-category items by file
    const fileKey = frame.file ?? frame.name
    let catFileMap = categoryFileMap.get(category)
    if (!catFileMap) {
      catFileMap = new Map()
      categoryFileMap.set(category, catFileMap)
    }
    const existingFile = catFileMap.get(fileKey) ?? {selfTime: 0, callCount: 0}
    const item = items.find((i) => i.name === frame.name && i.file === frame.file)
    existingFile.selfTime += timeMs
    // Use file-level render count (set once, not accumulated)
    existingFile.callCount = fileRenderCounts.get(fileKey) ?? 0
    if (item?.callers) {
      const merged = mergeCallers(existingFile.callers, item.callers)
      existingFile.callers = merged.length > 0 ? merged : undefined
    }
    catFileMap.set(fileKey, existingFile)
  }

  const categories: CategorySummary[] = []
  for (const [category, data] of categoryMap) {
    categories.push({
      category,
      totalTime: data.totalTime,
      percentage: totalRawTime > 0 ? (data.totalTime / totalRawTime) * 100 : 0,
      count: data.count,
    })
  }
  categories.sort((left, right) => right.totalTime - left.totalTime)

  // Build per-category items from file-aggregated data, take top 5
  const categoryItems: {[category: string]: AnalysisItem[]} = {}
  for (const [category, catFileMap] of categoryFileMap) {
    const aggregatedItems: AnalysisItem[] = []
    for (const [fileKey, data] of catFileMap) {
      // Filter out self-references from callers when aggregated by file
      const filteredCallers = data.callers?.filter((caller) => caller.name !== fileKey)
      aggregatedItems.push({
        name: fileKey,
        file: fileKey,
        selfTime: data.selfTime,
        percentage: totalRawTime > 0 ? (data.selfTime / totalRawTime) * 100 : 0,
        callCount: data.callCount,
        callers: filteredCallers && filteredCallers.length > 0 ? filteredCallers : undefined,
      })
    }
    aggregatedItems.sort((left, right) => right.selfTime - left.selfTime)
    categoryItems[category] = aggregatedItems.slice(0, 5)
  }

  // Build file breakdown (aggregate by file)
  const fileMap = new Map<string, {totalTime: number}>()
  for (const item of items) {
    const file = item.file ?? item.name
    const existing = fileMap.get(file) ?? {totalTime: 0}
    existing.totalTime += item.selfTime
    fileMap.set(file, existing)
  }

  const fileBreakdown: FileStats[] = []
  for (const [file, data] of fileMap) {
    fileBreakdown.push({
      file,
      totalTime: data.totalTime,
      percentage: totalRawTime > 0 ? (data.totalTime / totalRawTime) * 100 : 0,
      callCount: fileRenderCounts.get(file) ?? 0,
    })
  }
  fileBreakdown.sort((left, right) => right.totalTime - left.totalTime)

  // Generate insights
  const insights = generateInsights({items, categories, fileBreakdown, totalTime: totalRawTime})

  return {
    totalTime: totalRawTime,
    unit: 'ms',
    topItems,
    categories,
    categoryItems,
    fileBreakdown,
    insights,
    profileCount: 1,
    isEmpty: false,
  }
}

export function hasOperationDetail(item: AnalysisItem): boolean {
  if (!item.file) return false
  const nameWithoutTag = formatOperationName(item.name)
  return nameWithoutTag !== item.file
}

export function formatOperationName(name: string): string {
  // Remove tag: prefix if present
  return name.replace(/^tag:/, '')
}

export function formatItemLine(item: AnalysisItem, index: number): string {
  const rank = `${index + 1}.`.padStart(3)
  const time = formatTime(item.selfTime).padStart(10)
  const pct = `${item.percentage.toFixed(1)}%`.padStart(7)
  const calls = item.callCount > 1 ? ` (${item.callCount} renders)` : ''

  if (item.file && hasOperationDetail(item)) {
    // Two-line format: file on line 1, operation on line 2
    const line1 = `${rank} ${time} ${pct}  ${item.file}${calls}`
    const indent = ' '.repeat(rank.length + 1 + time.length + 1 + pct.length + 2)
    const line2 = `${indent}${formatOperationName(item.name)}`
    return `${line1}\n${line2}`
  }

  // Single-line format for items without operation detail
  const displayName = item.file ?? item.name
  return `${rank} ${time} ${pct}  ${displayName}${calls}`
}

export function renderAnalysisResult(result: AnalysisResult): void {
  if (result.isEmpty) {
    renderInfo({
      headline: 'Profile Analysis.',
      body: 'No profile data found. The page may not contain any Liquid code, or the profile may be empty.',
    })
    return
  }

  const topItemsLines = result.topItems.map(formatItemLine)

  const categoryLines = result.categories.map((cat) => {
    const time = formatTime(cat.totalTime).padStart(10)
    const pct = `${cat.percentage.toFixed(1)}%`.padStart(7)
    const count = `(${cat.count} operations)`.padStart(18)
    return `${time} ${pct} ${count}  ${cat.category}`
  })

  // Per-category top items (only show categories with items)
  const perCategoryLines: string[] = []
  const displayCategories = ['Snippets', 'Sections', 'Layout', 'Templates', 'Blocks']
  for (const category of displayCategories) {
    const catItems = result.categoryItems[category]
    if (catItems && catItems.length > 0) {
      perCategoryLines.push('')
      perCategoryLines.push(`Slowest ${category.toLowerCase()}:`)
      perCategoryLines.push('')
      for (const [index, item] of catItems.entries()) {
        const rank = `${index + 1}.`.padStart(3)
        const time = formatTime(item.selfTime).padStart(10)
        const calls = item.callCount > 1 ? ` (${item.callCount} renders)` : ''
        perCategoryLines.push(`${rank} ${time}  ${item.file ?? item.name}${calls}`)
      }
    }
  }

  // File breakdown
  const fileLines = result.fileBreakdown.slice(0, 10).map((file, index) => {
    const rank = `${index + 1}.`.padStart(3)
    const time = formatTime(file.totalTime).padStart(10)
    const pct = `${file.percentage.toFixed(1)}%`.padStart(7)
    const calls = file.callCount > 1 ? ` (${file.callCount} renders)` : ''
    return `${rank} ${time} ${pct}  ${file.file}${calls}`
  })

  // Insights
  const insightLines: string[] = []
  if (result.insights.length > 0) {
    insightLines.push('')
    insightLines.push('Insights:')
    insightLines.push('')
    for (const insight of result.insights) {
      insightLines.push(`  \u2022 ${insight}`)
    }
  }

  renderSuccess({
    headline: 'Liquid Profile Analysis.',
    body: [
      `Total render time: ${formatTime(result.totalTime)}`,
      '',
      `Time shown is direct execution time (excludes time in nested calls).`,
      '',
      `Top ${result.topItems.length} slowest operations:`,
      '',
      ...topItemsLines,
      '',
      `Slowest files (total time):`,
      '',
      ...fileLines,
      ...perCategoryLines,
      '',
      `By category:`,
      '',
      ...categoryLines,
      ...insightLines,
    ].join('\n'),
  })
}

interface RunProfileAnalysisOptions {
  adminSession: AdminSession
  themeId: string
  url: string
  themeAccessPassword?: string
  storefrontPassword?: string
}

export async function runProfileAnalysis(options: RunProfileAnalysisOptions): Promise<void> {
  const {adminSession, themeId, url, themeAccessPassword, storefrontPassword} = options

  if (themeAccessPassword) {
    throw new AbortError(
      'Unable to use Admin API or Theme Access tokens with the profile command',
      'You must authenticate manually by not passing the --password flag.',
    )
  }

  const storePassword = (await isStorefrontPasswordProtected(adminSession))
    ? await ensureValidPassword(storefrontPassword, adminSession.storeFqdn)
    : undefined

  let profileJson = ''
  let result: AnalysisResult | undefined

  const tasks: Task[] = [
    {
      title: `Fetching Liquid profile for ${adminSession.storeFqdn} ${url}`,
      task: async () => {
        const session = await fetchDevServerSession(themeId, adminSession, themeAccessPassword, storePassword)
        const response = await render(session, {
          method: 'GET',
          path: url,
          query: [],
          themeId,
          headers: {
            Accept: 'application/vnd.speedscope+json',
          },
        })

        if (response.status !== 200) {
          throw new AbortError(
            `Failed to fetch Liquid profile (HTTP ${response.status})`,
            'Verify the URL exists on your store and that the theme is accessible. Run with --verbose for more details.',
          )
        }

        profileJson = await response.text()
      },
    },
    {
      title: 'Analyzing profile data',
      task: async () => {
        result = analyzeProfile(profileJson, 10)
      },
    },
  ]

  await renderTasksToStdErr(tasks)

  if (!result) {
    throw new AbortError('Analysis failed to produce results')
  }

  renderAnalysisResult(result)
}
