{{ if .React }}
import React, { useCallback } from "react";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import CountryGraphql from "./Country.graphql";
{{ if eq .Development.Renderer.Name "@shopify/admin-ui-extensions" }}
import {
  render,
  extend,
  Text,
  Button,
} from "{{ .Development.Renderer.Name }}-react";

extend("Playground", render(App));
{{ else }}
import {
  render,
  Text,
  Button,
} from "{{ .Development.Renderer.Name }}-react";
render("Playground", App);
{{ end }}

const client = new ApolloClient({
  cache: new InMemoryCache(),
  uri: "https://countries.trevorblades.com",
});

function App({ extensionPoint }) {
  const fetchCountryInfo = useCallback(() => {
    client
      .query(CountryGraphql)
      .then((json) => console.log(json))
      .catch((e) => console.log("exception logged: ", e.toString()));
  }, []);

  return (
    <React.Fragment>
      <Text>Welcome to the {extensionPoint} extension!</Text>
      <Text>
        My custom environment variable is: {process.env.CUSTOM_VAR}
      </Text>
      <Text>My custom NODE_ENV is: {process.env.NODE_ENV}</Text>
      {{ if eq .Development.Renderer.Name "@shopify/admin-ui-extensions" }}
      <Button title="Test Graphql" onPress={fetchCountryInfo} />
      {{ else }}
      <Button onPress={fetchCountryInfo}>Test Graphql</Button>
      {{ end }}
    </React.Fragment>
  );
}
{{ else }}
import {
  render,
  Text,
  Button,
} from "{{ .Development.Renderer.Name }}";
import CountryGraphql from "./Country.graphql";

extend("Playground", (root, { extensionPoint }) => {
  root.appendChild(
    root.createComponent(
      Text,
      {},
      `Welcome to the ${extensionPoint} extension!`
    )
  );
  root.appendChild(
    root.createComponent(
      Text,
      {},
      `My custom environment variable is: ${process.env.CUSTOM_VAR}`
    )
  );
  root.appendChild(
    root.createComponent(
      Text,
      {},
      `My custom NODE_ENV is: ${process.env.NODE_ENV}`
    )
  );
  {{ if eq .Development.Renderer.Name "@shopify/admin-ui-extensions" }}
  const button = root.createComponent(Button, { onPress: fetchCountryInfo, title: "Test Graphql" });
  {{ else }}
  const button = root.createComponent(Button, { onPress: fetchCountryInfo},"Test Graphql");
  {{ end }}
  root.appendChild(button);
});

function fetchCountryInfo() {
  fetch("https://www.learnwithjason.dev/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: CountryGraphql,
    }),
  })
    .then((json) => console.log(json))
    .catch((e) => console.log("exception logged: ", e.toString()));
}
{{ end }}