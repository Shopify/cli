import {updateTomlValues} from './toml-patch-wasm.js'
import {describe, expect, test} from 'vitest'

// Sample TOML content for testing
const sampleToml = `
# This is a sample TOML file
title = "TOML Example"

[owner]
name = "Test User"
organization = "Test Org"

[database]
server = "192.168.1.1"
ports = [ 8001, 8001, 8002 ] # Comment after array
enabled = true
`

describe('WASM TOML Patch Integration', () => {
  test('updating TOML makes minimal changes and preserves as much as possible', async () => {
    const output = await updateTomlValues(sampleToml, [
      [['owner', 'dotted', 'notation'], 123.5],
      [['database', 'server'], 'changed'],
      [['top_level'], true],
      [['owner', 'organization'], undefined],
      [
        ['database', 'backup_ports'],
        [8003, 8004],
      ],
    ])

    const expected = `
# This is a sample TOML file
title = "TOML Example"
top_level = true

[owner]
name = "Test User"
dotted.notation = 123.5

[database]
server = "changed"
ports = [ 8001, 8001, 8002 ] # Comment after array
enabled = true
backup_ports = [8003, 8004]
`

    expect(output).toBe(expected)
  })
})
