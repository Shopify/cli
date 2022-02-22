import {describe, test, expect} from 'vitest';

import {isSpin, instance, workspace, namespace, host} from './spin';

describe('isSpin', () => {
  test('returns true if SPIN=1', () => {
    // Given
    const env = {SPIN: '1'};

    // When
    const got = isSpin(env);

    // Then
    expect(got).toBeTruthy();
  });
});

describe('instance', () => {
  test('returns the value of SPIN_INSTANCE', () => {
    // Given
    const instanceName = 'instance';
    const env = {SPIN_INSTANCE: instanceName};

    // When
    const got = instance(env);

    // Then
    expect(got).toBe(instanceName);
  });

  test('returns undefined value when SPIN_INSTANCE is not defined', () => {
    // Given
    const env = {};

    // When
    const got = instance(env);

    // Then
    expect(got).toBeUndefined();
  });
});

describe('workspace', () => {
  test('returns the value of SPIN_WORKSPACE', () => {
    // Given
    const workspaceName = 'workspace';
    const env = {SPIN_WORKSPACE: workspaceName};

    // When
    const got = workspace(env);

    // Then
    expect(got).toBe(workspaceName);
  });

  test('returns undefined value when SPIN_WORKSPACE is not defined', () => {
    // Given
    const env = {};

    // When
    const got = workspace(env);

    // Then
    expect(got).toBeUndefined();
  });
});

describe('namespace', () => {
  test('returns the value of SPIN_NAMESPACE', () => {
    // Given
    const namespaceName = 'namespace';
    const env = {SPIN_NAMESPACE: namespaceName};

    // When
    const got = namespace(env);

    // Then
    expect(got).toBe(namespaceName);
  });

  test('returns undefined value when SPIN_NAMESPACE is not defined', () => {
    // Given
    const env = {};

    // When
    const got = namespace(env);

    // Then
    expect(got).toBeUndefined();
  });
});

describe('host', () => {
  test('returns the value of SPIN_HOST', () => {
    // Given
    const hostName = 'host';
    const env = {SPIN_HOST: hostName};

    // When
    const got = host(env);

    // Then
    expect(got).toBe(hostName);
  });

  test('returns undefined value when SPIN_HOST is not defined', () => {
    // Given
    const env = {};

    // When
    const got = host(env);

    // Then
    expect(got).toBeUndefined();
  });
});
