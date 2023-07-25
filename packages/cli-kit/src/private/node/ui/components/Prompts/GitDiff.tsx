import {unstyled, shouldDisplayColors} from '../../../../../public/node/output.js'
import {Text} from 'ink'
import React, {FunctionComponent} from 'react'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const gitDiff = require('git-diff')

export interface GitDiffProps {
  gitDiff: {
    baselineContent: string
    updatedContent: string
  }
}

/**
 * `GitDiff` displays a git diff between two strings.
 * @example
 *   \@\@ -1,2 +1,2 \@\@
 * - deleted line
 *   unchanged line
 * + added line
 */
const GitDiff: FunctionComponent<GitDiffProps> = ({gitDiff: {baselineContent, updatedContent}}): JSX.Element => {
  const rawDiffContents = gitDiff(baselineContent, updatedContent, {
    color: shouldDisplayColors(),
    // Show minimal context to accommodate small terminals.
    flags: '--unified=1 --inter-hunk-context=1',
    noHeaders: true,
  })
  if (!rawDiffContents) {
    return <Text>No changes.</Text>
  }
  const diffContents = rawDiffContents
    .split('\n')
    .map((line: string, index: number): string | undefined => {
      const unstyledLine = unstyled(line)
      if (unstyledLine === '\\ No newline at end of file') {
        return undefined
      } else if (unstyledLine.match(/^@@/)) {
        const addNewline = index !== 0
        return line.replace('@@', `${addNewline ? '\n' : ''}  @@`)
      } else {
        return line.replace(/([+\- ])/, (match) => {
          return `${match} `
        })
      }
    })
    .filter((line: string | undefined) => line !== undefined)
    .join('\n')
    .trimEnd()
  return <Text>{diffContents}</Text>
}

export {GitDiff}
