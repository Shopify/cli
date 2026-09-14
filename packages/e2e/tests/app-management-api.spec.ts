import {appDeletionReadinessFromApps} from '../setup/app-management-api.js'
import {expect, test} from '@playwright/test'
import type {AppManagementAppState} from '../setup/app-management-api.js'

test.describe('App Management teardown state', () => {
  test('uses the client ID to disambiguate apps with the same name', () => {
    const matchingApp = appState({id: 'gid://organization/App/2', key: 'expected-client-id'})

    expect(
      appDeletionReadinessFromApps(
        [appState({id: 'gid://organization/App/1', key: 'other-client-id'}), matchingApp],
        'E2E app',
        'expected-client-id',
      ),
    ).toEqual({status: 'ready', app: {id: matchingApp.id, key: matchingApp.key}})
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
