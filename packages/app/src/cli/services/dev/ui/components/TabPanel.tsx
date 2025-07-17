import React, {useState} from 'react'
import {Box, Text, useInput, useStdin} from '@shopify/cli-kit/node/ink'

export interface Tab {
  label: string
  content?: React.ReactNode
  shortcuts?: TabShortcut[]
  action?: () => Promise<void>
}

interface TabShortcut {
  key: string
  condition?: () => boolean
  action: () => Promise<void>
}

interface TabDisplay extends Tab {
  inputKey: string
  header: string
}

interface TabPanelProps {
  tabs: {[key: string]: Tab}
  initialActiveTab?: string
}

export const TabPanel: React.FunctionComponent<TabPanelProps> = ({tabs, initialActiveTab}) => {
  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const firstTabKey = Object.keys(tabs)[0]
  const [activeTab, setActiveTab] = useState<string | undefined>(initialActiveTab ?? firstTabKey)

  if (!activeTab) {
    throw new Error('No tabs provided')
  }

  useInput(
    (input, key) => {
      const onInput = async () => {
        // Handle arrow key navigation for tabs with content
        if (key?.leftArrow || key?.rightArrow) {
          const contentTabs = Object.entries(tabs).filter(([_, tab]) => tab.content)
          if (contentTabs.length > 1) {
            const currentIndex = contentTabs.findIndex(([tabKey]) => tabKey === activeTab)
            if (currentIndex !== -1) {
              let newIndex
              // Right arrow
              if (key?.rightArrow) {
                newIndex = currentIndex + 1 < contentTabs.length ? currentIndex + 1 : currentIndex
              } else {
                // Left arrow
                newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex
              }
              const newTabEntry = contentTabs[newIndex]
              if (newTabEntry) {
                setActiveTab(newTabEntry[0])
              }
            }
          }
          return
        }

        // First check if input matches any tab key
        const matchingTab = tabs[input]
        if (matchingTab) {
          if (matchingTab.action) {
            await matchingTab.action()
          } else {
            setActiveTab(input)
          }
          return
        }

        // Then check if input matches any shortcut key for the current active tab
        const currentTab = tabs[activeTab]
        if (currentTab?.shortcuts) {
          const matchingShortcut = currentTab.shortcuts.find((shortcut) => shortcut.key === input)
          if (matchingShortcut) {
            // Check condition if it exists
            if (!matchingShortcut.condition || matchingShortcut.condition()) {
              await matchingShortcut.action()
            }
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      onInput()
    },
    {isActive: Boolean(canUseShortcuts)},
  )

  const tabsArray: TabDisplay[] = Object.entries(tabs).map(([key, tab]) => {
    return {
      ...tab,
      inputKey: key,
      header: ` (${key}) ${tab.label} `,
    }
  })

  // We need to subtract the number of tabs from the total length to account for the borders between and after the tabs
  const tabHeaderLength = tabsArray.reduce((acc, tab) => acc + (tab.header?.length ?? 0), 0) + tabsArray.length + 1

  return (
    <>
      {/* Top border with connected tab boxes */}
      <Text>
        {tabsArray
          .map((tab, index) => {
            return `${index === 0 ? '╒' : '╤'}${'═'.repeat(tab.header?.length ?? 0)}`
          })
          .join('')}
        {'╤'}
        {'═'.repeat(Math.max(0, (process.stdout.columns || 100) - tabHeaderLength - 2))}
        {'╕'}
      </Text>
      {/* Tab content row */}
      <Text>
        {tabsArray.map((tab) => {
          return (
            <React.Fragment key={tab.inputKey}>
              {'│'}
              <Text
                bold={activeTab === tab.inputKey}
                inverse={activeTab === tab.inputKey}
                color={tab.action ? 'dim' : undefined}
              >
                {tab.header}
              </Text>
            </React.Fragment>
          )
        })}
        {`│${' '.repeat(Math.max(0, (process.stdout.columns || 100) - tabHeaderLength - 2))}│`}
      </Text>
      {/* Bottom border connecting tabs */}
      <Text>
        {tabsArray
          .map((tab, index) => {
            return `${index === 0 ? '└' : '┴'}${'─'.repeat(tab.header?.length ?? 0)}`
          })
          .join('')}
        {'┴'}
        {'─'.repeat(Math.max(0, (process.stdout.columns || 100) - tabHeaderLength - 2))}
        {'┘'}
      </Text>
      {/* Tab Content Area */}
      <Box flexDirection="column" marginLeft={1} marginRight={1}>
        {tabs[activeTab]?.content}
      </Box>
    </>
  )
}
