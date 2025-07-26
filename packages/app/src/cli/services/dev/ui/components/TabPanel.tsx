import React, {useState, useRef, useLayoutEffect} from 'react'
import {Box, Text, useInput, useStdin, useStdout, measureElement} from '@shopify/cli-kit/node/ink'

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
  initialActiveTab: string
}

// Using a width less than 100% reduces (but doesn't eliminate) screen artifacts when resizing the terminal
const TAB_WIDTH_PERCENTAGE = 0.9

export const TabPanel: React.FunctionComponent<TabPanelProps> = ({tabs, initialActiveTab}) => {
  const {stdout} = useStdout()
  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const [activeTab, setActiveTab] = useState<string>(initialActiveTab)
  const [tabWidth, setTabWidth] = useState<number>(Math.floor(stdout.columns * TAB_WIDTH_PERCENTAGE))
  const [displayActions, setDisplayActions] = useState<boolean>(true)
  const contentTabsRef = useRef(null)

  if (!activeTab) {
    throw new Error('No tabs provided')
  }

  useInput(
    (input, key) => {
      const onInput = async () => {
        // Handle arrow key navigation and tab key for tabs with content
        if (key?.leftArrow || key?.rightArrow || key?.tab) {
          const contentTabs = Object.entries(tabs).filter(([_, tab]) => tab.content)
          const currentIndex = contentTabs.findIndex(([tabKey]) => tabKey === activeTab)
          if (currentIndex === -1) return
          const direction = key?.leftArrow ? -1 : 1
          const newIndex = (currentIndex + direction + contentTabs.length) % contentTabs.length
          const newTabEntry = contentTabs[newIndex]
          if (newTabEntry) {
            setActiveTab(newTabEntry[0])
          }
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

  useLayoutEffect(() => {
    const handleResize = () => {
      setTabWidth(Math.floor(stdout.columns * TAB_WIDTH_PERCENTAGE))
      if (!contentTabsRef.current) {
        return
      }
      const contentTabsWidth = measureElement(contentTabsRef.current)
      setDisplayActions(contentTabsWidth.width < stdout.columns)
    }

    stdout.on('resize', handleResize)
    return () => {
      stdout.off('resize', handleResize)
    }
  }, [stdout])

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
        width={tabWidth}
        flexDirection="row"
        flexGrow={1}
        borderStyle="single"
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderTop
      >
        <Box ref={contentTabsRef} flexDirection="row" flexWrap="nowrap" flexShrink={0} marginRight={3}>
          <Text wrap="truncate-end">
            {'│'}
            {contentTabs.map((tab) => {
              return (
                <React.Fragment key={tab.inputKey}>
                  <Text bold={activeTab === tab.inputKey} inverse={activeTab === tab.inputKey} wrap="truncate">
                    {tab.header}
                  </Text>
                  {'│'}
                </React.Fragment>
              )
            })}
          </Text>
        </Box>
        {displayActions && (
          <Box flexGrow={1} justifyContent="flex-end">
            {actionTabs.map((tab, index) => (
              <Text wrap="truncate" key={tab.inputKey}>
                {tab.inputKey} {tab.label}
                {index < actionTabs.length - 1 && ' │ '}
              </Text>
            ))}
          </Box>
        )}
      </Box>
      {/* Tab Content Area */}
      <Box flexDirection="column" marginLeft={1} marginRight={1} marginTop={1}>
        {tabs[activeTab]?.content}
      </Box>
    </>
  )
}
