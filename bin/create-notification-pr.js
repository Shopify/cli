#!/usr/bin/env node

import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'

import {findUp} from 'find-up'

import {withOctokit} from './github-utils.js'

const require = createRequire(import.meta.url)
const {readFile} = require('fs-extra')

const REPO_OWNER = 'Shopify'
const REPO_NAME = 'static-cdn-assets'
const NOTIFICATIONS_PATH = 'static-24h/cli/notifications.json'

async function createPR() {
  const version = await versionToRelease()
  console.log(`Creating notification PR for version ${version}`)

  await withOctokit('shopify', async (octokit) => {
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
      message: 'Release highlights:\n\n - [app] Example \n - [theme] Example',
      minVersion: version,
      maxVersion: version,
      ownerChannel: '#devtools-dev-experience',
      cta: {
        label: 'Read the complete release notes',
        url: `https://github.com/Shopify/cli/releases/tag/${version}`,
      },
    }

    const BASE_INDENT = '      '
    const formattedEntry = JSON.stringify(newNotification, null, 2)
      .split('\n')
      .map((line) => BASE_INDENT + line)
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
        `Adds a notification to be shown in the latest version of the CLI [${version}](https://github.com/Shopify/cli/releases/tag/${version}).`,
        '',
        '**Please update the release highlights before merging.**',
        '',
        '### How to test',
        '- `npx http-server ~/src/github.com/Shopify/static-cdn-assets`',
        '- `SHOPIFY_CLI_NOTIFICATIONS_URL=http://127.0.0.1:8080/static-24h/cli/notifications.json shopify version`',
        "- You may need to clear the CLI cache with `shopify cache clear` and run the command twice to see the notification (it's fetched in the background).",
        '',
        '### Checklist',
        "- [ ] I've updated the message template in the notification with the most important changes",
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

async function versionToRelease() {
  const cliKitPackageJsonPath = await findUp('packages/cli-kit/package.json', {type: 'file'})
  return JSON.parse(await readFile(cliKitPackageJsonPath)).version
}

await createPR()
