import {template} from '../utils/paths';
import initService from '../services/init';
import initPrompt from '../prompts/init';

import Init from './init';

jest.mock('utils/paths');
jest.mock('services/init');
jest.mock('prompts/init');

const templateMock = template as jest.Mock;
const initServiceMock = initService as jest.Mock;
const initPromptMock = initPrompt as jest.Mock;

describe('Init', function () {
  it('initializes the template using the service', async function () {
    // Given
    const templatePath = '/path/to/template';
    const directory = '/path/to/output';
    const appName = 'MyApp';
    templateMock.mockReturnValue(Promise.resolve(templatePath));
    initPromptMock.mockReturnValue(
      Promise.resolve({
        name: appName,
        templatePath,
        directory,
      }),
    );

    // When
    await Init.run(['--name', appName, '--path', directory]);

    // Then
    expect(initServiceMock).toHaveBeenCalledWith({
      name: appName,
      templatePath,
      directory,
    });
  });
});
