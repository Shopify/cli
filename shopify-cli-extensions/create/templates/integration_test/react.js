import React, { useCallback } from "react";
import {
  render,
  TextBlock,
  Button,
} from "@shopify/checkout-ui-extensions-react";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import CountryGraphql from "./Country.graphql";

const client = new ApolloClient({
  cache: new InMemoryCache(),
  uri: "https://countries.trevorblades.com",
});

render("Checkout::Feature::Render", ({ extensionPoint }) => (
  <App extensionPoint={extensionPoint} />
));

function App({ extensionPoint }) {
  const fetchCountryInfo = useCallback(() => {
    client
      .query(CountryGraphql)
      .then((json) => console.log(json))
      .catch((e) => console.log("exception logged: ", e.toString()));
  }, []);

  return (
    <>
      <TextBlock>Welcome to the {extensionPoint} extension!</TextBlock>
      <TextBlock>
        My custom environment variable is: {process.env.CUSTOM_VAR}
      </TextBlock>
      <TextBlock>My custom NODE_ENV is: {process.env.NODE_ENV}</TextBlock>
      <Button onPress={fetchCountryInfo}>Test Graphql</Button>
    </>
  );
}
