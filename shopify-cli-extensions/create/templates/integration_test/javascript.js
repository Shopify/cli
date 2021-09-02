import { extend, Text } from "@shopify/checkout-ui-extensions";
import CountryGraphql from "./Country.graphql";

extend("Checkout::Feature::Render", (root, { extensionPoint }) => {
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
  root.appendChild(
    root.createComponent(Button, { onPress: fetchCountryInfo }, "Test Graphql")
  );
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
