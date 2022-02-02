import {describe, it, expect, vi} from 'vitest';

import init from './init';

describe('init', () => {
  it('when name is passed', async () => {
    const prompt = vi.fn();

    // Given
    prompt.mockResolvedValue(Promise.resolve({name: 'app'}));

    // When
    const got = await init({name: 'app'}, prompt);

    // Then
    expect(got.name).toBe('app');
    const promptCalls = prompt.mock.calls;
    expect(promptCalls).toHaveLength(1);
    const promptCall = promptCalls[0][0][0];
    expect(promptCall.type).toBe('input');
    expect(promptCall.name).toBe('name');
    expect(promptCall.when()).toBe(false);
  });

  it('when name is not passed', async () => {
    // Given
    const prompt = vi.fn();
    prompt.mockResolvedValue(Promise.resolve({name: 'app'}));

    // When
    const got = await init({}, prompt);

    // Then
    expect(got.name).toBe('app');
    const promptCalls = prompt.mock.calls;
    expect(promptCalls).toHaveLength(1);
    const promptCall = promptCalls[0][0][0];
    expect(promptCall.type).toBe('input');
    expect(promptCall.name).toBe('name');
    expect(promptCall.when()).toBe(true);
  });
});
