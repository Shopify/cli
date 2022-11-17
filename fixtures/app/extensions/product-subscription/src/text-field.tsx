import React, {useState, useCallback} from 'react';
import {Card, BlockStack, TextField, Text} from '@shopify/admin-ui-extensions-react';

export function TextFieldExample() {
  const [firstName, setFirstName] = useState('');
  const clearFirstName = useCallback(() => setFirstName(''), []);
  const [lastName, setLastName] = useState('');
  const clearLastName = useCallback(() => setLastName(''), []);
  const [search, setSearch] = useState('');
  const [review, setReview] = useState('');
  const [numberValue, setNumberValue] = useState('0');

  return (
      <BlockStack>
        <TextField
          label="First name"
          placeholder="Type your first name (onChange)"
          value={firstName}
          onChange={setFirstName}
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
