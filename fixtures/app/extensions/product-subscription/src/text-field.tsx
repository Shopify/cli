import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {BlockStack, TextField, Text, useExtensionApi} from '@shopify/admin-ui-extensions-react';
import {
  makeStatefulSubscribable,
  RemoteSubscribable,
} from '@remote-ui/async-subscription';

export function TextFieldExample() {
  const {extensionState: subscribaleExtensionState, applyStateUpdates} = useExtensionApi();
  const extensionState = useMemo(() => makeStatefulSubscribable<RemoteSubscribable<any>>(subscribaleExtensionState), []);

  const [firstName, setFirstName] = useState(extensionState.current.firstName || '');
  const clearFirstName = useCallback(() => setFirstName(''), []);
  const [lastName, setLastName] = useState('');
  const clearLastName = useCallback(() => setLastName(''), []);
  const [search, setSearch] = useState('');
  const [review, setReview] = useState('');
  const [numberValue, setNumberValue] = useState('0');

  useEffect(() => {
    return extensionState.subscribe(() => {
    console.log('updated', extensionState.current);
    if(extensionState.current.hasOwnProperty('firstName')) {
      setFirstName(extensionState.current.firstName)
    }
  });
  }, [setFirstName, extensionState.subscribe]);

  return (
      <BlockStack>
        <TextField
          label="First name"
          placeholder="Type your first name (onChange)"
          value={firstName}
          onChange={(value) => {
            setFirstName(value);
            applyStateUpdates({firstName: value});
          }}
          clearButton
          onClearButtonPress={clearFirstName}
        />
        {firstName && <Text>First name: {firstName}</Text>}
        <TextField
          label="Last name"
          placeholder="Type your last name (onInput)"
          value={lastName}
          onInput={setLastName}
          clearButton
          onClearButtonPress={clearLastName}
        />
        {lastName && <Text>Last name: {lastName}</Text>}
        <TextField
          label="Reviews"
          type="search"
          placeholder="Search for reviews"
          value={search}
          onChange={setSearch}
        />
        <TextField
          label="Reply"
          placeholder="Add a reply to this review..."
          multiline
          value={review}
          onChange={setReview}
        />
        <TextField label="Number" type="number" value={numberValue} onChange={setNumberValue} />
        <TextField label="Error" value="Inline error" error="This field is invalid" />
        <TextField value="42" type="number" suffix="%" label="A real percent" />
        <TextField value="stuff around" prefix="Only the best" label="Cool things" />
        <TextField
          type="search"
          value="cool tech"
          prefix="I'm interested in"
          label="Search prefix"
        />
      </BlockStack>
  );
}
