import {LinesDiffSegment} from '@shopify/cli-kit/node/output'

/**
 * Computes a line-based diff between two strings.
 *
 * This is a self-contained port of jsdiff's `diffLines` (the `LineDiff` tokenizer plus the base
 * Myers O(ND) diff algorithm and its `buildValues` assembly). It is intentionally byte-for-byte
 * compatible with `diff`'s `diffLines` so the user-facing `app env pull` diff is unchanged: lines
 * are tokenized including their trailing newline (`\n` or `\r\n`), equality is an exact whole-line
 * `===` comparison, and within a changed region removed lines are emitted before added lines.
 *
 * @param oldStr - The original text.
 * @param newStr - The updated text.
 * @returns The diff as an ordered list of segments. Unchanged segments set neither `added` nor
 * `removed`; changed segments set exactly one of them to `true`. Consecutive lines of the same
 * kind are grouped into a single segment whose `value` is their concatenation.
 */
export function diffLines(oldStr: string, newStr: string): LinesDiffSegment[] {
  const oldString = removeEmpty(tokenize(oldStr))
  const newString = removeEmpty(tokenize(newStr))
  const newLen = newString.length
  const oldLen = oldString.length
  let editLength = 1
  const maxEditLength = newLen + oldLen

  // `bestPath` is indexed by diagonal, which can be negative, so it's modelled as a record.
  const bestPath: {[diagonal: number]: DiffPath | undefined} = {0: {oldPos: -1, lastComponent: undefined}}

  let newPos = extractCommon(bestPath[0]!, newString, oldString, 0)
  if (bestPath[0]!.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
    // The two inputs are identical per the tokenizer and equality check.
    return buildSegments([{count: newString.length, value: newString.join('')}])
  }

  // Once we hit an edge of the edit graph on some diagonal, there's no point considering moves that
  // would push past it; these bounds prune those diagonals (matches jsdiff's optimization).
  let minDiagonalToConsider = -Infinity
  let maxDiagonalToConsider = Infinity

  // Checks all permutations of a given edit length for acceptance.
  function execEditLength(): DiffComponent[] | undefined {
    for (
      let diagonalPath = Math.max(minDiagonalToConsider, -editLength);
      diagonalPath <= Math.min(maxDiagonalToConsider, editLength);
      diagonalPath += 2
    ) {
      const removePath = bestPath[diagonalPath - 1]
      const addPath = bestPath[diagonalPath + 1]
      if (removePath) {
        // No one else is going to attempt to use this value, clear it.
        bestPath[diagonalPath - 1] = undefined
      }

      let canAdd = false
      if (addPath) {
        // What newPos will be after we do an insertion.
        const addPathNewPos = addPath.oldPos - diagonalPath
        canAdd = addPathNewPos >= 0 && addPathNewPos < newLen
      }

      const canRemove = Boolean(removePath && removePath.oldPos + 1 < oldLen)
      if (!canAdd && !canRemove) {
        // This path is a terminal; prune it.
        bestPath[diagonalPath] = undefined
        continue
      }

      // Select the prior path whose position in the old string is the farthest from the origin and
      // does not pass the bounds of the diff graph.
      let basePath: DiffPath
      if (!canRemove || (canAdd && removePath!.oldPos + 1 < addPath!.oldPos)) {
        basePath = addToPath(addPath!, true, undefined, 0)
      } else {
        basePath = addToPath(removePath!, undefined, true, 1)
      }

      newPos = extractCommon(basePath, newString, oldString, diagonalPath)

      if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
        // We've reached the end of both strings, so we're done.
        return buildValues(basePath.lastComponent, newString, oldString)
      } else {
        bestPath[diagonalPath] = basePath
        if (basePath.oldPos + 1 >= oldLen) {
          maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1)
        }
        if (newPos + 1 >= newLen) {
          minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1)
        }
      }
    }

    editLength++
    return undefined
  }

  while (editLength <= maxEditLength) {
    const components = execEditLength()
    if (components) {
      return buildSegments(components)
    }
  }

  // Unreachable for finite inputs, but keeps the return type total.
  return []
}

interface DiffComponent {
  count: number
  added?: boolean
  removed?: boolean
  previousComponent?: DiffComponent
  value?: string
}

interface DiffPath {
  oldPos: number
  lastComponent: DiffComponent | undefined
}

/**
 * Tokenizes a string into lines, each including its trailing newline separator.
 *
 * Mirrors jsdiff's `LineDiff.tokenize` with default options: split on the newline group, drop the
 * trailing empty token produced when the string ends with a newline, then merge each separator
 * (odd indices) back onto its preceding line (even indices).
 *
 * @param value - The string to tokenize.
 * @returns The line tokens.
 */
function tokenize(value: string): string[] {
  const retLines: string[] = []
  const linesAndNewlines = value.split(/(\n|\r\n)/)

  // Ignore the final empty token that occurs if the string ends with a newline.
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop()
  }

  // Merge the content and line separators into single tokens.
  for (let i = 0; i < linesAndNewlines.length; i++) {
    const line = linesAndNewlines[i]!
    if (i % 2) {
      retLines[retLines.length - 1] += line
    } else {
      retLines.push(line)
    }
  }

  return retLines
}

/**
 * Removes falsy (empty) tokens, matching jsdiff's `removeEmpty`.
 *
 * @param array - The tokens to filter.
 * @returns The tokens with empty entries removed.
 */
function removeEmpty(array: string[]): string[] {
  return array.filter((entry) => entry)
}

/**
 * Extends a path with an added or removed component, merging into the last component when it's of
 * the same kind. Mirrors jsdiff's `addToPath`.
 *
 * @param path - The path to extend.
 * @param added - Whether this step is an insertion.
 * @param removed - Whether this step is a deletion.
 * @param oldPosInc - How far to advance the old-string position (0 for adds, 1 for removes).
 * @returns The new path.
 */
function addToPath(
  path: DiffPath,
  added: boolean | undefined,
  removed: boolean | undefined,
  oldPosInc: number,
): DiffPath {
  const last = path.lastComponent
  if (last && last.added === added && last.removed === removed) {
    return {
      oldPos: path.oldPos + oldPosInc,
      lastComponent: {count: last.count + 1, added, removed, previousComponent: last.previousComponent},
    }
  }
  return {
    oldPos: path.oldPos + oldPosInc,
    lastComponent: {count: 1, added, removed, previousComponent: last},
  }
}

/**
 * Consumes the run of equal tokens starting just past the current path position, recording it as a
 * common component. Mirrors jsdiff's `extractCommon`.
 *
 * @param basePath - The path to advance (mutated in place).
 * @param newString - The tokenized new string.
 * @param oldString - The tokenized old string.
 * @param diagonalPath - The current diagonal.
 * @returns The new-string position after consuming the common run.
 */
function extractCommon(basePath: DiffPath, newString: string[], oldString: string[], diagonalPath: number): number {
  const newLen = newString.length
  const oldLen = oldString.length
  let oldPos = basePath.oldPos
  let newPos = oldPos - diagonalPath
  let commonCount = 0

  while (newPos + 1 < newLen && oldPos + 1 < oldLen && newString[newPos + 1] === oldString[oldPos + 1]) {
    newPos++
    oldPos++
    commonCount++
  }

  if (commonCount) {
    basePath.lastComponent = {count: commonCount, previousComponent: basePath.lastComponent}
  }

  basePath.oldPos = oldPos
  return newPos
}

/**
 * Walks the linked list of components into an ordered array, assigns each its string value, and
 * reorders so removals precede additions within a change region. Mirrors jsdiff's `buildValues`.
 *
 * @param lastComponent - The tail of the component linked list.
 * @param newString - The tokenized new string.
 * @param oldString - The tokenized old string.
 * @returns The ordered components with their values populated.
 */
function buildValues(
  lastComponent: DiffComponent | undefined,
  newString: string[],
  oldString: string[],
): DiffComponent[] {
  // Convert the reverse-order linked list into a forward-order array.
  const components: DiffComponent[] = []
  let current = lastComponent
  while (current) {
    components.push(current)
    const next = current.previousComponent
    delete current.previousComponent
    current = next
  }
  components.reverse()

  const componentLen = components.length
  let newPos = 0
  let oldPos = 0

  for (let componentPos = 0; componentPos < componentLen; componentPos++) {
    const component = components[componentPos]!
    if (component.removed) {
      component.value = oldString.slice(oldPos, oldPos + component.count).join('')
      oldPos += component.count

      // Reverse add and remove so removes are output first to match common convention. The diffing
      // algorithm is tied to add-then-remove output, so this swap is the simplest route to the
      // desired ordering.
      const previous = components[componentPos - 1]
      if (componentPos && previous!.added) {
        components[componentPos - 1] = component
        components[componentPos] = previous!
      }
    } else {
      component.value = newString.slice(newPos, newPos + component.count).join('')
      newPos += component.count
      if (!component.added) {
        oldPos += component.count
      }
    }
  }

  // Special case for when one terminal is empty: merge it into the prior string and drop the change.
  const finalComponent = components[componentLen - 1]!
  if (
    componentLen > 1 &&
    typeof finalComponent.value === 'string' &&
    (finalComponent.added ?? finalComponent.removed) &&
    finalComponent.value === ''
  ) {
    components[componentLen - 2]!.value += finalComponent.value
    components.pop()
  }

  return components
}

/**
 * Projects internal diff components onto the public {@link LinesDiffSegment} shape, dropping the
 * internal `count` bookkeeping and only setting `added`/`removed` when truthy.
 *
 * @param components - The components produced by the diff.
 * @returns The line-diff segments.
 */
function buildSegments(components: DiffComponent[]): LinesDiffSegment[] {
  return components.map((component) => {
    const segment: LinesDiffSegment = {value: component.value ?? ''}
    if (component.added) {
      segment.added = true
    }
    if (component.removed) {
      segment.removed = true
    }
    return segment
  })
}
