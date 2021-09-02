import React from 'react';
import {Checkbox} from '@shopify/polaris';
import {
  RefreshMinor,
  ViewMinor,
  HideMinor,
  DeleteMinor,
} from '@shopify/polaris-icons';
import {mockExtensions} from '@/dev-console-utils/testing';

import {mount} from 'tests/mount';

import {UIExtensionsDevTool} from '../UIExtensionsDevTool';
import {ExtensionRow} from '../ExtensionRow';
import {Action} from '../ActionSet/Action';
import * as styles from '../UIExtensionsDevTool.css';

const mockApp = {
  id: 'mock',
  apiKey: 'mock',
  applicationUrl: 'mock',
  title: 'mock',
  icon: {
    transformedSrc: 'mock',
  },
};

const mockExtensionsFn = jest.fn();

jest.mock('@/state', () => ({
  ...jest.requireActual('@/state'),
  useLocalExtensions() {
    return mockExtensionsFn();
  },
}));

const defaultExtension = mockExtensions()[0];

const defaultLocalExtensions = {
  extensions: [],
  devConsole: {visible: {console: false}},
};

describe('UIExtensionsDevTool', () => {
  it('renders ExtensionRow based on localStorage', async () => {
    const extensions = [
      {
        ...defaultExtension,
        identifier: 'TYPE',
      },
      {
        ...defaultExtension,
        identifier: 'TYPE',
      },
    ];

    const container = await mount(
      <UIExtensionsDevTool />,
      {consoleState: {extensions}}
    );

    const rows = container.findAll(ExtensionRow);

    expect(rows).toHaveLength(extensions.length);

    rows.forEach((row, index) => {
      expect(row.prop('extension')).toStrictEqual(extensions[index]);
    });
  });

  it('calls refresh with selected extensions', async () => {
    const selectedExtension = {
      ...defaultExtension,
      apiKey: 'jkl789',
      identifier: 'TYPE',
    };

    const unselectedExtension = {
      ...defaultExtension,
      apiKey: 'asdf123',
      identifier: 'TYPE',
    };

    const refresh = jest.fn();

    mockExtensionsFn.mockReturnValue({
      ...defaultLocalExtensions,
      extensions: [selectedExtension, unselectedExtension],
      refresh,
    });

    const container = await mount(<UIExtensionsDevTool />);

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.find(Action, {source: RefreshMinor})?.trigger('onAction');

    expect(refresh).toHaveBeenCalledWith([selectedExtension]);
  });

  it('calls remove with selected extensions', async () => {
    const selectedExtension = {
      ...defaultExtension,
      apiKey: 'jkl789',
      identifier: 'TYPE',
    };

    const unselectedExtension = {
      ...defaultExtension,
      apiKey: 'asdf123',
      identifier: 'TYPE',
    };

    const remove = jest.fn();

    mockExtensionsFn.mockReturnValue({
      ...defaultLocalExtensions,
      extensions: [selectedExtension, unselectedExtension],
      remove,
    });

    const container = await mount(<UIExtensionsDevTool />);

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.find(Action, {source: DeleteMinor})?.trigger('onAction');

    expect(remove).toHaveBeenCalledWith([selectedExtension]);
  });

  it('toggles selection of all extensions when select all checkbox is clicked', async () => {
    const extensions = [
      {
        ...defaultExtension,
        apiKey: 'asdf123',
        identifier: 'TYPE',
      },
      {
        ...defaultExtension,
        apiKey: 'jkl789',
        identifier: 'TYPE',
      },
    ];

    mockExtensionsFn.mockReturnValue({
      ...defaultLocalExtensions,
      extensions,
    });

    const container = await mount(<UIExtensionsDevTool />);

    container.act(() => {
      container.find(Checkbox)?.trigger('onChange');
    });

    expect(container.findAll(ExtensionRow, {selected: true})).toHaveLength(
      extensions.length,
    );

    container.act(() => {
      container.find(Checkbox)?.trigger('onChange');
    });

    expect(container.findAll(ExtensionRow, {selected: false})).toHaveLength(
      extensions.length,
    );
  });

  it('toggles selection of individual extensions when onSelect for a row is triggered', async () => {
    const toggleExtension = {
      ...defaultExtension,
      apiKey: 'asdf123',
      identifier: 'TYPE',
    };

    const otherExtension = {
      ...defaultExtension,
      apiKey: 'jkl789',
      identifier: 'TYPE',
    };

    mockExtensionsFn.mockReturnValue({
      ...defaultLocalExtensions,
      extensions: [toggleExtension, otherExtension],
    });

    const container = await mount(<UIExtensionsDevTool />);

    container.act(() => {
      container
        .find(ExtensionRow, {extension: toggleExtension})
        ?.trigger('onSelect', toggleExtension);
    });

    expect(container).toContainReactComponent(ExtensionRow, {
      extension: toggleExtension,
      selected: true,
    });

    expect(container).toContainReactComponent(ExtensionRow, {
      extension: otherExtension,
      selected: false,
    });

    container.act(() => {
      container
        .find(ExtensionRow, {extension: toggleExtension})
        ?.trigger('onSelect', toggleExtension);
    });

    expect(container).toContainReactComponent(ExtensionRow, {
      extension: toggleExtension,
      selected: false,
    });

    expect(container).toContainReactComponent(ExtensionRow, {
      extension: otherExtension,
      selected: false,
    });
  });

  it('calls to set focused to true for the current extension and set all others to false when onHighlight for a row is triggered', async () => {
    const focusExtension = {
      ...defaultExtension,
      identifier: 'TYPE',
    };

    const prevFocusedExtension = {
      ...defaultExtension,
      identifier: 'TYPE',
      focused: true,
    };

    const add = jest.fn();
    mockExtensionsFn.mockReturnValue({
      ...defaultLocalExtensions,
      extensions: [focusExtension, prevFocusedExtension],
      add,
    });

    const container = await mount(<UIExtensionsDevTool />);

    container.act(() => {
      container
        .find(ExtensionRow, {extension: focusExtension})
        ?.trigger('onHighlight', focusExtension);
    });

    expect(add).toHaveBeenCalledWith([
      {...focusExtension, focused: true},
      {...prevFocusedExtension, focused: false},
    ]);
  });

  it('clear focus state of all extensions when onClearHighlight for a row is triggered', async () => {
    const extension1 = {
      ...defaultExtension,
      apiKey: 'asdf123',
      identifier: 'TYPE',
      focused: true,
    };

    const extension2 = {
      ...defaultExtension,
      apiKey: 'jkl789',
      identifier: 'TYPE',
      focused: true,
    };

    const add = jest.fn();

    mockExtensionsFn.mockReturnValue({
      ...defaultLocalExtensions,
      extensions: [extension1, extension2],
      add,
    });

    const container = await mount(<UIExtensionsDevTool />);

    container.act(() => {
      container
        .find(ExtensionRow, {extension: extension1})
        ?.trigger('onClearHighlight');
    });

    expect(add).toHaveBeenCalledWith([
      {...extension1, focused: false},
      {...extension2, focused: false},
    ]);
  });

  it('calls show with selected extensions', async () => {
    const selectedExtension = {
      ...defaultExtension,
      apiKey: 'jkl789',
      identifier: 'TYPE',
      hidden: true,
    };

    const unselectedExtension = {
      ...defaultExtension,
      apiKey: 'asdf123',
      identifier: 'TYPE',
    };

    const show = jest.fn();

    mockExtensionsFn.mockReturnValue({
      ...defaultLocalExtensions,
      extensions: [selectedExtension, unselectedExtension],
      show,
    });

    const container = await mount(<UIExtensionsDevTool />);

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.act(() => {
      container.find(Action, {source: HideMinor})?.trigger('onAction');
    });

    expect(show).toHaveBeenCalledWith([selectedExtension]);
  });

  it('calls hide with selected extensions', async () => {
    const selectedExtension = {
      ...defaultExtension,
      apiKey: 'jkl789',
      identifier: 'TYPE',
    };

    const unselectedExtension = {
      ...defaultExtension,
      apiKey: 'asdf123',
      identifier: 'TYPE',
    };

    const hide = jest.fn();

    mockExtensionsFn.mockReturnValue({
      ...defaultLocalExtensions,
      extensions: [selectedExtension, unselectedExtension],
      hide,
    });

    const container = await mount(<UIExtensionsDevTool />);
    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.act(() => {
      container.find(Action, {source: ViewMinor})?.trigger('onAction');
    });

    expect(hide).toHaveBeenCalledWith([selectedExtension]);
  });

  it('calls to hide Dev Tool when close button is clicked', async () => {
    const setVisible = jest.fn();

    mockExtensionsFn.mockReturnValue({
      extensions: [],
      devConsole: {
        ...defaultLocalExtensions.devConsole,
        setVisible,
      },
    });

    const container = await mount(<UIExtensionsDevTool />);
    container.act(() => {
      container.find('button', {className: styles.Cancel})?.trigger('onClick');
    });

    expect(setVisible).toHaveBeenCalledWith({console: false});
  });
});
