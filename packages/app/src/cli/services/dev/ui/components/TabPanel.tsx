import React, {useState, useRef, useLayoutEffect} from 'react'
import {
  Box,
  Text,
  useInput,
  useStdin,
  useStdout,
  measureElement,
  useOnClick,
  type DOMElement,
} from '@shopify/cli-kit/node/ink'
import {Link} from '@shopify/cli-kit/node/ui/components'
import {terminalSupportsHyperlinks} from '@shopify/cli-kit/node/system'

export interface Tab {
  label: string
  content?: React.ReactNode
  shortcuts?: TabShortcut[]
  action?: () => Promise<void>
}

export interface TabShortcut {
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

const TAB_WIDTH_PERCENTAGE = 1
const INFORMATION_PANEL_WIDTH_PERCENTAGE = 0.5
const SHOPIFY_GREEN = '#96BF48'
const SHOPIFY_CLI_DOCUMENTATION_URL = 'https://shopify.dev/docs/apps/build/cli-for-apps'
const CHROME_TAB_BORDER = {
  topLeft: '╭',
  top: '─',
  topRight: '╮',
  right: '│',
  bottomRight: '┴',
  bottom: '─',
  bottomLeft: '┴',
  left: '│',
}
const FIRST_CHROME_TAB_BORDER = {
  ...CHROME_TAB_BORDER,
  bottomLeft: '├',
}
const ACTIVE_CHROME_TAB_BORDER = {
  ...CHROME_TAB_BORDER,
  bottomRight: '└',
  bottom: ' ',
  bottomLeft: '┘',
}
const FIRST_ACTIVE_CHROME_TAB_BORDER = {
  ...ACTIVE_CHROME_TAB_BORDER,
  bottomLeft: '│',
}
const CONTENT_PANEL_BORDER = {
  topLeft: '├',
  top: '─',
  topRight: '┤',
  right: '│',
  bottomRight: '╯',
  bottom: '─',
  bottomLeft: '╰',
  left: '│',
}
interface ClickableTabProps {
  active?: boolean
  chromeTab?: boolean
  firstChromeTab?: boolean
  header: string
  marginRight?: number
  onClick: () => void
}

const ClickableTab: React.FunctionComponent<ClickableTabProps> = ({
  active = false,
  chromeTab = false,
  firstChromeTab = false,
  header,
  marginRight = 1,
  onClick,
}) => {
  const tabRef = useRef<DOMElement>(null)
  let chromeTabBorder = firstChromeTab ? FIRST_CHROME_TAB_BORDER : CHROME_TAB_BORDER
  if (active) chromeTabBorder = ACTIVE_CHROME_TAB_BORDER
  if (active && firstChromeTab) chromeTabBorder = FIRST_ACTIVE_CHROME_TAB_BORDER
  useOnClick(tabRef, (event) => {
    if (event.button === 'left') onClick()
  })

  return (
    <Box ref={tabRef} borderStyle={chromeTab ? chromeTabBorder : 'round'} marginRight={marginRight} overflowX="hidden">
      <Text bold={active}> {header} </Text>
    </Box>
  )
}

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
      header: `(${key}) ${tab.label}`,
    }
  })

  const contentTabs = tabsArray.filter((tab) => !tab.action)
  const actionTabs = tabsArray.filter((tab) => tab.action)
  const requiredContentPanelWidth = contentTabs.reduce((width, tab) => width + tab.header.length + 4, 0)
  const requiredActionPanelWidth = actionTabs.reduce(
    (width, tab, index) => width + tab.header.length + 4 + (index === 0 ? 0 : 1),
    0,
  )
  const informationPanelWidth = Math.max(
    1,
    Math.min(
      Math.max(Math.floor(tabWidth * INFORMATION_PANEL_WIDTH_PERCENTAGE), requiredContentPanelWidth),
      tabWidth - requiredActionPanelWidth - 1,
    ),
  )
  const actionPanelWidth = tabWidth - informationPanelWidth - 1

  const activateTab = async (tab: TabDisplay) => {
    if (tab.action) {
      await tab.action()
    } else {
      setActiveTab(tab.inputKey)
    }
  }

  const activateTabFromClick = (tab: TabDisplay) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    activateTab(tab)
  }

  return (
    <Box flexDirection="row" height="100%" width={tabWidth}>
      <Box flexDirection="column" flexShrink={0} marginRight={1} overflowY="hidden" width={informationPanelWidth}>
        <Box ref={contentTabsRef} flexDirection="row" flexShrink={0} flexWrap="nowrap">
          {contentTabs.map((tab, index) => (
            <ClickableTab
              key={tab.inputKey}
              active={activeTab === tab.inputKey}
              chromeTab
              firstChromeTab={index === 0}
              header={tab.header}
              marginRight={0}
              onClick={() => activateTabFromClick(tab)}
            />
          ))}
          <Box alignItems="flex-end" flexDirection="row" flexGrow={1}>
            <Box
              borderBottom
              borderLeft={false}
              borderRight={false}
              borderStyle="single"
              borderTop={false}
              flexGrow={1}
            />
            <Text>╮</Text>
          </Box>
        </Box>
        <Box
          borderTop={false}
          borderRight
          borderStyle={CONTENT_PANEL_BORDER}
          flexDirection="column"
          flexGrow={1}
          overflowY="hidden"
          paddingLeft={1}
          paddingRight={1}
        >
          {tabs[activeTab]?.content}
        </Box>
      </Box>

      <Box
        alignItems="flex-end"
        flexDirection="column"
        flexShrink={0}
        justifyContent="space-between"
        overflowX="hidden"
        width={actionPanelWidth}
      >
        {displayActions && (
          <Box justifyContent="flex-end" width="100%">
            {actionTabs.map((tab, index) => (
              <ClickableTab
                key={tab.inputKey}
                header={`(${tab.inputKey}) ${tab.label}`}
                marginRight={index === actionTabs.length - 1 ? 0 : 1}
                onClick={() => activateTabFromClick(tab)}
              />
            ))}
          </Box>
        )}
        <Box justifyContent="flex-end" marginBottom={1} paddingRight={1} width="100%">
          <Text wrap="truncate">
            <Text bold italic>
              S
            </Text>
            <Text bold color={SHOPIFY_GREEN}>
              &gt;
            </Text>{' '}
            {terminalSupportsHyperlinks() ? (
              <Link label="Shopify CLI" url={SHOPIFY_CLI_DOCUMENTATION_URL} />
            ) : (
              'Shopify CLI'
            )}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
