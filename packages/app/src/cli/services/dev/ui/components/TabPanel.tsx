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

  const contentTabs = tabsArray.filter((tab) => !tab.action)
  const actionTabs = tabsArray.filter((tab) => tab.action)

  return (
    <>
      <Box
        paddingTop={0}
        flexDirection="row"
        flexGrow={1}
        borderStyle="single"
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderTop
      >
        <Box flexDirection="row" flexGrow={1}>
          <Text>
            {'│'}
            {contentTabs.map((tab) => {
              return (
                <React.Fragment key={tab.inputKey}>
                  <Text bold={activeTab === tab.inputKey} inverse={activeTab === tab.inputKey}>
                    {tab.header}
                  </Text>
                  {'│'}
                </React.Fragment>
              )
            })}
          </Text>
        </Box>
        <Box flexGrow={0} alignItems="flex-end">
          <Text>
            {actionTabs.map((tab, index) => (
              <React.Fragment key={tab.inputKey}>
                <Text color="dim">
                  {tab.inputKey} {tab.label}
                </Text>
                {index < actionTabs.length - 1 && <Text color="dim"> │ </Text>}
              </React.Fragment>
            ))}
          </Text>
        </Box>
      </Box>
      {/* Tab Content Area */}
      <Box flexDirection="column" marginLeft={1} marginRight={1} marginTop={1}>
        {tabs[activeTab]?.content}
      </Box>
    </>
  )
}
