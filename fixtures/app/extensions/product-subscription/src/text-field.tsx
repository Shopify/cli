import React, {useState, useMemo, useCallback, useEffect} from 'react'
import {BlockStack, TextField, Text, useExtensionApi} from '@shopify/admin-ui-extensions-react'
import {makeStatefulSubscribable, RemoteSubscribable} from '@remote-ui/async-subscription'

export function TextFieldExample() {
  const {subscribableState, applyStateUpdates} = useExtensionApi()
  const extensionState = useMemo(() => makeStatefulSubscribable<RemoteSubscribable<any>>(subscribableState), [])

  const initialValue = extensionState.current
  const [firstName, setFirstName] = useState(initialValue.firstName || '')
  const clearFirstName = useCallback(() => applyStateUpdates({firstName: ''}), [])
  const [lastName, setLastName] = useState(initialValue.lastName || '')
  const clearLastName = useCallback(() => applyStateUpdates({firstName: ''}), [])

  useEffect(() => {
    return extensionState.subscribe(() => {
      const updatedState = extensionState.current;

      console.log('update received from host: ', updatedState);

      setFirstName(updatedState.firstName || '');
      setLastName(updatedState.lastName || '');
    })
  }, [setFirstName, setLastName, extensionState.subscribe]);

  return (
    <BlockStack>
      <TextField
        label="First name"
        placeholder="Type your first name (onChange)"
        value={firstName}
        onInput={(value) => {
          applyStateUpdates({firstName: value})
        }}
        clearButton
        onClearButtonPress={clearFirstName}
      />
      {firstName && <Text>First name: {firstName}</Text>}
      <TextField
        label="Last name"
        placeholder="Type your last name (onInput)"
        value={lastName}
        onInput={(value) => {
          applyStateUpdates({lastName: value})
        }}
        clearButton
        onClearButtonPress={clearLastName}
      />
      {lastName && <Text>Last name: {lastName}</Text>}
    </BlockStack>
  )
}
