import {
  render,
  TextField,
  TextBlock,
  BlockStack,
  Button,
} from "@shopify/checkout-ui-extensions-react";
import { ApolloClient, InMemoryCache, useQuery } from "@apollo/client";
import { useCallback } from "react";
import CountryGraphql from "./Country.graphql";

const client = new ApolloClient({
  cache: new InMemoryCache(),
  uri: "https://countries.trevorblades.com",
});

render("Checkout::Feature::Render", ({ extensionPoint }) => (
  <App extensionPoint={extensionPoint} />
));

function App({ extensionPoint }: { extensionPoint: string }) {
  const fetchCountryInfo = useCallback(() => {
    client
      .query(CountryGraphql)
      .then((json) => console.log(json))
      .catch((e) => console.log("exception logged: ", e.toString()));
  }, []);

  return (
    <BlockStack>
      <TextBlock>Welcome to the {extensionPoint} extension!</TextBlock>
      <TextBlock>
        My custom environment variable is: {process.env.SOME_VAR}
      </TextBlock>
      <TextBlock>My custom NODE_ENV is: {process.env.NODE_ENV}</TextBlock>
      <TextField
        label="Order note"
        onChange={(value) => {
          // eslint-disable-next-line no-console
          console.log(`Updated order note: ${value}`);
        }}
      />
      <Button onPress={fetchCountryInfo}>Test Graphql</Button>
    </BlockStack>
  );
}
