
# Test Event Topic pluging

This plugin allows to request [webhook](https://shopify.dev/apps/webhooks) samples on demand.

It requires several parameters:

* **Topic**: The event topic for which you want to request a payload (for example: orders/create).
* **API version**: The API version corresponding to the event topic.
* **Shared Secret**: Secret used to build the HMAC header required to validate the event origin.
* **Destination URL**: Where we want the event notification to be delivered to (it can be a Google PubSub,
Amazon EventBridge or HTTPS url)
* **Port**: Only required for the **HTTP** delivery method when sending to localhost.
* **Url Path**: Only required for the **HTTP** delivery method when sending to localhost.
* **Delivery Method**: One of **console**, **HTTP**, **Google PubSub** or **Amazon EventBridge**.

If we are testing the localhost delivery method using a Shopify App created according to our
[dev docs](https://shopify.dev/apps/getting-started/create), we will need to use the secret set in
[Partners](https://www.shopify.com/partners) for the app in order to pass the webhook validation.

When no command line parameters are passed, the CLI will prompt for the parameter values.

All these parameters (except for Shared Secret, for security reasons) can be passed as CLI flags:

```
yarn shopify test-event-topic --help

USAGE
  $ shopify test-event-topic [-h] [-t <value>] [-v <value>] [-m console|http|google-pub-sub|event-bridge] [-a <value>] [--port <value>] [--url-path <value>]

FLAGS
  -a, --address=<value>           Destination url (only for http, google-pub-sub or event-bridge delivery methods).
  -h, --help                      CLI test-event-topic help:
                                  The command will prompt for any values not passed as command-line arguments.
                                  For security reasons Shared Secret is not allowed via flags.
                                  SHOPIFY_FLAG_SHARED_SECRET env variable can be used to avoid interactive prompt.
  -m, --delivery-method=<option>  Method chosen to deliver the topic payload.
                                  <options: console|http|google-pub-sub|event-bridge>
  -t, --topic=<value>             Requested event topic.
  -v, --api-version=<value>       Event topic API Version.
  --port=<value>                  Destination port (only for http delivery method when address is localhost).
  --url-path=<value>              Endpoint path (only for http delivery method when address is localhost).

DESCRIPTION
  Trigger sample event topic payload to be sent to a designated address.
```
