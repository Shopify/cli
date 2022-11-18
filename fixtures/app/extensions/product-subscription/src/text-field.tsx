import React, {useState, useMemo, useCallback, useEffect} from 'react'
import {Checkbox, Heading, BlockStack, TextField, Text, useExtensionApi} from '@shopify/admin-ui-extensions-react'
import {makeStatefulSubscribable, RemoteSubscribable} from '@remote-ui/async-subscription'

export function TextFieldExample() {
  const {subscribableState, applyStateUpdates} = useExtensionApi()
  const extensionState = useMemo(() => makeStatefulSubscribable<RemoteSubscribable<any>>(subscribableState), [])

  const initialValue = extensionState.current
  const [customProduct, setCustomProduct] = useState(initialValue.customProduct || false)
  const [manufacturerPart, setManufacturerPart] = useState(initialValue.manufacturerPart || '')
  const clearFirstName = useCallback(() => applyStateUpdates({manufacturerPart: ''}), [])

  useEffect(() => {
    return extensionState.subscribe(() => {
      const updatedState = extensionState.current;

      console.log('update received from host: ', updatedState);

      setManufacturerPart(updatedState.manufacturerPart || '');
      setCustomProduct(updatedState.customProduct || false);
    })
  }, [setManufacturerPart, extensionState.subscribe]);

  return (
    <BlockStack>
      <Text size="small">Product identifier</Text>
      <Text>Custom products usually don't have a barcode (GTIN), or a Manufacturer Part Number (MPN).</Text>
      <Checkbox label="This is a custom product" checked={customProduct} onChange={(value) => {
          applyStateUpdates({customProduct: value})
        }} />
      <TextField
        label="Manufacturer Part Number (MPN)"
        value={manufacturerPart}
        onInput={(value) => {
          applyStateUpdates({manufacturerPart: value})
        }}
        clearButton
        onClearButtonPress={clearFirstName}
      />
    </BlockStack>
  )
}
