import {Checkbox} from './CheckBox'
import {ExtensionRow} from './ExtensionRow'
import {Action} from './ActionSet/Action'
import * as styles from './DevConsole.module.scss'
// eslint-disable-next-line @shopify/strict-component-boundaries
import * as actionSetStyles from './ActionSet/ActionSet.module.scss'
import en from './translations/en.json'
import {QRCodeModal} from './QRCodeModal'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {useI18n} from '@shopify/react-i18n'
import {ChevronRightMinor, RefreshMinor, ToolsMajor, ViewMinor, HideMinor, MobileMajor} from '@shopify/polaris-icons'
import React, {useCallback, useMemo, useState} from 'react'
import {ToastProvider} from '@/hooks/useToast'
import {useDevConsoleInternal} from '@/hooks/useDevConsoleInternal'

// Hiding content until there are more options in the side nav
const DISPLAY_SIDENAV = false

function getUuid({uuid}: {uuid: string}) {
  return uuid
}

export function DevConsole() {
  const [i18n] = useI18n({
    id: 'DevConsole',
    fallback: en,
  })
  const [selectedExtensionsSet, setSelectedExtensionsSet] = useState<Set<string>>(new Set())
  const {
    state: {extensions},
    connect,
    refresh,
    show,
    hide,
    focus,
    unfocus,
    client: {
      options: {surface},
    },
  } = useDevConsoleInternal()

  const allSelected = selectedExtensionsSet.size === extensions.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedExtensionsSet(new Set([]))
    } else {
      setSelectedExtensionsSet(new Set(extensions.map(getUuid)))
    }
  }

  const toggleSelect = useCallback((extension: ExtensionPayload) => {
    setSelectedExtensionsSet((set) => {
      // if delete === false, extension not selected; therefore select it instead
      if (!set.delete(extension.uuid)) set.add(extension.uuid)
      return new Set(set)
    })
  }, [])

  const selectedExtensions = useMemo(
    () => extensions.filter((extension) => selectedExtensionsSet.has(extension.uuid)),
    [extensions, selectedExtensionsSet],
  )

  const refreshSelectedExtensions = () => refresh(selectedExtensions)

  const [activeMobileQRCodeExtension, setActiveMobileQRCodeExtension] = useState<ExtensionPayload>()

  const actionHeaderMarkup = useMemo(() => {
    if (!selectedExtensions.length) return null

    const selectedExtensionsVisible: boolean =
      selectedExtensions.findIndex((extension) => !extension.development.hidden) !== -1

    return (
      <>
        {toggleViewAction()}
        <Action className={styles.Hidden} source={MobileMajor} accessibilityLabel="" onAction={() => null} />
      </>
    )

    function toggleViewAction() {
      return selectedExtensionsVisible ? (
        <Action
          source={ViewMinor}
          accessibilityLabel={i18n.translate('bulkActions.hide')}
          onAction={() => hide(selectedExtensions)}
        />
      ) : (
        <Action
          source={HideMinor}
          accessibilityLabel={i18n.translate('bulkActions.show')}
          onAction={() => show(selectedExtensions)}
        />
      )
    }
  }, [selectedExtensions, show, hide, i18n])

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
    ) : null

  const ConsoleContent = () => (
    <section className={styles.ExtensionList}>
      <table>
        <thead>
          <tr>
            <th>
              <Checkbox
                label={
                  allSelected ? i18n.translate('bulkActions.deselectAll') : i18n.translate('bulkActions.selectAll')
                }
                checked={allSelected}
                onChange={toggleSelectAll}
                labelHidden
              />
            </th>
            <th>{i18n.translate('extensionList.name')}</th>
            <th>{i18n.translate('extensionList.type')}</th>
            <th>{i18n.translate('extensionList.status')}</th>
            <th>
              <div className={actionSetStyles.ActionGroup}>
                {actionHeaderMarkup}
                <Action
                  source={RefreshMinor}
                  accessibilityLabel={i18n.translate('extensionList.refresh')}
                  onAction={refreshSelectedExtensions}
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {extensions.map((extension) => {
            const uuid = extension.uuid
            return (
              <ExtensionRow
                key={uuid}
                extension={extension}
                onSelect={toggleSelect}
                selected={selectedExtensionsSet.has(uuid)}
                onHighlight={focus}
                onClearHighlight={unfocus}
                onCloseMobileQRCode={() => setActiveMobileQRCodeExtension(undefined)}
                onShowMobileQRCode={setActiveMobileQRCodeExtension}
              />
            )
          })}
        </tbody>
      </table>
    </section>
  )

  const ConsoleEmpty = () => {
    return (
      <div className={styles.Empty}>
        {surface ? i18n.translate('errors.noExtensionsForSurface', {surface}) : i18n.translate('errors.noExtensions')}
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className={styles.OuterContainer}>
        <div className={styles.DevTool}>
          <header className={styles.Header}>
            <section className={styles.HeaderLeft}>
              <ToolsMajor />
              <h1>&nbsp;{i18n.translate('title')}</h1>
            </section>
          </header>
          <main>
            <ConsoleSidenav />
            {extensions.length > 0 ? <ConsoleContent /> : <ConsoleEmpty />}
            <QRCodeModal
              extension={activeMobileQRCodeExtension}
              open={activeMobileQRCodeExtension !== undefined}
              onClose={() => setActiveMobileQRCodeExtension(undefined)}
            />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
