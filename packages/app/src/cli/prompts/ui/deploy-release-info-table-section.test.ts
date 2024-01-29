import {buildDeployReleaseInfoTableSection} from './deploy-release-info-table-section.js'
import {describe, expect, test} from 'vitest'

describe('buildDeployReleaseInfoTableSection', () => {
  test('when section includes content in all lists the complete result is returned', async () => {
    // Given
    const section = {
      new: ['new'],
      updated: ['updated'],
      unchanged: ['unchanged'],
      removed: ['removed'],
    }

    // When
    const result = buildDeployReleaseInfoTableSection(section)

    // Then
    expect(result).toEqual([
      {bullet: '+', item: ['new', {subdued: '(new)'}], color: 'green'},
      {item: ['updated', {subdued: '(updated)'}], color: '#FF8800'},
      'unchanged',
      {bullet: '-', item: ['removed', {subdued: '(removed)'}], color: 'red'},
    ])
  })
  test('when section includes empty list an empty list is returned', async () => {
    // Given
    const section = {
      new: [],
      unchanged: [],
      removed: [],
    }

    // When
    const result = buildDeployReleaseInfoTableSection(section)

    // Then
    expect(result).toEqual([])
  })
  test('when new section includes custom item the item is returned unmodified', async () => {
    // Given
    const section = {
      new: [['new', {subdued: '(my new suffix)'}]],
      unchanged: [],
      removed: [],
    }

    // When
    const result = buildDeployReleaseInfoTableSection(section)

    // Then
    expect(result).toEqual([{bullet: '+', item: ['new', {subdued: '(my new suffix)'}], color: 'green'}])
  })
  test('when deleted section includes custom item the item is returned unmodified', async () => {
    // Given
    const section = {
      new: [],
      unchanged: [],
      removed: [['deleted', {subdued: '(my deleted suffix)'}]],
    }

    // When
    const result = buildDeployReleaseInfoTableSection(section)

    // Then
    expect(result).toEqual([{bullet: '-', item: ['deleted', {subdued: '(my deleted suffix)'}], color: 'red'}])
  })
})
