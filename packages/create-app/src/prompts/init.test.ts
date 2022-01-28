import {prompt} from '@shopify/support';

import init from './init';

jest.mock('@shopify/support', () => {
  return {
    prompt: {
      prompt: jest.fn(),
    },
  };
});
const promptMock = prompt.prompt as any;

describe('init prompt', () => {
  it('prompts when the name is passed', async () => {
    // Given
    const directory = '/path/to/output';
    const name = 'app-name';
    promptMock.mockReturnValue(
      Promise.resolve({
        name,
        directory,
      }),
    );

    // When
    await init({directory, name});

    // Then
    expect(promptMock.mock.calls).toHaveLength(1);
    const input = promptMock.mock.calls[0][0][0];
    expect(input.type).toBe('input');
    expect(input.name).toBe('name');
    const when = input.when;
    expect(when()).toBe(false);
  });

  it('prompts when the name is not passed', async () => {
    // Given
    const directory = '/path/to/output';
    promptMock.mockReturnValue(
      Promise.resolve({
        directory,
      }),
    );

    // When
    await init({directory});

    // Then
    expect(promptMock.mock.calls).toHaveLength(1);
    const input = promptMock.mock.calls[0][0][0];
    expect(input.type).toBe('input');
    expect(input.name).toBe('name');
    const when = input.when;
    expect(when()).toBe(true);
  });
});
