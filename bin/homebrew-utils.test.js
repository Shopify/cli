import assert from 'node:assert/strict'
import {test} from 'node:test'

import {isNewestStableVersion} from './homebrew-utils.js'

test('treats a release on the newest line as the newest stable version', () => {
  assert.equal(isNewestStableVersion('5.0.2', ['4.9.5', '5.0.0', '5.0.1', '5.0.2']), true)
})

test('does not treat a patch to an older release line as the newest stable version', () => {
  assert.equal(isNewestStableVersion('4.9.6', ['4.9.5', '5.0.0', '5.0.1', '4.9.6']), false)
})

test('compares version parts as numbers, not strings', () => {
  assert.equal(isNewestStableVersion('5.10.0', ['5.9.0', '5.10.0']), true)
  assert.equal(isNewestStableVersion('5.9.1', ['5.9.1', '5.10.0']), false)
})

test('ignores prerelease versions', () => {
  assert.equal(isNewestStableVersion('5.0.1', ['5.0.1', '0.0.0-nightly-20261110061147', '6.0.0-pre.1']), true)
})
