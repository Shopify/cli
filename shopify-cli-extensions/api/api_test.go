package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/gorilla/websocket"
	"github.com/iancoleman/strcase"
)

var (
	config *core.Config
)

var apiRoot = "/extensions/"
var secureHost = "123.ngrok-url"
var localhost = "localhost:8000"

func init() {
	configFile, err := os.Open("testdata/extension.config.yml")
	if err != nil {
		panic(fmt.Errorf("unable to open file: %w", err))
	}
	defer configFile.Close()

	config, err = core.LoadConfig(configFile)
	if err != nil {
		panic(fmt.Errorf("unable to load config: %w", err))
	}

	if len(config.Extensions) < 1 {
		panic("tests won't run without extensions")
	}
}

func TestGetExtensions(t *testing.T) {
	api := New(config, apiRoot)
	response := extensionsResponse{}

	getJSONResponse(api, t, secureHost, "/extensions/", &response)

	if response.App == nil || response.App["apiKey"] != "app_api_key" {
		t.Errorf("Expected app to have apiKey \"app_api_key\" but got %v", response.App)
	}

	if len(response.Extensions) != 3 {
		t.Errorf("Expected 3 extension got %d", len(response.Extensions))
	}

	if response.Version != "3" {
		t.Errorf("expect service version to be 3 but got %s", response.Version)
	}

	rootUrl := fmt.Sprintf("https://%s%s", secureHost, api.apiRoot)
	if response.Root.Url != rootUrl {
		t.Errorf("expect service root url to be %s but got %s", rootUrl, response.Root.Url)
	}

	socketUrl := fmt.Sprintf("wss://%s%s", secureHost, api.apiRoot)
	if response.Socket.Url != socketUrl {
		t.Errorf("expect service socket url to be %s but got %s", socketUrl, response.Socket.Url)
	}

	if response.Store != "test-shop.myshopify.com" {
		t.Errorf("expect service store to be test-shop.myshopify.com but got %s", response.Store)
	}

	extension := response.Extensions[0]

	if extension.Assets == nil {
		t.Error("expect assets to not be null")
	}

	if extension.Assets["main"].Name != "main" {
		t.Errorf("expect an asset with the name main, got %s", extension.Assets["main"].Name)
	}

	if extension.Assets["main"].Url != "https://123.ngrok-url/extensions/00000000-0000-0000-0000-000000000000/assets/main.js" {
		t.Errorf("expect a main asset url, got %s", extension.Assets["main"].Url)
	}

	if extension.Development.Root.Url != "https://123.ngrok-url/extensions/00000000-0000-0000-0000-000000000000" {
		t.Errorf("expect an extension root url, got %s", extension.Development.Root.Url)
	}

	metafields := core.Metafield{Namespace: "my-namespace", Key: "my-key"}

	if extension.Metafields[0] != metafields {
		t.Errorf("expected metafields to be %v but got %v", metafields, extension.Metafields[0])
	}

	if api.Extensions[0].Development.Root.Url != "" || api.Extensions[0].Assets["main"].Url != "" {
		t.Error("expect extension API data urls to not to be mutated")
	}

	if extension.Localization != nil {
		t.Error("expect localization to be nil without defined locales")
	}
}

func TestGetSingleExtension(t *testing.T) {
	host := secureHost
	api := New(config, apiRoot)
	response := singleExtensionResponse{}

	getJSONResponse(api, t, secureHost, "/extensions/00000000-0000-0000-0000-000000000000", &response)

	if response.App == nil || response.App["apiKey"] != "app_api_key" {
		t.Errorf("Expected app to have apiKey \"app_api_key\" but got %v", response.App)
	}

	if response.Version != "3" {
		t.Errorf("expect service version to be 3 but got %s", response.Version)
	}

	rootUrl := fmt.Sprintf("https://%s%s", host, api.apiRoot)
	if response.Root.Url != rootUrl {
		t.Errorf("expect service root url to be %s but got %s", rootUrl, response.Root.Url)
	}

	socketUrl := fmt.Sprintf("wss://%s%s", host, api.apiRoot)
	if response.Socket.Url != socketUrl {
		t.Errorf("expect service socket url to be %s but got %s", socketUrl, response.Socket.Url)
	}

	if response.App == nil {
		t.Error("Expected app to not be null")
	}

	if response.Store != "test-shop.myshopify.com" {
		t.Errorf("expect service store to be test-shop.myshopify.com but got %s", response.Store)
	}

	extension := response.Extension

	if extension.Assets == nil {
		t.Error("expect assets to not be null")
	}

	if extension.Assets["main"].Name != "main" {
		t.Errorf("expect an asset with the name main, got %s", extension.Assets["main"].Name)
	}

	if extension.Assets["main"].Url != fmt.Sprintf("https://%s/extensions/%s/assets/main.js", host, extension.UUID) {
		t.Errorf("expect a main asset url, got %s", extension.Assets["main"].Url)
	}

	if extension.Development.Root.Url != fmt.Sprintf("https://%s/extensions/%s", host, extension.UUID) {
		t.Errorf("expect an extension root url, got %s", extension.Development.Root.Url)
	}

	if extension.Metafields == nil {
		t.Errorf("expected metafields to be an an array")
	}

	metafields := core.Metafield{Namespace: "my-namespace", Key: "my-key"}

	if extension.Metafields[0] != metafields {
		t.Errorf("expected metafields to be %v but got %v", metafields, extension.Metafields[0])
	}

	if api.Extensions[0].Development.Root.Url != "" || api.Extensions[0].Assets["main"].Url != "" {
		t.Error("expect extension API data urls to not to be mutated")
	}

	if extension.Localization != nil {
		t.Error("expect localization to be nil without defined locales")
	}
}

func TestServeAssets(t *testing.T) {
	api := New(config, apiRoot)
	response := getHTMLRequest(api, t, localhost, "/extensions/00000000-0000-0000-0000-000000000000/assets/main.js")

	if response.Result().StatusCode != http.StatusOK {
		t.Error("expected status code ok received")
	}

	cachePolicy := response.Result().Header["Cache-Control"]
	if len(cachePolicy) == 0 {
		t.Error("expected server to specify a cache policy")
	} else if cachePolicy[0] != "no-cache" {
		t.Errorf("expected cache policy to be no-cache not %s", cachePolicy[0])
	}

	if response.Body.String() != "console.log(\"Hello World!\");\n" {
		t.Error("Unexpected body")
	}
}

func TestCheckoutTunnelError(t *testing.T) {
	host := "localhost:8000"
	api := New(config, apiRoot)
	response := getHTMLResponse(api, t, host, "/extensions/00000000-0000-0000-0000-000000000000")

	message := "Make sure you have a secure URL for your local development server by running <code>shopify extension tunnel start --port=8000</code> and then visit the url https://TUNNEL_URL/extensions/00000000-0000-0000-0000-000000000000</code>, where <code>TUNNEL_URL</code> is replaced with your own ngrok URL."

	t.Logf("response: %s", response)

	if !strings.Contains(response, message) {
		t.Errorf("expected message to contain %s", message)
	}
}

func TestAdminTunnelError(t *testing.T) {
	host := "localhost:8000"
	api := New(config, apiRoot)
	response := getHTMLResponse(api, t, host, "/extensions/00000000-0000-0000-0000-000000000001")

	instructions := "Make sure you have a secure URL for your local development server by running <code>shopify extension tunnel start --port=8000</code> and then visit the url https://TUNNEL_URL/extensions/00000000-0000-0000-0000-000000000001</code>, where <code>TUNNEL_URL</code> is replaced with your own ngrok URL."

	t.Logf("response: %s", response)

	if !strings.Contains(response, instructions) {
		t.Errorf("expected instructions to contain %s", instructions)
	}
}

func TestPostPurchaseTunnelError(t *testing.T) {
	host := "localhost:8000"
	api := New(config, apiRoot)
	response := getHTMLResponse(api, t, host, "/extensions/00000000-0000-0000-0000-000000000002")

	instructions := "Make sure you have a secure URL for your local development server by running <code>shopify extension tunnel start --port=8000</code>, create a checkout, and append <code>?dev=https://TUNNEL_URL/extensions/</code> to the URL, where <code>TUNNEL_URL</code> is replaced with your own ngrok URL"

	t.Logf("response: %s", response)

	if !strings.Contains(response, instructions) {
		t.Errorf("expected instructions to contain %s", instructions)
	}
}

func TestCheckoutRedirect(t *testing.T) {
	api := New(config, apiRoot)
	rec := getHTMLRequest(api, t, secureHost, "/extensions/00000000-0000-0000-0000-000000000000")

	if rec.Code != http.StatusTemporaryRedirect {
		t.Errorf("expected redirect status – received: %d", rec.Code)
	}

	redirectUrl, err := rec.Result().Location()

	expectedUrl := "https://test-shop.myshopify.com/cart/1234?dev=https://123.ngrok-url/extensions/"

	if err != nil || redirectUrl.String() != expectedUrl {
		t.Errorf("Expected redirect url to be %s but received: %s", expectedUrl, redirectUrl.String())
	}
}

func TestAdminRedirect(t *testing.T) {
	api := New(config, apiRoot)
	rec := getHTMLRequest(api, t, secureHost, "/extensions/00000000-0000-0000-0000-000000000001")

	if rec.Code != http.StatusTemporaryRedirect {
		t.Errorf("Expected redirect status – received: %d", rec.Code)
	}

	redirectUrl, err := rec.Result().Location()
	expectedUrl := "https://test-shop.myshopify.com/admin/extensions-dev?url=https://123.ngrok-url/extensions/00000000-0000-0000-0000-000000000001"

	if err != nil || redirectUrl.String() != expectedUrl {
		t.Errorf("Expected redirect url to be %s but received: %s", expectedUrl, redirectUrl.String())
	}
}

func TestPostPurchaseIndex(t *testing.T) {
	api := New(config, apiRoot)
	response := getHTMLResponse(api, t, secureHost, "/extensions/00000000-0000-0000-0000-000000000002")

	contents := [...]string{
		"This page is served by your local UI Extension development server. Instead of visiting this page directly, you will need to connect your local development environment to a real checkout environment.",
		"If this is the first time you're testing a Post Purchase extension, please install the browser extension from <a href=\"https://github.com/Shopify/post-purchase-devtools/releases\">https://github.com/Shopify/post-purchase-devtools/releases</a>.",
		"Once installed, simply enter your extension URL <a href=\"https://example.ngrok.io/extensions/00000000-0000-0000-0000-000000000002\">https://example.ngrok.io/extensions/00000000-0000-0000-0000-000000000002</a>.",
	}

	t.Logf("response: %s", response)

	if !strings.Contains(response, contents[0]) {
		t.Errorf(`expected instructions to contain "%s"`, contents[0])
	}
	if !strings.Contains(response, contents[1]) {
		t.Errorf(`expected instructions to contain "%s"`, contents[1])
	}
	if !strings.Contains(response, contents[2]) {
		t.Errorf(`expected instructions to contain "%s"`, contents[2])
	}
}

func TestWebsocketNotify(t *testing.T) {
	api := New(config, apiRoot)
	server := httptest.NewServer(api)

	firstConnection, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	secondConnection, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	// First message received is the connected message which can be ignored
	firstConnection.ReadJSON(&websocketMessage{})
	secondConnection.ReadJSON(&websocketMessage{})

	expectedExtensions := []core.Extension{
		getExpectedExtensionWithUrls(api.Extensions[0], server.URL),
		getExpectedExtensionWithUrls(api.Extensions[1], server.URL),
		getExpectedExtensionWithUrls(api.Extensions[2], server.URL),
	}

	api.Notify(api.Extensions)

	if err := verifyWebsocketMessage(firstConnection, "update", api.Version, api.App, expectedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	if err = verifyWebsocketMessage(secondConnection, "update", api.Version, api.App, expectedExtensions, api.Store); err != nil {
		t.Error(err)
	}
}

func TestWebsocketNotifyBuildStatusWithLastUpdatedValue(t *testing.T) {
	api := New(config, apiRoot)
	server := httptest.NewServer(api)

	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	// First message received is the connected message which can be ignored
	ws.ReadJSON(&websocketMessage{})

	updatedExtensions := []core.Extension{api.Extensions[0]}
	updatedExtensions[0].Development.Status = "success"

	api.Notify(updatedExtensions)

	first_success, err := getExtensionsFromMessage(ws)

	if err != nil {
		t.Error(err)
	}

	if first_success[0].Development.Status != "success" {
		t.Errorf("expecting extensions Development.Status to be success but received %v", first_success[0].Development.Status)
	}

	if first_success[0].Assets["main"].LastUpdated <= 0 {
		t.Errorf("expecting extension Assets[\"main\"].LastUpdated to contain timestamp but received %v", first_success[0].Assets["main"].LastUpdated)
	}

	duration := 1 * time.Second

	<-time.After(duration)

	api.Notify(updatedExtensions)

	second_success, err := getExtensionsFromMessage(ws)

	if err != nil {
		t.Error(err)
	}

	if second_success[0].Development.Status != "success" {
		t.Errorf("expecting extension Development.Status to be success but received %v", second_success[0].Development.Status)
	}

	if second_success[0].Assets["main"].LastUpdated <= 0 {
		t.Errorf("expecting extension Assets[\"main\"].LastUpdated to contain timestamp but received %v", second_success[0].Assets["main"].LastUpdated)
	}

	if second_success[0].Assets["main"].LastUpdated == first_success[0].Assets["main"].LastUpdated {
		t.Logf("previous extension Assets[\"main\"].LastUpdated %d", first_success[0].Assets["main"].LastUpdated)
		t.Errorf("expecting extension Assets[\"main\"].LastUpdated to be updated with a new timestamp but received %v", second_success[0].Assets["main"].LastUpdated)
	}

	<-time.After(duration)

	updatedExtensions[0].Development.Status = "error"

	api.Notify(updatedExtensions)

	third_error, err := getExtensionsFromMessage(ws)

	if err != nil {
		t.Error(err)
	}

	if third_error[0].Development.Status != "error" {
		t.Errorf("expecting extension Development.Status to be error but received %v", third_error[0].Development.Status)
	}

	if third_error[0].Assets["main"].Url != second_success[0].Assets["main"].Url {
		t.Logf("previous extension Assets[\"main\"].Url %s", second_success[0].Assets["main"].Url)
		t.Errorf("expecting extension Assets[\"main\"].Url to be unchanged from previous if the asset failed to build but received %v", third_error[0].Assets["main"].Url)
	}

}

func TestWebsocketConnectionStartAndShutdown(t *testing.T) {
	api := New(config, apiRoot)
	server := httptest.NewServer(api)
	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	expectedExtensions := []core.Extension{
		getExpectedExtensionWithUrls(api.Extensions[0], server.URL),
		getExpectedExtensionWithUrls(api.Extensions[1], server.URL),
		getExpectedExtensionWithUrls(api.Extensions[2], server.URL),
	}

	if err := verifyWebsocketMessage(ws, "connected", api.Version, api.App, expectedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	ws.SetCloseHandler(func(code int, text string) error {
		ws.Close()
		return nil
	})

	api.Shutdown()

	if err := verifyConnectionShutdown(api, ws); err != nil {
		t.Error(err)
	}
}

func TestWebsocketConnectionClientClose(t *testing.T) {
	api := New(config, apiRoot)
	server := httptest.NewServer(api)
	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	expectedExtensions := []core.Extension{
		getExpectedExtensionWithUrls(api.Extensions[0], server.URL),
		getExpectedExtensionWithUrls(api.Extensions[1], server.URL),
		getExpectedExtensionWithUrls(api.Extensions[2], server.URL),
	}

	if err := verifyWebsocketMessage(ws, "connected", api.Version, api.App, expectedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1000, "client close connection"))

	if err := verifyConnectionShutdown(api, ws); err != nil {
		t.Error(err)
	}
}

func TestWebsocketClientUpdateAppEvent(t *testing.T) {
	api := New(config, apiRoot)
	server := httptest.NewServer(api)

	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	// First message received is the connected message which can be ignored
	ws.ReadJSON(&websocketMessage{})

	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	ws.SetWriteDeadline(deadline)
	data := []byte(`{"app": {"apiKey": "app_api_key", "title":  "my app"}}`)
	ws.WriteJSON(websocketClientMessage{Event: "update", Data: data})

	<-time.After(duration)

	if err := verifyWebsocketMessage(ws, "update", api.Version, api.App, []core.Extension{}, api.Store); err != nil {
		t.Error(err)
	}

	response := extensionsResponse{}
	getJSONResponse(api, t, server.URL, "/extensions/", &response)

	if response.App == nil {
		t.Error("Expected app to not be null")
	}

	if response.App["apiKey"] != "app_api_key" {
		t.Errorf("expected App[\"apiKey\"] to be `\"app_api_key\"` but got %v", response.App["apiKey"])
	}

	if response.App["title"] != "my app" {
		t.Errorf("expected App[\"title\"] to be updated to `\"my app\"` but got %v", response.App["title"])
	}

	if api.App["title"] != "my app" {
		t.Errorf("expected API app title to to be updated to `\"my app\"` but got %v", api.App["title"])
	}
}

func TestWebsocketClientUpdateMatchingExtensionsEvent(t *testing.T) {
	api := New(config, apiRoot)
	server := httptest.NewServer(api)

	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	// First message received is the connected message which can be ignored
	ws.ReadJSON(&websocketMessage{})

	updatedExtensions := []core.Extension{getExpectedExtensionWithUrls(api.Extensions[0], server.URL)}
	updatedExtensions[0].Development.Hidden = true
	updatedExtensions[0].Development.Status = "error"

	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	ws.SetWriteDeadline(deadline)
	data := []byte(`{"extensions": [
		{"uuid": "00000000-0000-0000-0000-000000000000", "development": {"status": "error", "hidden": true}},
		{"uuid": "NON_MATCHING_UUID", "development": {"status": "error", "hidden": true}}
	]}`)
	ws.WriteJSON(websocketClientMessage{Event: "update", Data: data})

	<-time.After(duration)

	if err := verifyWebsocketMessage(ws, "update", api.Version, api.App, updatedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	apiUpdatedExtension := api.Extensions[0]
	updated := singleExtensionResponse{}
	getJSONResponse(api, t, server.URL, "/extensions/00000000-0000-0000-0000-000000000000", &updated)

	if updated.Extension.Development.Hidden != true {
		t.Errorf("expected response for extension 00000000-0000-0000-0000-000000000000 Development.Hidden to be true but got %v", updated.Extension.Development.Hidden)
	}

	if updated.Extension.Development.Status != "error" {
		t.Errorf("expected response for extension 00000000-0000-0000-0000-000000000000 Development.Status to be \"error\" but got %v", updated.Extension.Development.Status)
	}

	if apiUpdatedExtension.Development.Hidden != true {
		t.Errorf("expected API extension 00000000-0000-0000-0000-000000000000 Development.Hidden to be true  but got %v", apiUpdatedExtension.Development.Hidden)
	}

	if apiUpdatedExtension.Development.Status != "error" {
		t.Errorf("expected API extension 00000000-0000-0000-0000-000000000000 Development.Status to be \"error\" but got %v", apiUpdatedExtension.Development.Status)
	}

	apiUnchangedExtension := api.Extensions[1]
	unchanged := singleExtensionResponse{}
	getJSONResponse(api, t, server.URL, "/extensions/00000000-0000-0000-0000-000000000001", &unchanged)

	if unchanged.Extension.Development.Hidden != false {
		t.Errorf("expected response for extension 00000000-0000-0000-0000-000000000001 Development.Hidden to be unchanged but got %v", unchanged.Extension.Development.Hidden)
	}

	if unchanged.Extension.Development.Status != "" {
		t.Errorf("expected response for extension 00000000-0000-0000-0000-000000000001 Development.Status to be unchanged but got %v", unchanged.Extension.Development.Status)
	}

	if apiUnchangedExtension.Development.Hidden != false {
		t.Errorf("expected API extension 00000000-0000-0000-0000-000000000001 Development.Hidden to be unchanged but got %v", apiUpdatedExtension.Development.Hidden)
	}

	if apiUnchangedExtension.Development.Status != "" {
		t.Errorf("expected API extension 00000000-0000-0000-0000-000000000001 Development.Status to be unchanged but got %v", apiUpdatedExtension.Development.Status)
	}
}

func TestWebsocketClientUpdateBooleanValue(t *testing.T) {
	api := New(config, apiRoot)
	api.Extensions[0].Development.Hidden = true

	server := httptest.NewServer(api)

	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	// First message received is the connected message which can be ignored
	ws.ReadJSON(&websocketMessage{})

	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	ws.SetWriteDeadline(deadline)
	data := []byte(`{
		"extensions": [
		  {
			"uuid": "00000000-0000-0000-0000-000000000000",
			"development": {"hidden": false}
		  }
		]
	  }`)
	err = ws.WriteJSON(websocketClientMessage{Event: "update", Data: data})

	if err != nil {
		t.Error(err)
	}

	<-time.After(duration)

	updatedExtensions := []core.Extension{getExpectedExtensionWithUrls(api.Extensions[0], server.URL)}
	updatedExtensions[0].Development.Hidden = false

	if err := verifyWebsocketMessage(ws, "update", api.Version, api.App, updatedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	apiUpdatedExtension := api.Extensions[0]
	updated := singleExtensionResponse{}
	getJSONResponse(api, t, server.URL, "/extensions/00000000-0000-0000-0000-000000000000", &updated)

	if updated.Extension.Development.Hidden != false {
		t.Errorf("expected response for extension 00000000-0000-0000-0000-000000000000 Development.Hidden to be false but got %v", updated.Extension.Development.Hidden)
	}
	if apiUpdatedExtension.Development.Hidden != false {
		t.Errorf("expected API extension 00000000-0000-0000-0000-000000000000 Development.Hidden to be false but got %v", apiUpdatedExtension.Development.Hidden)
	}
}

func TestWebsocketClientDispatchEventWithoutMutatingData(t *testing.T) {
	api := New(config, apiRoot)
	server := httptest.NewServer(api)

	initialResponse := extensionsResponse{}
	getJSONResponse(api, t, server.URL, "/extensions/", &initialResponse)

	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	// First message received is the connected message which can be ignored
	ws.ReadJSON(&websocketMessage{})

	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	ws.SetWriteDeadline(deadline)

	data := []byte(`{
		"type": "focus",
		"customData": "foo",
		"app": {
		  "apiKey": "app_api_key",
		  "customData": "bar"
		},
		"extensions": [
		  {
			"uuid": "00000000-0000-0000-0000-000000000000",
			"customData": "baz",
			"development": {"status": "success"},
			"metafields": [{"namespace": "another-namespace", "key": "another-key"}]
		  }
		]
	  }`)
	err = ws.WriteJSON(websocketClientMessage{Event: "dispatch", Data: data})

	if err != nil {
		t.Error(err)
	}
	<-time.After(duration)

	message := websocketMessage{}
	if err := ws.ReadJSON(&message); err != nil {
		t.Errorf("failed to read message with error: %v", err)
	}

	if message.Version != api.Version {
		t.Errorf("expecting version to be %v but got: %v", api.Version, message.Version)
	}

	if message.Event != "dispatch" {
		t.Errorf("expecting to receive event \"dispatch\" but got: %v", message.Event)
	}

	if message.Data["type"] != "focus" {
		t.Errorf("expecting to receive data `type: \"focus\"` but got: %v", message.Data["type"])
	}

	if message.Data["customData"] != "foo" {
		t.Errorf("expecting to receive data `customData: \"foo\"` but got: %v", message.Data["customData"])
	}

	expectedApp := `{
		"apiKey": "app_api_key",
		"customData": "bar"
	  }`
	app, err := json.Marshal(message.Data["app"])

	if err != nil {
		t.Errorf("converting app in message to JSON failed with error: %v", err)
	}

	matchApp, err := isEqualJSON(expectedApp, string(app))
	if err != nil {
		t.Error(err)
	}
	if !matchApp {
		t.Errorf("unexpected app in message, received %v, expected %v", string(app), expectedApp)
	}

	extensions, err := json.Marshal(message.Data["extensions"])

	if err != nil {
		t.Errorf("converting extensions in message to JSON failed with error: %v", err)
	}
	expectedExtensions := fmt.Sprintf(`[
		{
			"customData": "baz",
			"assets": {
			"main": {
				"name": "main",
				"url": "%v/extensions/00000000-0000-0000-0000-000000000000/assets/main.js",
				"lastUpdated": 0
			}
			},
			"development": {
			"hidden": false,
			"resource": {"url": ""},
			"root": {"url": "%v/extensions/00000000-0000-0000-0000-000000000000"},
			"localizationStatus": "",
			"status": "success",
			"resource": {"url": "cart/1234"}
			},
			"type": "checkout_ui_extension",
			"metafields": [{"namespace": "another-namespace", "key": "another-key"}],
			"uuid": "00000000-0000-0000-0000-000000000000",
			"version": "",
			"extensionPoints": null,
			"localization": null,
			"surface": "checkout",
			"node_executable": "",
			"capabilities": {
				"networkAccess": false
			}
		}
		]`, server.URL, server.URL)

	match, err := isEqualJSON(expectedExtensions, string(extensions))
	if err != nil {
		t.Error(err)
	}
	if !match {
		t.Errorf("unexpected extensions in message, received %v, expected %v", string(extensions), expectedExtensions)
	}

	response := extensionsResponse{}
	getJSONResponse(api, t, server.URL, "/extensions/", &response)

	if !reflect.DeepEqual(response, initialResponse) {
		t.Error("Expected api data not to be mutated but it was modified")
	}
}

// https://gist.github.com/turtlemonvh/e4f7404e28387fadb8ad275a99596f67
func isEqualJSON(s1, s2 string) (bool, error) {
	var o1 interface{}
	var o2 interface{}

	var err error
	err = json.Unmarshal([]byte(s1), &o1)
	if err != nil {
		return false, fmt.Errorf("Error mashalling string 1 :: %s", err.Error())
	}
	err = json.Unmarshal([]byte(s2), &o2)
	if err != nil {
		return false, fmt.Errorf("Error mashalling string 2 :: %s", err.Error())
	}

	return reflect.DeepEqual(o1, o2), nil
}

func verifyWebsocketMessage(
	ws *websocket.Conn, event string,
	version string,
	expectedApp core.App,
	expectedExtensions interface{},
	expectedStore string,
) error {
	message := websocketMessage{}
	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	ws.SetReadDeadline(deadline)
	if err := ws.ReadJSON(&message); err != nil {
		return fmt.Errorf("failed to read message with error: %v", err)
	}

	if message.Version != version {
		return fmt.Errorf("expecting version to be %v but got: %v", version, message.Version)
	}

	if message.Event != event {
		return fmt.Errorf("expecting to receive event %v but got: %v", message.Event, event)
	}

	if message.Data["store"] != "test-shop.myshopify.com" {
		return fmt.Errorf("expect service store to be test-shop.myshopify.com but got %s", message.Data["store"])
	}

	expectedAppResult, err := json.Marshal(formatData(expectedApp, strcase.ToLowerCamel))
	if err != nil {
		return err
	}
	app, err := json.Marshal(message.Data["app"])

	if err != nil {
		return fmt.Errorf("converting app in message to JSON failed with error: %v", err)
	}

	match, err := isEqualJSON(string(expectedAppResult), string(app))
	if err != nil {
		return err
	}
	if !match {
		return fmt.Errorf("unexpected app in message, received %v, expected %v", string(app), string(expectedAppResult))
	}

	extensions, err := json.Marshal(message.Data["extensions"])

	if err != nil {
		return fmt.Errorf("converting extensions in message to JSON failed with error: %v", err)
	}

	expectedResult, err := json.Marshal(expectedExtensions)
	if err != nil {
		return fmt.Errorf("converting extensions in message to JSON failed with error: %v", err)
	}

	match, err = isEqualJSON(string(expectedResult), string(extensions))

	if err != nil {
		return fmt.Errorf("converting extensions in expected message to JSON failed with error: %v", err)
	}

	if !match {
		return fmt.Errorf("unexpected extensions in message, received %v, expected %v", string(extensions), string(expectedResult))
	}

	return nil
}

func verifyConnectionShutdown(api *ExtensionsApi, ws *websocket.Conn) error {
	// TODO: Break out of this 1 second wait if the client responds correctly to the close message
	// Currently the test will fail without the wait since the channel and connection is still open
	<-time.After(time.Second * 1)

	api.Notify([]core.Extension{})

	// Need to reset the deadline otherwise reading the message will fail
	// with a timeout error instead of the expected websocket closed message
	ws.SetReadDeadline(time.Time{})
	_, message, err := ws.ReadMessage()
	if !websocket.IsCloseError(err, websocket.CloseNormalClosure) {
		notification := notification{}
		json.Unmarshal(message, &notification)
		return fmt.Errorf("Expected connection to be terminated but the read error returned: %v and the connection received the notification: %v", err, notification)
	}
	return nil
}

func createWebsocket(server *httptest.Server) (*websocket.Conn, error) {
	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/extensions/"
	connection, _, err := websocket.DefaultDialer.Dial(url, nil)
	return connection, err
}

func getJSONResponse(api *ExtensionsApi, t *testing.T, host, requestUri string, response interface{}) interface{} {
	req, err := http.NewRequest("GET", requestUri, nil)
	req.Host = host
	req.RequestURI = requestUri

	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected ok status – received: %d", rec.Code)
	}

	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Logf("%+v\n", rec.Body.String())
		t.Fatal(err)
	}

	t.Logf("%+v\n", response)
	return response
}

func getHTMLRequest(api *ExtensionsApi, t *testing.T, host, requestUri string) *httptest.ResponseRecorder {
	req, err := http.NewRequest("GET", requestUri, nil)
	req.Header.Add("accept", "text/html")
	req.Host = host
	req.RequestURI = requestUri

	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api.ServeHTTP(rec, req)
	return rec
}

func getHTMLResponse(api *ExtensionsApi, t *testing.T, host, requestUri string) string {
	rec := getHTMLRequest(api, t, host, requestUri)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected ok status – received: %d", rec.Code)
		t.Log(rec.Body)
	}

	return rec.Body.String()
}

func getExpectedExtensionWithUrls(extension core.Extension, host string) core.Extension {
	extension.Development.Root.Url = fmt.Sprintf("%s/extensions/%s", host, extension.UUID)
	extension.Assets["main"] = core.Asset{Name: "main", Url: fmt.Sprintf("%s/extensions/%s/assets/main.js", host, extension.UUID)}
	return extension
}

func getExtensionsFromMessage(ws *websocket.Conn) (extensions []core.Extension, errorMessage error) {
	message := websocketMessage{}
	if err := ws.ReadJSON(&message); err != nil {
		errorMessage = fmt.Errorf("failed to read message with error: %v", err)
		return
	}

	extensionsData, err := json.Marshal(message.Data["extensions"])

	if err != nil {
		errorMessage = fmt.Errorf("converting extensions in message to JSON failed with error: %v", err)
		return
	}

	err = json.Unmarshal(extensionsData, &extensions)

	if err != nil {
		errorMessage = fmt.Errorf("converting extensions in message to JSON failed with error: %v", err)
		return
	}

	return
}
