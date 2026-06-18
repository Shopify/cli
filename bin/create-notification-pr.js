#!/usr/bin/env node

import {randomUUID} from 'node:crypto'
import readline from 'node:readline'
import {pathToFileURL} from 'node:url'

import {withOctokit} from './github-utils.js'

const CLI_REPO_OWNER = 'Shopify'
const CLI_REPO_NAME = 'cli'
const REPO_OWNER = 'Shopify'
const REPO_NAME = 'static-cdn-assets'
const NOTIFICATIONS_PATH = 'static-24h/cli/notifications.json'
const DEFAULT_SELECTED_RELEASE_NOTES = 8

export async function createPR() {
  await withOctokit('shopify', async (octokit) => {
    const release = await latestRelease(octokit)
    const version = release.tag_name
    console.log(`Creating notification PR for version ${version}`)

    const releaseNotes = releaseNoteBullets(release.body ?? '')
    const selectedReleaseNotes = await selectReleaseNotes(releaseNotes)

    const {data} = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: NOTIFICATIONS_PATH,
    })

    const currentContent = Buffer.from(data.content, 'base64').toString('utf-8')

    const newNotification = {
      id: randomUUID(),
      type: 'info',
      title: `Release notes for ${version}`,
      frequency: 'once',
      message: releaseNotesNotificationMessage(selectedReleaseNotes),
      minVersion: version,
      maxVersion: version,
      ownerChannel: '#devtools-dev-experience',
      cta: {
        label: 'Read the complete release notes',
        url: release.html_url,
      },
    }

    const baseIndent = '      '
    const formattedEntry = JSON.stringify(newNotification, null, 2)
      .split('\n')
      .map((line) => baseIndent + line)
      .join('\n')

    // Append the new entry right before the closing "]" of the notifications array,
    // preserving the rest of the file as-is.
    const updatedContent = currentContent.replace(
      /(\})\s*(\]\s*\}\s*)$/,
      `$1,\n${formattedEntry}\n  $2`,
    )

    const response = await octokit.createPullRequest({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `Add notification for CLI v${version}`,
      body: [
        `Adds a notification to be shown in the latest version of the CLI [${version}](${release.html_url}).`,
        '',
        '### How to test',
        '- `pnpx http-server ~/src/github.com/Shopify/static-cdn-assets`',
        '- `SHOPIFY_CLI_NOTIFICATIONS_URL=http://127.0.0.1:8080/static-24h/cli/notifications.json shopify version`',
        "- You may need to clear the CLI cache with `shopify cache clear` and run the command twice to see the notification (it's fetched in the background).",
        '',
        '### Checklist',
        "- [ ] I've reviewed the generated release highlights",
        "- [ ] I've tested the notification",
      ].join('\n'),
      head: `cli-${version}-notification`,
      base: 'main',
      update: true,
      forceFork: false,
      changes: [
        {
          files: {
            [NOTIFICATIONS_PATH]: updatedContent,
          },
          commit: `Add notification for CLI v${version}`,
        },
      ],
      createWhenEmpty: false,
    })

    if (response) {
      console.log(`PR URL: ${response.data.html_url}`)
    } else {
      console.log('No changes detected, PR not created.')
    }
  })
}

async function latestRelease(octokit) {
  const {data} = await octokit.rest.repos.getLatestRelease({
    owner: CLI_REPO_OWNER,
    repo: CLI_REPO_NAME,
  })

  return data
}

export function releaseNotesNotificationMessage(releaseBody) {
  const releaseNotes = Array.isArray(releaseBody)
    ? releaseBody
    : releaseNoteBullets(releaseBody).slice(0, DEFAULT_SELECTED_RELEASE_NOTES)
  if (releaseNotes.length === 0) return 'Release highlights:\n\nSee the complete release notes for details.'

  return `Release highlights:\n\n${releaseNotes.join('\n')}`
}

export function releaseNoteBullets(releaseBody) {
  const bullets = []
  let currentSection
  let insideWhatsChanged = false

  for (const rawLine of releaseBody.split('\n')) {
    const line = rawLine.trim()

    if (line.startsWith('## ')) {
      insideWhatsChanged = /^##\s+what'?s changed\b/i.test(line)
      currentSection = undefined
      continue
    }

    if (!insideWhatsChanged) continue

    const sectionMatch = line.match(/^###\s+(.+)$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].replace(/\s+/g, ' ').trim()
      continue
    }

    if (!line.startsWith('* ') && !line.startsWith('- ')) continue

    const note = cleanReleaseNote(line.slice(2))
    if (!note) continue

    bullets.push(currentSection ? ` - [${currentSection}] ${note}` : ` - ${note}`)
  }

  return bullets
}

export async function selectReleaseNotes(
  releaseNotes,
  {input = process.stdin, output = process.stdout} = {},
) {
  if (releaseNotes.length === 0) return []

  if (!input.isTTY || !output.isTTY) {
    output.write('Non-interactive terminal detected; including the default release notes.\n')
    return releaseNotes.slice(0, DEFAULT_SELECTED_RELEASE_NOTES)
  }

  const selectedIndexes = new Set(
    releaseNotes
      .slice(0, DEFAULT_SELECTED_RELEASE_NOTES)
      .map((_, index) => index),
  )
  let activeIndex = 0
  let renderedLines = 0
  let errorMessage
  const wasRaw = input.isRaw

  readline.emitKeypressEvents(input)
  input.setRawMode(true)
  input.resume()
  output.write('\x1B[?25l')

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      input.off('keypress', onKeypress)
      input.setRawMode(wasRaw)
      input.pause()
      output.write('\x1B[?25h')
    }

    const finish = () => {
      if (selectedIndexes.size === 0) {
        errorMessage = 'Select at least one release note.'
        render()
        return
      }

      cleanup()
      output.write('\n')
      resolve(releaseNotes.filter((_, index) => selectedIndexes.has(index)))
    }

    const cancel = () => {
      cleanup()
      output.write('\n')
      reject(new Error('Release note selection cancelled.'))
    }

    const toggleActiveChoice = () => {
      errorMessage = undefined
      if (selectedIndexes.has(activeIndex)) {
        selectedIndexes.delete(activeIndex)
      } else {
        selectedIndexes.add(activeIndex)
      }
      render()
    }

    const toggleAllChoices = () => {
      errorMessage = undefined
      if (selectedIndexes.size === releaseNotes.length) {
        selectedIndexes.clear()
      } else {
        releaseNotes.forEach((_, index) => selectedIndexes.add(index))
      }
      render()
    }

    function onKeypress(_, key) {
      if (key.ctrl && key.name === 'c') {
        cancel()
        return
      }

      switch (key.name) {
        case 'up': {
          activeIndex = activeIndex === 0 ? releaseNotes.length - 1 : activeIndex - 1
          render()
          break
        }
        case 'down': {
          activeIndex = activeIndex === releaseNotes.length - 1 ? 0 : activeIndex + 1
          render()
          break
        }
        case 'space': {
          toggleActiveChoice()
          break
        }
        case 'a': {
          toggleAllChoices()
          break
        }
        case 'return': {
          finish()
          break
        }
      }
    }

    function render() {
      if (renderedLines > 0) {
        readline.cursorTo(output, 0)
        readline.moveCursor(output, 0, -(renderedLines - 1))
        readline.clearScreenDown(output)
      }

      const lines = [
        '',
        '',
        'Select release notes to include in the notification:',
        '',
        ...releaseNotes.map((releaseNote, index) => {
          const active = index === activeIndex ? '>' : ' '
          const selected = selectedIndexes.has(index) ? '[x]' : '[ ]'
          return truncate(`${active} ${selected} ${releaseNote.replace(/^ - /, '')}`, output.columns ?? 100)
        }),
        '',
        'Use Up/Down to move, Space to toggle, A to toggle all, Enter to confirm.',
      ]

      if (errorMessage) lines.push(errorMessage)

      output.write(lines.join('\n'))
      renderedLines = lines.length
    }

    input.on('keypress', onKeypress)
    render()
  })
}

function cleanReleaseNote(note) {
  return note
    .replace(/\s+by\s+@\S+\s+in\s+https:\/\/github\.com\/Shopify\/cli\/pull\/\d+\s*$/i, '')
    .replace(/\s+in\s+https:\/\/github\.com\/Shopify\/cli\/pull\/\d+\s*$/i, '')
    .replace(/\s+by\s+@\S+\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value
  if (maxLength <= 3) return value.slice(0, maxLength)
  return `${value.slice(0, maxLength - 3)}...`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await createPR()
  process.exit(0)
}
