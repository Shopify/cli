import {describe, it, expect, vi} from 'vitest';

import init from './init';

describe('init', () => {
  it('when name and description are not passed', async () => {
    const prompt = vi.fn();
    const answers = {name: 'app', description: 'description'};
    const options = {};

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers));

    // When
    const got = await init(options, prompt);

    // Then
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'name',
        message: 'How would you like to name the app?',
      },
      {
        type: 'input',
        name: 'description',
        message: "What's the application for?",
      },
    ]);
    expect(got).toEqual({...options, ...answers});
  });

  it('when name is passed', async () => {
    const prompt = vi.fn();
    const answers = {name: 'app', description: 'description'};
    const options = {name: 'app'};

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers));

    // When
    const got = await init(options, prompt);

    // Then
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'description',
        message: "What's the application for?",
      },
    ]);
    expect(got).toEqual({...options, ...answers});
  });

  it('when description is passed', async () => {
    const prompt = vi.fn();
    const answers = {name: 'app', description: 'description'};
    const options = {description: 'description'};

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers));

    // When
    const got = await init(options, prompt);

    // Then
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'name',
        message: 'How would you like to name the app?',
      },
    ]);
    expect(got).toEqual({...options, ...answers});
  });
});
