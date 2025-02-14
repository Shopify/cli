import useLayout from '../hooks/use-layout.js'
import {Box, Newline, Text} from 'ink'
import React, {FunctionComponent, useContext, useRef} from 'react'
import {TokenizedText} from './TokenizedText.js'
import {List} from './List.js'
import figures from 'figures'

interface FakeDevProps {
}

const BoxWithBorder: FunctionComponent<{width: number; height: number; heading: string}> = ({width, height, heading, children}) => {
  return (
    <Box
      width={width}
      height={height}
      marginBottom={1}
      borderStyle="round"
      flexDirection="column"
    >
      <Box marginTop={-1} marginLeft={1}>
        <Text>{` ${heading} `}</Text>
      </Box>
      <Box flexDirection="column" paddingY={1} paddingX={2} gap={1}>
        {children}
      </Box>
    </Box>
  )
}

const FakeDev: FunctionComponent<FakeDevProps> = () => {
  const {oneThird, twoThirds, fullWidth} = useLayout()
  const appInfoList = [
    "Org:             Ariel Caplan",
    "App:             pragmatic-benchmark-app",
    "Dev store:       ariel-caplan-test.myshopify.com",
    "Update URLs:     Not yet configured",
  ]
  const appBuildList = [
    {color: 'green', bullet: figures.tick, text: 'App home'},
    {color: 'green', bullet: figures.tick, text: 'admin-action-1'},
    {color: 'red', bullet: figures.cross, text: 'function-2'},
  ]
  const devPreviewEnabled = true

  return (<>
    <Box flexDirection="column" gap={-1}>
      <Box flexDirection="row">
        <BoxWithBorder width={twoThirds} height={15} heading="App info">
          <Text bold>
            <TokenizedText item="Using shopify.app.toml for default values:" />
          </Text>
          <List items={appInfoList} ordered={false} />
          <Newline />
          <Text>
            <TokenizedText item="You can pass `--reset` to your command to reset your app configuration." />
          </Text>
        </BoxWithBorder>
        <BoxWithBorder width={oneThird} height={15} heading="Extension builds">
          <Box flexDirection="column" gap={0}>
            {
              appBuildList.map(({color, bullet, text}, index) => (
                <Box key={index} marginLeft={2}>
                  <Text color={color}>{bullet}</Text>

                  <Box flexGrow={1} marginLeft={1}>
                    <Text>
                      <TokenizedText item={text} />
                    </Text>
                  </Box>
                </Box>
              ))
            }
          </Box>
        </BoxWithBorder>
      </Box>
      <Box flexDirection="row">
        <BoxWithBorder width={fullWidth} height={9} heading="Actions">
          <Box flexDirection="column">
            <Text>
              {figures.pointerSmall} Press <Text bold>d</Text> {figures.lineVertical} toggle development store
              preview: {}
              {devPreviewEnabled ? <Text color="green">✔ on</Text> : <Text color="red">✖ off</Text>}
            </Text>
            <Text>
              {figures.pointerSmall} Press <Text bold>l</Text> {figures.lineVertical} view logs
            </Text>
            <Text>
              {figures.pointerSmall} Press <Text bold>g</Text> {figures.lineVertical} open GraphiQL (Admin API) in
              your browser
            </Text>
            <Text>
              {figures.pointerSmall} Press <Text bold>p</Text> {figures.lineVertical} preview in your browser
            </Text>
            <Text>
              {figures.pointerSmall} Press <Text bold>q</Text> {figures.lineVertical} quit
            </Text>
          </Box>
        </BoxWithBorder>
      </Box>
    </Box>
    <Box flexDirection="column" gap={-1}>
      <Box flexDirection="row">
        <BoxWithBorder width={30} height={20} heading="App Components">
          <Box flexDirection="column" height={18}>
            <Box flexDirection="column" gap={0}>
              <Text bold>
                <TokenizedText item="Build" />
              </Text>
              <Text>{">"} Home</Text>
              <Text>{" "} admin-action-1</Text>
              <Text>{" "} function-2</Text>
              <Text bold>
                <TokenizedText item="Run" />
              </Text>
              <Text>{" "} App</Text>
            </Box>
            <Box flexGrow={2}></Box>
            <Box gap={1} justifyContent="flex-start">
              <Text>
                <Text inverse>Tab</Text> Next component{" "}
                <Text inverse>Shift+Tab</Text> Previous component
              </Text>
            </Box>
          </Box>
        </BoxWithBorder>
        <BoxWithBorder width={fullWidth - 30} height={20} heading="Logs">
          <Box flexDirection="column" height={18}>
            <Box flexDirection="column">
              <Text>2025-02-12T19:28:44Z Build succeeded.</Text>
              <Text>2025-02-12T19:32:54Z Build succeeded.</Text>
              <Text>2025-02-12T19:32:48Z Build succeeded.</Text>
              <Text>2025-02-12T19:33:19Z Build succeeded.</Text>
              <Text>2025-02-12T19:35:22Z Build succeeded.</Text>
            </Box>
            <Box flexGrow={2}></Box>
            <Box justifyContent="flex-start">
              <Text>
                <Text inverse>{figures.arrowUp}{figures.arrowDown}</Text> Scroll{" "}
                <Text inverse>f</Text> jump to latest{" "}
                <Text inverse>/</Text> search{" "}
                <Text inverse>n</Text> next search result{" "}
                <Text inverse>p</Text> previous search result{" "}
              </Text>
            </Box>
          </Box>
        </BoxWithBorder>
      </Box>
      <Box flexDirection="row">
        <BoxWithBorder width={fullWidth} height={9} heading="Actions">
          <Box flexDirection="column">
            <Text>
              {figures.pointerSmall} Press <Text bold>d</Text> {figures.lineVertical} toggle development store
              preview: {}
              {devPreviewEnabled ? <Text color="green">✔ on</Text> : <Text color="red">✖ off</Text>}
            </Text>
            <Text>
              {figures.pointerSmall} Press <Text bold>m</Text> {figures.lineVertical} return to main view
            </Text>
            <Text>
              {figures.pointerSmall} Press <Text bold>g</Text> {figures.lineVertical} open GraphiQL (Admin API) in
              your browser
            </Text>
            <Text>
              {figures.pointerSmall} Press <Text bold>p</Text> {figures.lineVertical} preview in your browser
            </Text>
            <Text>
              {figures.pointerSmall} Press <Text bold>q</Text> {figures.lineVertical} quit
            </Text>
          </Box>
        </BoxWithBorder>
      </Box>
    </Box>
  </>)
}

export {FakeDev}

