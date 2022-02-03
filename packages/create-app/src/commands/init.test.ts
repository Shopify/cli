import {describe, it, expect, vi} from 'vitest';

import {template} from '../utils/paths';
import initService from '../services/init';
import initPrompt from '../prompts/init';

import Init from './init';

vi.mock('../utils/paths');
vi.mock('../services/init');
vi.mock('../prompts/init');

const templateMock = vi.mocked(template);
const initServiceMock = vi.mocked(initService);
const initPromptMock = vi.mocked(initPrompt);

describe('Init', function () {
  it('initializes the template using the service', async function () {
    // Given
    const templatePath = '/path/to/template';
    const directory = '/path/to/output';
    const appName = 'MyApp';
    const description = 'Description';

    templateMock.mockReturnValue(Promise.resolve(templatePath));
    initPromptMock.mockReturnValue(
      Promise.resolve({name: appName, description}),
    );

    // When
    await Init.run(['--name', appName, '--path', directory]);

    // Then
    expect(initServiceMock).toHaveBeenCalledWith({
      name: appName,
      templatePath,
      directory,
      description,
    });
    expect(initPromptMock).toHaveBeenCalledWith({
      name: appName,
    });
  });
});
