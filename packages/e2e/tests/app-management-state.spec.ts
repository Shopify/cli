import {appDeletionReadinessFromApps} from '../setup/app-management-state.js'
import {expect, test} from '@playwright/test'
import type {AppManagementAppState} from '../setup/app-management-state.js'

test.describe('App Management teardown state', () => {
  test('returns the exact client ID match when app names collide', () => {
    const matchingApp = appState({id: 'gid://organization/App/2', key: 'expected-client-id'})

    expect(
      appDeletionReadinessFromApps(
        [appState({id: 'gid://organization/App/1', key: 'other-client-id'}), matchingApp],
        'E2E app',
        'expected-client-id',
      ),
    ).toEqual({status: 'ready', app: {id: matchingApp.id, key: matchingApp.key}})
  })

  test('falls back to the unique name match when the local client ID is stale', () => {
    const matchingApp = appState({id: 'gid://organization/App/1', key: 'current-client-id'})

    expect(appDeletionReadinessFromApps([matchingApp], 'E2E app', 'stale-client-id')).toEqual({
      status: 'ready',
      app: {id: matchingApp.id, key: matchingApp.key},
    })
  })

  test('does not treat a missing install count as zero', () => {
    expect(() => appDeletionReadinessFromApps([appState({installCount: null})], 'E2E app')).toThrow(
      'App Management API did not return installCount for E2E app',
    )
  })

  test('reports installed and deleted apps without ambiguity', () => {
    expect(appDeletionReadinessFromApps([appState({installCount: 2})], 'E2E app')).toEqual({
      status: 'still-installed',
      installCount: 2,
    })
    expect(appDeletionReadinessFromApps([], 'E2E app')).toEqual({status: 'already-deleted'})
  })
})

function appState(overrides: Partial<AppManagementAppState> = {}): AppManagementAppState {
  return {
    id: 'gid://organization/App/1',
    key: 'client-id',
    installCount: 0,
    activeRelease: {version: {name: 'E2E app'}},
    ...overrides,
  }
}
