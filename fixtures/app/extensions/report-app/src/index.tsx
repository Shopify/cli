import React, {useState} from 'react';

import {
  extend,
  render,
  Text,
  TextField,
  BlockStack,
  useExtensionApi,
  useData,
  useContainer,
  CardSection,
} from '@shopify/admin-ui-extensions-react';
import { tokenToString } from 'typescript';


// import {shopifyApi, LATEST_API_VERSION} from '@shopify/shopify-api';


extend('Admin::Report::Render', render(() => <Cell />));
extend('Admin::Report::Button', render(() => <Button />));

async function fetchQuery(query, storeUrl, token){
  // https://{store_name}.myshopify.com/admin/api/2023-01/graphql.json
//  const apiUrl = `https://${storeUrl}/admin/api/2023-01/graphql.json`;
  const apiUrl = 'https://development-store-8.shopify.extensions-bbmk.nick-tierney.us.spin.dev/admin/internal/web/graphql/core?operation=UIExtensions&type=query';
  console.log(apiUrl, token);
  const response = await fetch(apiUrl, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'no-cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    // credentials: 'include', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/graphql',
      'X-Shopify-Access-Token': token,
      'X-Requested-With': 'XMLHttpRequest',
    },
    // redirect: 'follow', // manual, *follow, error
    // referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: query // body data type must match "Content-Type" header
  });
  console.log(response);
  return response // parses JSON response into native JavaScript objects

}

function Cell() {
  const api = useExtensionApi();
  const [data, setData] = useState(api.data.cellData.current.initialValue || {});
  const {
    setCellValue,
    updateReference,
  } = useContainer<'Admin::Report::Render'>();

  api.data.cellData.current.subscribe((newData) => {
    setData(newData);
  });

  api.data.toolbar.current.subscribe(async() => {
    try{
      const token = await api.sessionToken.getSessionToken();
      const response = await fetchQuery(data.cellValue, data.shopDomain, token);
      const body = response.body;
    }catch(e){
      console.log(e)
    }

    updateReference({a: 1, b: 2});
  });
/*
query {
  products(first: 10, reverse: true) {
    edges {
      node {
        id
        title
        handle
      }
    }
  }
}
*/
  return (
    <>
      <CardSection title="GraphQL Query">
      <TextField
          value={data.cellValue}
          type="text"
          multiline={3}
          onChange={(value) => setCellValue(value)}
          clearButton
          onClearButtonPress={() => setCellValue('')}
        />
      </CardSection>
      <CardSection title="Query Result">
        <Text>{data.cellValue}</Text>
      </CardSection>
    </>
  );
}
function Button() {
  const {extensionPoint} = useExtensionApi();
  return (
    <Text>
    {`Graphql Query App`}
    </Text>
  );
}
