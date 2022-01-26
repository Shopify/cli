import {template} from 'utils/paths';
import init from 'services/init';

import Init from './init';

jest.mock('utils/paths');
jest.mock('services/init');
const templateMock = template as jest.Mock;
const initMock = init as jest.Mock;

describe('Init', function () {
  it('initializes the template using the service', async function () {
    // Given
    const templatePath = '/path/to/template';
    const appName = 'MyApp';
    templateMock.mockReturnValue(Promise.resolve(templatePath));

    // When
    await Init.run(['--name', appName]);

    // Then
    expect(initMock).toHaveBeenCalledWith(appName, templatePath);
  });
});
