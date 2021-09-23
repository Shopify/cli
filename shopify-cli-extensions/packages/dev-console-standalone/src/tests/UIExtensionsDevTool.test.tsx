import React from 'react';
import {Checkbox} from '@shopify/polaris';
import {
  RefreshMinor,
  ViewMinor,
  HideMinor,
  DeleteMinor,
} from '@shopify/polaris-icons';
import {mockExtension} from '@shopify/ui-extensions-dev-console/testing';

import {mount} from 'tests/mount';

import {UIExtensionsDevTool} from '../UIExtensionsDevTool';
import {ExtensionRow} from '../ExtensionRow';
import {Action} from '../ActionSet/Action';

describe('UIExtensionsDevTool', () => {
  it('renders ExtensionRow based on localStorage', async () => {
    const extensions = [mockExtension()];

    const container = await mount(
      <UIExtensionsDevTool />,
      {console: {state: {extensions}}}
    );

    const rows = container.findAll(ExtensionRow);

    expect(rows).toHaveLength(extensions.length);

    rows.forEach((row, index) => {
      expect(row.prop('extension')).toStrictEqual(extensions[index]);
    });
  });

  it('calls refresh with selected extensions', async () => {
    const selectedExtension = mockExtension();
    const unselectedExtension = mockExtension();

    const container = await mount(
      <UIExtensionsDevTool />,
      {console: {state: {extensions: [selectedExtension, unselectedExtension]}}}
    );

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.find(Action, {source: RefreshMinor})?.trigger('onAction');

    expect(container.context.console.send).toHaveBeenCalledWith([selectedExtension]);
  });

  it('calls remove with selected extensions', async () => {
    const selectedExtension = mockExtension();
    const unselectedExtension = mockExtension();

    const container = await mount(
      <UIExtensionsDevTool />,
      {console: {state: {extensions: [selectedExtension, unselectedExtension]}}},
    );

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.find(Action, {source: DeleteMinor})?.trigger('onAction');

    expect(container.context.console.send).toHaveBeenCalledWith([selectedExtension]);
  });

  it('toggles selection of all extensions when select all checkbox is clicked', async () => {
    const extensions = [
      mockExtension(),
      mockExtension(),
    ];

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
    const toggleExtension = mockExtension();
    const otherExtension = mockExtension();

    const container = await mount(
      <UIExtensionsDevTool />,
      {console: {state: {extensions: [toggleExtension, otherExtension]}}}
    );

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
    const focusExtension = mockExtension();
    const prevFocusedExtension = mockExtension();

    const container = await mount(
      <UIExtensionsDevTool />,
      {console: {state: {extensions: [focusExtension, prevFocusedExtension]}}}
    );

    container.act(() => {
      container
        .find(ExtensionRow, {extension: focusExtension})
        ?.trigger('onHighlight', focusExtension);
    });

    expect(container.context.console.send).toHaveBeenCalledWith([
      {...focusExtension, focused: true},
      {...prevFocusedExtension, focused: false},
    ]);
  });

  it('clear focus state of all extensions when onClearHighlight for a row is triggered', async () => {
    const extension1 = mockExtension({focused: true} as any);
    const extension2 = mockExtension({focused: true} as any);

    const container = await mount(
      <UIExtensionsDevTool />,
      {console: {state: {extensions: [extension1, extension2]}}}
    );

    container.act(() => {
      container
        .find(ExtensionRow, {extension: extension1})
        ?.trigger('onClearHighlight');
    });

    expect(container.context.console.send).toHaveBeenCalledWith([
      {...extension1, focused: false},
      {...extension2, focused: false},
    ]);
  });

  it('calls show with selected extensions', async () => {
    const selectedExtension = mockExtension();
    selectedExtension.development.hidden = true;

    const unselectedExtension = mockExtension();

    const container = await mount(
      <UIExtensionsDevTool />,
      {console: {state: {extensions: [selectedExtension, unselectedExtension]}}}
    );

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.act(() => {
      container.find(Action, {source: HideMinor})?.trigger('onAction');
    });

    expect(container.context.console.send).toHaveBeenCalledWith([selectedExtension]);
  });

  it('calls hide with selected extensions', async () => {
    const selectedExtension = mockExtension();
    const unselectedExtension = mockExtension();

    const container = await mount(
      <UIExtensionsDevTool />,
      {console: {state: {extensions: [selectedExtension, unselectedExtension]}}}
    );

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.act(() => {
      container.find(Action, {source: ViewMinor})?.trigger('onAction');
    });

    expect(container.context.console.send).toHaveBeenCalledWith([selectedExtension]);
  });
});
