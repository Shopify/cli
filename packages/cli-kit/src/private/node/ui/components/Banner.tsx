import useLayout from '../hooks/use-layout.js'
import {Link, LinksContext} from '../contexts/LinksContext.js'
import {Box, Text} from 'ink'
import React, {FunctionComponent, useContext, useRef} from 'react'

export type BannerType = 'success' | 'error' | 'warning' | 'info' | 'external_error'

interface BannerProps {
  type: BannerType
}

function typeToColor(type: BannerProps['type']) {
  return {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'dim',
    external_error: 'red',
  }[type]
}

const Footnotes = () => {
  const linksContext = useContext(LinksContext)

  if (linksContext === null || linksContext.links.current === null) {
    return null
  }

  const links = linksContext.links.current
  const linkIds = Object.keys(links)

  return linkIds.length > 0 ? (
    <Box marginBottom={1} marginTop={-1} flexDirection="column">
      {linkIds.map((id) => (
        <Text key={id}>{`[${id}] ${links[id]?.url}`}</Text>
      ))}
    </Box>
  ) : null
}

const BoxWithBorder: FunctionComponent<BannerProps> = ({type, children}) => {
  const {twoThirds} = useLayout()
  const links = useRef<{[key: string]: Link}>({})

  return (
    <LinksContext.Provider
      value={{
        links,
        addLink: (label, url) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const id: string | undefined = Object.keys(links.current).find((id) => links.current[id]!.url === url)
          if (id) {
            return id
          }
          const newId = (Object.keys(links.current).length + 1).toString()
          links.current = {
            ...links.current,
            [newId]: {label, url},
          }
          return newId
        },
      }}
    >
      <Box
        width={twoThirds}
        marginBottom={1}
        borderStyle="round"
        flexDirection="column"
        borderColor={typeToColor(type)}
      >
        <Box marginTop={-1} marginLeft={1}>
          <Text>{` ${type.replace(/_/g, ' ')} `}</Text>
        </Box>
        <Box flexDirection="column" paddingY={1} paddingX={2} gap={1}>
          {children}
        </Box>
      </Box>
      <Footnotes />
    </LinksContext.Provider>
  )
}

const BoxWithTopBottomLines: FunctionComponent<BannerProps> = ({type, children}) => {
  const {twoThirds} = useLayout()
  // 2 initial dashes + 2 spaces surrounding the type
  let topLineAfterTypeLength = twoThirds - 2 - type.length - 2
  if (topLineAfterTypeLength < 0) topLineAfterTypeLength = 0

  return (
    <Box flexDirection="column" marginBottom={1} gap={1}>
      <Text>
        <Text color={typeToColor(type)}>{'─'.repeat(2)}</Text>
        <Text>{` ${type.replace(/_/g, ' ')} `}</Text>
        <Text color={typeToColor(type)}>{'─'.repeat(topLineAfterTypeLength)}</Text>
      </Text>

      {children}

      <Text color={typeToColor(type)}>{'─'.repeat(twoThirds)}</Text>
    </Box>
  )
}

const Banner: FunctionComponent<BannerProps> = ({children, ...props}) => {
  if (props.type === 'external_error') {
    return React.createElement(BoxWithTopBottomLines, props, children)
  } else {
    return React.createElement(BoxWithBorder, props, children)
  }
}

export {Banner}
