import {unstyled, shouldDisplayColors} from '../../../../public/node/output.js'
import {Text} from 'ink'
import React, {FunctionComponent} from 'react'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const gitDiff = require('git-diff')

export interface GitDiffProps {
  baselineContent: string
  updatedContent: string
}

/**
 * `FilePath` displays a path to a file.
 */
const GitDiff: FunctionComponent<GitDiffProps> = ({baselineContent, updatedContent}): JSX.Element => {
  const rawDiffContents = gitDiff(baselineContent, updatedContent, {
    color: shouldDisplayColors(),
    // Show minimal context to accommodate small terminals.
    flags: '--unified=1 --inter-hunk-context=1',
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
        return index === 0 ? line : line.replace('@@', '\n@@')
      } else {
        return line.replace(/([+\- ])/, (match) => {
          return `${match} `
        })
      }
    })
    .filter((line: string | undefined) => line !== undefined)
    .join('\n')
    .trim()
  return <Text>{diffContents}</Text>
}

export {GitDiff}
