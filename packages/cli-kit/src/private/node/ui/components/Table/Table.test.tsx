import {Table, TableColumn} from './Table.js'
import ScalarDict from './ScalarDict.js'
import {render} from '../../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Table', async () => {
  test('formats the table correctly', async () => {
    const rows: ScalarDict[] = [
      {id: '#1361', name: 'Dawn', role: '[live]'},
      {id: '#1363', name: 'Studio', role: ''},
      {id: '#1374', name: 'Debut', role: '[unpublished]'},
      {
        id: '#1368',
        name: 'Development (1a23b4-MBP)',
        role: '[development]',
      },
    ]
    const color = 'grey'
    const columns: TableColumn<{[key in 'name' | 'role' | 'id']: string}> = {
      name: {},
      role: {
        color,
      },
      id: {
        color,
        header: 'Identifier',
      },
    }

    const renderInstance = render(<Table rows={rows} columns={columns} />)

    const standard = '[39m'
    const grey = '[90m'

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "name                      role           Identifier
      ────────────────────────  ─────────────  ──────────
      Dawn                      ${grey}[live]       ${standard}  ${grey}#1361     ${standard}
      Studio                    ${grey}             ${standard}  ${grey}#1363     ${standard}
      Debut                     ${grey}[unpublished]${standard}  ${grey}#1374     ${standard}
      Development (1a23b4-MBP)  ${grey}[development]${standard}  ${grey}#1368     ${standard}"
    `)
  })
})
