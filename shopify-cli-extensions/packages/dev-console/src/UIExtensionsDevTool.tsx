import React, {useCallback, useMemo, useState} from 'react';
import {
  ChevronRightMinor,
  RefreshMinor,
  ToolsMajor,
  ViewMinor,
  HideMinor,
  DeleteMinor,
  MobileMajor,
} from '@shopify/polaris-icons';
import {useI18n} from '@shopify/react-i18n';

import {ExtensionManifestData} from 'types';
import {useLocalExtensions} from 'hooks/useLocalExtensions';
import {ToastProvider} from 'hooks/useToast';
import {getLocalExtensionKey} from 'utils';

import {Checkbox} from './CheckBox';
import {ExtensionRow} from './ExtensionRow';
import {Action} from './ActionSet/Action';
import * as styles from './UIExtensionsDevTool.css';
import * as actionSetStyles from './ActionSet/ActionSet.css';
import en from './translations/en.json';

// Hiding content until there are more options in the side nav
const DISPLAY_SIDENAV = false;

export function UIExtensionsDevTool() {
  const [i18n] = useI18n({
    id: 'UIExtensionsDevTool',
    fallback: en,
});
  const [selectedExtensionsKeys, setSelectedExtensionsKeys] = useState<
    string[]
  >([]);
  const {
    extensions,
    refresh,
    remove,
    show: showExtensions,
    hide,
    add,
  } = useLocalExtensions();

  const allSelected = selectedExtensionsKeys.length === extensions.length;

  const selectExtensions = useCallback(
    (extensions: ExtensionManifestData[]) => {
      const newSelectedKeys = extensions
        .map(getLocalExtensionKey)
        .filter((key) => !selectedExtensionsKeys.includes(key));

      setSelectedExtensionsKeys([
        ...selectedExtensionsKeys,
        ...newSelectedKeys,
      ]);
    },
    [selectedExtensionsKeys],
  );

  const unselectExtensions = useCallback(
    (extensions: ExtensionManifestData[]) => {
      const unselectedKeys = extensions.map(getLocalExtensionKey);

      setSelectedExtensionsKeys(
        selectedExtensionsKeys.filter((key) => !unselectedKeys.includes(key)),
      );
    },
    [selectedExtensionsKeys],
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      unselectExtensions(extensions);
    } else {
      selectExtensions(extensions);
    }
  };

  const toggleSelect = useCallback(
    (extension: ExtensionManifestData) => {
      if (selectedExtensionsKeys.includes(getLocalExtensionKey(extension))) {
        unselectExtensions([extension]);
        return;
      }
      selectExtensions([extension]);
    },
    [selectExtensions, selectedExtensionsKeys, unselectExtensions],
  );

  const getSelectedExtensionManifests = useCallback(
    () =>
      extensions.filter((extension) =>
        selectedExtensionsKeys.includes(getLocalExtensionKey(extension)),
      ),
    [extensions, selectedExtensionsKeys],
  );

  const refreshSelectedExtensions = () =>
    refresh(getSelectedExtensionManifests());

  const onHighlight = (extension: ExtensionManifestData) => {
    const key = getLocalExtensionKey(extension);
    add(
      extensions.map((extension) => ({
        ...extension,
        focused: getLocalExtensionKey(extension) === key,
      })),
    );
  };

  const onClearHighlight = () =>
    add(extensions.map((extension) => ({...extension, focused: false})));

  const showAction = useMemo(() => {
    const hideSelectedExtensions = () => hide(getSelectedExtensionManifests());

    return (
      <Action
        source={ViewMinor}
        accessibilityLabel={i18n.translate('bulkActions.hide')}
        onAction={hideSelectedExtensions}
      />
    );
  }, [i18n, hide, getSelectedExtensionManifests]);

  const hideAction = useMemo(() => {
    const showSelectedExtensions = () =>
      showExtensions(getSelectedExtensionManifests());

    return (
      <Action
        source={HideMinor}
        accessibilityLabel={i18n.translate('bulkActions.show')}
        onAction={showSelectedExtensions}
      />
    );
  }, [i18n, showExtensions, getSelectedExtensionManifests]);

  const [
    activeMobileQRCodeExtension,
    setActiveMobileQRCodeExtension,
  ] = useState<ExtensionManifestData>();

  const actionHeaderMarkup = useMemo(() => {
    if (!selectedExtensionsKeys.length) return null;

    const selectedExtensionManifests = getSelectedExtensionManifests();

    const deleteSelectedExtensions = () => remove(selectedExtensionManifests);

    const selectedExtensionsVisible: boolean =
      selectedExtensionManifests.findIndex(
        (extensionManifest) => !extensionManifest.hidden,
      ) !== -1;

    return (
      <>
        {selectedExtensionsVisible ? showAction : hideAction}
        <Action
          className={styles.Hidden}
          source={MobileMajor}
          accessibilityLabel=""
          onAction={() => null}
        />
        <Action
          source={DeleteMinor}
          accessibilityLabel={i18n.translate('extensionList.delete')}
          onAction={deleteSelectedExtensions}
        />
      </>
    );
  }, [
    getSelectedExtensionManifests,
    selectedExtensionsKeys,
    showAction,
    hideAction,
    remove,
    i18n,
  ]);

  const ConsoleSidenav = () =>
    DISPLAY_SIDENAV ? (
      <aside className={styles.SideBar}>
        <nav>
          <ul>
            <li className={styles.MenuItem}>
              {i18n.translate('extensionList.title')}
              <ChevronRightMinor />
            </li>
          </ul>
        </nav>
      </aside>
    ) : null;

  return (
    <ToastProvider>
      <div className={styles.OuterContainer}>
        <div className={styles.DevTool}>
            <header className={styles.Header}>
              <section className={styles.HeaderLeft}>
                <div>
                  <ToolsMajor />
                </div>
                <h1>&nbsp;{i18n.translate('title')}</h1>
              </section>
            </header>
            <main>
              <ConsoleSidenav />
              {extensions.length > 0 && (
                <section className={styles.ExtensionList}>
                  <table>
                    <thead>
                      <tr>
                        <th>
                          <Checkbox
                            label={
                              allSelected
                                ? i18n.translate('bulkActions.deselectAll')
                                : i18n.translate('bulkActions.selectAll')
                            }
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            labelHidden
                          />
                        </th>
                        <th>{i18n.translate('extensionList.name')}</th>
                        <th>{i18n.translate('extensionList.type')}</th>
                        <th>{i18n.translate('extensionList.servedFrom')}</th>
                        <th>{i18n.translate('extensionList.status')}</th>
                        <th>
                          <div className={actionSetStyles.ActionGroup}>
                            {actionHeaderMarkup}
                            <Action
                              source={RefreshMinor}
                              accessibilityLabel={i18n.translate(
                                'extensionList.refresh',
                              )}
                              onAction={refreshSelectedExtensions}
                            />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {extensions.map((extension) => {
                        const key = getLocalExtensionKey(extension);
                        return (
                          <ExtensionRow
                            key={key}
                            extension={extension}
                            onSelect={toggleSelect}
                            selected={selectedExtensionsKeys.includes(key)}
                            onHighlight={onHighlight}
                            onClearHighlight={onClearHighlight}
                            activeMobileQRCode={
                              activeMobileQRCodeExtension !== undefined &&
                              getLocalExtensionKey(
                                activeMobileQRCodeExtension,
                              ) === key
                            }
                            onShowMobileQRCode={setActiveMobileQRCodeExtension}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )}
            </main>
          </div>
      </div>
    </ToastProvider>
  );
}
