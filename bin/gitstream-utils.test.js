import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {test} from 'node:test'

import {gitBlobSha} from './gitstream-utils.js'

test('computes the same blob SHA that git does', () => {
  const content = 'Shopify CLI docs\n'

  const sha = execFileSync('git', ['hash-object', '--stdin'], {input: content}).toString().trim()

  assert.equal(gitBlobSha(content), sha)
})

test('computes the same blob SHA that git does for multi-byte content', () => {
  const content = 'ünïcödé docs — 日本語\n'

  const sha = execFileSync('git', ['hash-object', '--stdin'], {input: content}).toString().trim()

  assert.equal(gitBlobSha(content), sha)
})

test('gives different blob SHAs to different contents', () => {
  assert.notEqual(gitBlobSha('one'), gitBlobSha('two'))
})
