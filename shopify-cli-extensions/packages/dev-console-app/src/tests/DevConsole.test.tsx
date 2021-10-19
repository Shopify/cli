import React from 'react';
import {Checkbox} from '@shopify/polaris';
import {mockExtension} from '@shopify/ui-extensions-dev-console/testing';
import {mount} from 'tests/mount';
import {mockI18n} from 'tests/mock-i18n';

import {DevConsole} from '../DevConsole';
import {ExtensionRow} from '../ExtensionRow';
import {Action} from '../ActionSet/Action';
import en from '../translations/en.json';

const i18n = mockI18n(en);

describe('DevConsole', () => {
  it('renders ExtensionRow based on localStorage', async () => {
    const extensions = [mockExtension()];

    const container = await mount(<DevConsole />, {console: {extensions}});

    const rows = container.findAll(ExtensionRow);

    expect(rows).toHaveLength(extensions.length);

    rows.forEach((row, index) => {
      expect(row.prop('extension')).toStrictEqual(extensions[index]);
    });
  });

  it('calls refresh with selected extensions', async () => {
    const selectedExtension = mockExtension();
    const unselectedExtension = mockExtension();

    const container = await mount(<DevConsole />, {
      console: {extensions: [selectedExtension, unselectedExtension]},
    });

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container
      .find(Action, {accessibilityLabel: i18n.translate('extensionList.refresh')})
      ?.trigger('onAction');

    expect(container.context.console.send).toHaveBeenCalledWith({
      event: 'dispatch',
      data: {type: 'refresh', payload: [{uuid: selectedExtension.uuid}]},
    });
  });

  it('toggles selection of all extensions when select all checkbox is clicked', async () => {
    const extensions = [mockExtension(), mockExtension()];

    const container = await mount(<DevConsole />, {console: {extensions}});

    container.act(() => {
      container.find(Checkbox)?.trigger('onChange');
    });

    expect(container.findAll(ExtensionRow, {selected: true})).toHaveLength(extensions.length);

    container.act(() => {
      container.find(Checkbox)?.trigger('onChange');
    });

    expect(container.findAll(ExtensionRow, {selected: false})).toHaveLength(extensions.length);
  });

  it('toggles selection of individual extensions when onSelect for a row is triggered', async () => {
    const toggleExtension = mockExtension();
    const otherExtension = mockExtension();

    const container = await mount(<DevConsole />, {
      console: {extensions: [toggleExtension, otherExtension]},
    });

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

  it('calls to set focused to true for the current extension', async () => {
    const focusExtension = mockExtension();
    const prevFocusedExtension = mockExtension();

    const container = await mount(<DevConsole />, {
      console: {extensions: [focusExtension, prevFocusedExtension]},
    });

    container.act(() => {
      container
        .find(ExtensionRow, {extension: focusExtension})
        ?.trigger('onHighlight', focusExtension);
    });

    expect(container.context.console.send).toHaveBeenCalledWith({
      data: {payload: [{uuid: focusExtension.uuid}], type: 'focus'},
      event: 'dispatch',
    });
  });

  it('clear focus state of all extensions when onClearHighlight for a row is triggered', async () => {
    const extension1 = mockExtension({focused: true} as any);
    const extension2 = mockExtension({focused: true} as any);

    const container = await mount(<DevConsole />, {
      console: {extensions: [extension1, extension2]},
    });

    container.act(() => {
      container.find(ExtensionRow, {extension: extension1})?.trigger('onClearHighlight');
    });

    expect(container.context.console.send).toHaveBeenCalledWith({
      data: {type: 'unfocus'},
      event: 'dispatch',
    });
  });

  it('calls show with selected extensions', async () => {
    const selectedExtension = mockExtension();
    selectedExtension.development.hidden = true;

    const unselectedExtension = mockExtension();

    const container = await mount(<DevConsole />, {
      console: {extensions: [selectedExtension, unselectedExtension]},
    });

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.act(() => {
      container
        .find(Action, {accessibilityLabel: i18n.translate('bulkActions.show')})
        ?.trigger('onAction');
    });

    expect(container.context.console.send).toHaveBeenCalledWith({
      data: {extensions: [{development: {hidden: false}, uuid: selectedExtension.uuid}]},
      event: 'update',
    });
  });

  it('calls hide with selected extensions', async () => {
    const selectedExtension = mockExtension();
    const unselectedExtension = mockExtension();

    const container = await mount(<DevConsole />, {
      console: {extensions: [selectedExtension, unselectedExtension]},
    });

    container.act(() => {
      container
        .find(ExtensionRow, {extension: selectedExtension})
        ?.trigger('onSelect', selectedExtension);
    });

    container.act(() => {
      container
        .find(Action, {accessibilityLabel: i18n.translate('bulkActions.hide')})
        ?.trigger('onAction');
    });

    expect(container.context.console.send).toHaveBeenCalledWith({
      data: {extensions: [{development: {hidden: true}, uuid: selectedExtension.uuid}]},
      event: 'update',
    });
  });
});
