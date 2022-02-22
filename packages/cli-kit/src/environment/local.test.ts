import {expect, it, describe} from 'vitest';

import {isDebug} from './local';

describe('isDebug', () => {
  it('returns true when DEBUG is 1', () => {
    // Given
    const env = {DEBUG: '1'};

    // When
    const got = isDebug(env);

    // Then
    expect(got).toBe(true);
  });
});
