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
	"github.com/Shopify/shopify-cli-extensions/logging"
	"github.com/gorilla/websocket"
	"github.com/iancoleman/strcase"
)

var config *core.Config
var noPublicUrlConfig *core.Config

var apiRoot = "/extensions"

func init() {
	configFile, err := os.Open("testdata/extension.config.yml")
	if err != nil {
		panic(fmt.Errorf("unable to open file: %w", err))
	}
	defer configFile.Close()

	config, err = core.LoadConfig(configFile)

	noPublicUrlConfig = &core.Config{
		App:        config.App,
		Extensions: config.Extensions,
		Port:       config.Port,
		Store:      config.Store,
		PublicUrl:  "",
	}

	if err != nil {
		panic(fmt.Errorf("unable to load config: %w", err))
	}

	if len(config.Extensions) < 1 {
		panic("tests won't run without extensions")
	}
}

func TestInitializeWithProvidedConfigOptions(t *testing.T) {
	api := New(config, &logging.LogEntryBuilder{})

	if api.ApiRoot != apiRoot {
		t.Errorf("Expected api root to be %s but got %v", apiRoot, api.ApiRoot)
	}

	if api.App == nil || api.App["api_key"] != "app_api_key" {
		t.Errorf("Expected app to have apiKey \"app_api_key\" but got %v", api.App["api_key"])
	}

	if len(api.Extensions) != 3 {
		t.Errorf("Expected 3 extension got %d", len(api.Extensions))
	}

	if api.Version != "3" {
		t.Errorf("expect service version to be 4 but got %s", api.Version)
	}

	if api.Store != "test-shop.myshopify.com" {
		t.Errorf("expect service store to be test-shop.myshopify.com but got %s", api.Store)
	}

	extension := api.Extensions[0]

	if extension.Assets == nil {
		t.Error("expect assets to not be null")
	}

	if extension.Assets["main"].Name != "main" {
		t.Errorf("expect an asset with the name main, got %s", extension.Assets["main"].Name)
	}

	metafields := core.Metafield{Namespace: "my-namespace", Key: "my-key"}

	if extension.Metafields[0] != metafields {
		t.Errorf("expected metafields to be %v but got %v", metafields, extension.Metafields[0])
	}

	if extension.Localization != nil {
		t.Error("expect localization to be nil without defined locales")
	}
}

func TestGetExtensions(t *testing.T) {
	api := New(config, &logging.LogEntryBuilder{})

	response := extensionsResponse{}

	getAllExtensionsJSONResponse(api, t, &response)

	if response.App == nil {
		t.Error("Expected app to not be nil")
	}

	if response.App["apiKey"] != api.App["api_key"] {
		t.Errorf("Expected app to have apiKey \"%s\" but got %s", api.App["api_key"], response.App)
	}

	if len(response.Extensions) != len(api.Extensions) {
		t.Errorf("Expected %d extension got %d", len(api.Extensions), len(response.Extensions))
	}

	if response.Version != api.Version {
		t.Errorf("expect service version to be %s but got %s", api.Version, response.Version)
	}

	if response.Root.Url != api.ApiRootUrl {
		t.Errorf("expect service root url to be %s but got %s", api.ApiRootUrl, response.Root.Url)
	}

	socketUrl := fmt.Sprintf("wss%s", strings.TrimPrefix(api.ApiRootUrl, "https"))
	if response.Socket.Url != socketUrl {
		t.Errorf("expect service socket url to be %s but got %s", socketUrl, response.Socket.Url)
	}

	if response.Store != api.Store {
		t.Errorf("expect service store to be %s but got %s", api.Store, response.Store)
	}

	extension := response.Extensions[0]

	if extension.Assets == nil {
		t.Error("expect assets to not be null")
	}

	if extension.Assets["main"].Name != "main" {
		t.Errorf("expect an asset with the name main, got %s", extension.Assets["main"].Name)
	}

	if extension.Assets["main"].Url != fmt.Sprintf("%s/%s/assets/main.js", api.ApiRootUrl, api.Extensions[0].UUID) {
		t.Errorf("expect a main asset url, got %s", extension.Assets["main"].Url)
	}

	if extension.Development.Root.Url != fmt.Sprintf("%s/%s", api.ApiRootUrl, api.Extensions[0].UUID) {
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
	api := New(config, &logging.LogEntryBuilder{})
	response := singleExtensionResponse{}

	getSingleExtensionJSONResponse(api, t, api.Extensions[0].UUID, &response)

	if response.App == nil {
		t.Error("Expected app to not be nil")
	}

	if response.App["apiKey"] != api.App["api_key"] {
		t.Errorf("Expected app to have apiKey \"%s\" but got %v", api.App["api_key"], response.App)
	}

	if response.Version != api.Version {
		t.Errorf("expect service version to be %s but got %s", api.Version, response.Version)
	}

	if response.Root.Url != api.ApiRootUrl {
		t.Errorf("expect service root url to be %s but got %s", api.ApiRootUrl, response.Root.Url)
	}

	socketUrl := fmt.Sprintf("wss%s", strings.TrimPrefix(api.ApiRootUrl, "https"))
	if response.Socket.Url != socketUrl {
		t.Errorf("expect service socket url to be %s but got %s", socketUrl, response.Socket.Url)
	}

	devConsoleUrl := api.GetDevConsoleUrl()
	if response.DevConsole.Url != devConsoleUrl {
		t.Errorf("expect service dev console url to be %s but got %s", devConsoleUrl, response.DevConsole.Url)
	}

	if response.Store != api.Store {
		t.Errorf("expect service store to be %s but got %s", api.Store, response.Store)
	}

	extension := response.Extension

	if extension.Assets == nil {
		t.Error("expect assets to not be null")
	}

	if extension.Assets["main"].Name != "main" {
		t.Errorf("expect an asset with the name main, got %s", extension.Assets["main"].Name)
	}

	if extension.Assets["main"].Url != fmt.Sprintf("%s/%s/assets/main.js", api.ApiRootUrl, extension.UUID) {
		t.Errorf("expect a main asset url, got %s", extension.Assets["main"].Url)
	}

	if extension.Development.Root.Url != fmt.Sprintf("%s/%s", api.ApiRootUrl, extension.UUID) {
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
	api := New(config, &logging.LogEntryBuilder{})
	mainAssetUrl := fmt.Sprintf("%s/%s/assets/main.js", api.ApiRoot, api.Extensions[0].UUID)
	response := getHTMLRequest(api, t, mainAssetUrl)

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
	api := New(noPublicUrlConfig, &logging.LogEntryBuilder{})
	uuid := api.Extensions[0].UUID
	response := getSingleExtensionHTMLResponse(api, t, uuid)

	message := fmt.Sprintf("Make sure you have a secure URL for your local development server by running <code>shopify extension tunnel start --port=8000</code> and then visit the url https://TUNNEL_URL%s/%s</code>, where <code>TUNNEL_URL</code> is replaced with your own ngrok URL.", api.ApiRoot, uuid)

	t.Logf("response: %s", response)

	if !strings.Contains(response, message) {
		t.Errorf("expected message to contain %s", message)
	}
}

func TestAdminTunnelError(t *testing.T) {
	api := New(noPublicUrlConfig, &logging.LogEntryBuilder{})
	uuid := api.Extensions[1].UUID
	response := getSingleExtensionHTMLResponse(api, t, uuid)

	instructions := fmt.Sprintf("Make sure you have a secure URL for your local development server by running <code>shopify extension tunnel start --port=8000</code> and then visit the url https://TUNNEL_URL%s/%s</code>, where <code>TUNNEL_URL</code> is replaced with your own ngrok URL.", api.ApiRoot, uuid)

	t.Logf("response: %s", response)

	if !strings.Contains(response, instructions) {
		t.Errorf("expected instructions to contain %s", instructions)
	}
}

func TestPostPurchaseTunnelError(t *testing.T) {
	api := New(noPublicUrlConfig, &logging.LogEntryBuilder{})
	uuid := api.Extensions[2].UUID
	response := getSingleExtensionHTMLResponse(api, t, api.Extensions[2].UUID)

	instructions := fmt.Sprintf("Make sure you have a secure URL for your local development server by running <code>shopify extension tunnel start --port=8000</code>, create a checkout, and append <code>?dev=https://TUNNEL_URL%s/%s</code> to the URL, where <code>TUNNEL_URL</code> is replaced with your own ngrok URL.", api.ApiRoot, uuid)

	t.Logf("response: %s", response)

	if !strings.Contains(response, instructions) {
		t.Errorf("expected instructions to contain %s", instructions)
	}
}

func TestCheckoutRedirect(t *testing.T) {
	api := New(config, &logging.LogEntryBuilder{})
	rec := getSingleExtensionHTMLRequest(api, t, api.Extensions[0].UUID)

	if rec.Code != http.StatusTemporaryRedirect {
		t.Errorf("expected redirect status – received: %d", rec.Code)
	}

	redirectUrl, err := rec.Result().Location()

	expectedUrl := fmt.Sprintf("https://%s/%s?dev=%s", api.Store, api.Extensions[0].Development.Resource.Url, api.ApiRootUrl)

	if err != nil || redirectUrl.String() != expectedUrl {
		t.Errorf("Expected redirect url to be %s but received: %s", expectedUrl, redirectUrl.String())
	}
}

func TestAdminRedirect(t *testing.T) {
	api := New(config, &logging.LogEntryBuilder{})
	uuid := api.Extensions[1].UUID
	rec := getSingleExtensionHTMLRequest(api, t, uuid)

	if rec.Code != http.StatusTemporaryRedirect {
		t.Errorf("Expected redirect status – received: %d", rec.Code)
	}

	redirectUrl, err := rec.Result().Location()

	expectedUrl := fmt.Sprintf("https://%s/admin/extensions-dev?url=%s/%s", api.Store, api.ApiRootUrl, uuid)

	if err != nil || redirectUrl.String() != expectedUrl {
		t.Errorf("Expected redirect url to be %s but received: %s", expectedUrl, redirectUrl.String())
	}
}

func TestPostPurchaseIndex(t *testing.T) {
	api := New(config, &logging.LogEntryBuilder{})
	uuid := api.Extensions[2].UUID
	response := getSingleExtensionHTMLResponse(api, t, uuid)

	expectedLink := fmt.Sprintf("https://example.ngrok.io%s/%s", api.ApiRoot, uuid)
	contents := [...]string{
		"This page is served by your local UI Extension development server. Instead of visiting this page directly, you will need to connect your local development environment to a real checkout environment.",
		"If this is the first time you're testing a Post Purchase extension, please install the browser extension from <a href=\"https://github.com/Shopify/post-purchase-devtools/releases\">https://github.com/Shopify/post-purchase-devtools/releases</a>.",
		fmt.Sprintf("Once installed, simply enter your extension URL <a href=\"%s\">%s</a>.", expectedLink, expectedLink),
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
	api := New(config, &logging.LogEntryBuilder{})
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
		getExpectedExtensionWithUrls(api.Extensions[0], api.ApiRootUrl),
		getExpectedExtensionWithUrls(api.Extensions[1], api.ApiRootUrl),
		getExpectedExtensionWithUrls(api.Extensions[2], api.ApiRootUrl),
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
	api := New(config, &logging.LogEntryBuilder{})
	server := httptest.NewServer(api)

	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	// First message received is the connected message which can be ignored
	ws.ReadJSON(&websocketMessage{})

	lastUpdated := time.Now().Unix()
	updatedExtensions := []core.Extension{api.Extensions[0]}
	updatedExtensions[0].Assets["main"] = core.Asset{Name: "main", LastUpdated: lastUpdated}
	updatedExtensions[0].Development.Status = "success"

	api.Notify(updatedExtensions)

	result, err := getExtensionsFromMessage(ws)

	if err != nil {
		t.Error(err)
	}

	if result[0].Development.Status != "success" {
		t.Errorf("expecting extensions Development.Status to be success but received %v", result[0].Development.Status)
	}

	if result[0].Assets["main"].LastUpdated != lastUpdated {
		t.Errorf("expecting extension Assets[\"main\"].LastUpdated to contain timestamp %v but received %v", lastUpdated, result[0].Assets["main"].LastUpdated)
	}
}

func TestWebsocketConnectionStartAndShutdown(t *testing.T) {
	// FIXME;
	return

	api := New(config, &logging.LogEntryBuilder{})
	server := httptest.NewServer(api)
	first_connection, err := createWebsocket(server)
	second_connection, err := createWebsocket(server)

	if err != nil {
		t.Fatal(err)
	}

	expectedExtensions := []core.Extension{
		getExpectedExtensionWithUrls(api.Extensions[0], api.ApiRootUrl),
		getExpectedExtensionWithUrls(api.Extensions[1], api.ApiRootUrl),
		getExpectedExtensionWithUrls(api.Extensions[2], api.ApiRootUrl),
	}

	if err := verifyWebsocketMessage(first_connection, "connected", api.Version, api.App, expectedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	if err := verifyWebsocketMessage(second_connection, "connected", api.Version, api.App, expectedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	first_connection.SetCloseHandler(func(code int, text string) error {
		first_connection.Close()
		return nil
	})

	api.Shutdown()

	api.Notify(api.Extensions)

	// Both connections should be closed correctly
	if err := verifyConnectionShutdown(api, first_connection); err != nil {
		t.Error(err)
	}

	if err := verifyConnectionShutdown(api, second_connection); err != nil {
		t.Error(err)
	}
}

func TestWebsocketConnectionClientClose(t *testing.T) {
	// FIXME
	return

	api := New(config, &logging.LogEntryBuilder{})
	server := httptest.NewServer(api)
	first_connection, err := createWebsocket(server)
	second_connection, err := createWebsocket(server)

	if err != nil {
		t.Fatal(err)
	}

	expectedExtensions := []core.Extension{
		getExpectedExtensionWithUrls(api.Extensions[0], api.ApiRootUrl),
		getExpectedExtensionWithUrls(api.Extensions[1], api.ApiRootUrl),
		getExpectedExtensionWithUrls(api.Extensions[2], api.ApiRootUrl),
	}

	if err := verifyWebsocketMessage(first_connection, "connected", api.Version, api.App, expectedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	if err := verifyWebsocketMessage(second_connection, "connected", api.Version, api.App, expectedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	first_connection.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1000, "client close connection"))

	// First connection should be closed
	if err := verifyConnectionShutdown(api, first_connection); err != nil {
		t.Error(err)
	}

	api.Notify(api.Extensions)
	// Second connection should receive the update message
	if err := verifyWebsocketMessage(second_connection, "update", api.Version, api.App, expectedExtensions, api.Store); err != nil {
		t.Error(err)
	}
}

func TestWebsocketClientUpdateAppEvent(t *testing.T) {
	api := New(config, &logging.LogEntryBuilder{})
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
	getAllExtensionsJSONResponse(api, t, &response)

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
	api := New(config, &logging.LogEntryBuilder{})
	server := httptest.NewServer(api)

	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	// First message received is the connected message which can be ignored
	ws.ReadJSON(&websocketMessage{})

	updateExtensionUUID := api.Extensions[0].UUID
	unchangedExtensionUUID := api.Extensions[1].UUID

	updatedExtensions := []core.Extension{getExpectedExtensionWithUrls(api.Extensions[0], api.ApiRootUrl)}
	*updatedExtensions[0].Development.Hidden = true
	updatedExtensions[0].Development.Status = "error"

	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	ws.SetWriteDeadline(deadline)

	dataJSONString := fmt.Sprintf(`{"extensions": [
		{"uuid": "%s", "development": {"status": "error", "hidden": true}},
		{"uuid": "NON_MATCHING_UUID", "development": {"status": "error", "hidden": true}}
	]}`, updateExtensionUUID)

	data := []byte(dataJSONString)
	ws.WriteJSON(websocketClientMessage{Event: "update", Data: data})

	<-time.After(duration)

	if err := verifyWebsocketMessage(ws, "update", api.Version, api.App, updatedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	apiUpdatedExtension := api.Extensions[0]
	updated := singleExtensionResponse{}

	getSingleExtensionJSONResponse(api, t, updateExtensionUUID, &updated)

	if *updated.Extension.Development.Hidden != true {
		t.Errorf("expected response for extension %s Development.Hidden to be true but got %v", updateExtensionUUID, *updated.Extension.Development.Hidden)
	}

	if updated.Extension.Development.Status != "error" {
		t.Errorf("expected response for extension %s Development.Status to be \"error\" but got %v", updateExtensionUUID, updated.Extension.Development.Status)
	}

	if *apiUpdatedExtension.Development.Hidden != true {
		t.Errorf("expected API extension %s Development.Hidden to be true  but got %v", updateExtensionUUID, *apiUpdatedExtension.Development.Hidden)
	}

	if apiUpdatedExtension.Development.Status != "error" {
		t.Errorf("expected API extension %s Development.Status to be \"error\" but got %v", updateExtensionUUID, apiUpdatedExtension.Development.Status)
	}

	apiUnchangedExtension := api.Extensions[1]
	unchanged := singleExtensionResponse{}
	getSingleExtensionJSONResponse(api, t, unchangedExtensionUUID, &unchanged)

	if *unchanged.Extension.Development.Hidden != false {
		t.Errorf("expected response for extension %s Development.Hidden to be unchanged but got %v", unchangedExtensionUUID, *unchanged.Extension.Development.Hidden)
	}

	if unchanged.Extension.Development.Status != "" {
		t.Errorf("expected response for extension %s Development.Status to be unchanged but got %v", unchangedExtensionUUID, unchanged.Extension.Development.Status)
	}

	if *apiUnchangedExtension.Development.Hidden != false {
		t.Errorf("expected API extension %s Development.Hidden to be unchanged but got %v", unchangedExtensionUUID, *apiUpdatedExtension.Development.Hidden)
	}

	if apiUnchangedExtension.Development.Status != "" {
		t.Errorf("expected API extension %s Development.Status to be unchanged but got %v", unchangedExtensionUUID, apiUpdatedExtension.Development.Status)
	}
}

func TestWebsocketClientUpdateBooleanValue(t *testing.T) {
	api := New(config, &logging.LogEntryBuilder{})
	updateExtension := api.Extensions[0]

	*updateExtension.Development.Hidden = true

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
	data := []byte(fmt.Sprintf(`{
		"extensions": [
		  {
			"uuid": "%s",
			"development": {"hidden": false}
		  }
		]
	  }`, updateExtension.UUID))
	err = ws.WriteJSON(websocketClientMessage{Event: "update", Data: data})

	if err != nil {
		t.Error(err)
	}

	<-time.After(duration)

	updatedExtensions := []core.Extension{getExpectedExtensionWithUrls(api.Extensions[0], api.ApiRootUrl)}
	*updatedExtensions[0].Development.Hidden = false

	if err := verifyWebsocketMessage(ws, "update", api.Version, api.App, updatedExtensions, api.Store); err != nil {
		t.Error(err)
	}

	apiUpdatedExtension := api.Extensions[0]
	updated := singleExtensionResponse{}
	getSingleExtensionJSONResponse(api, t, updateExtension.UUID, &updated)

	if *updated.Extension.Development.Hidden != false {
		t.Errorf("expected response for extension %s Development.Hidden to be false but got %v", updateExtension.UUID, *updated.Extension.Development.Hidden)
	}
	if *apiUpdatedExtension.Development.Hidden != false {
		t.Errorf("expected API extension %s Development.Hidden to be false but got %v", updateExtension.UUID, *apiUpdatedExtension.Development.Hidden)
	}
}

func TestWebsocketClientDispatchEventWithoutMutatingData(t *testing.T) {
	api := New(config, &logging.LogEntryBuilder{})
	server := httptest.NewServer(api)

	dispatchExtensionUUID := api.Extensions[0].UUID

	initialResponse := extensionsResponse{}
	getAllExtensionsJSONResponse(api, t, &initialResponse)

	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	// First message received is the connected message which can be ignored
	ws.ReadJSON(&websocketMessage{})

	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	ws.SetWriteDeadline(deadline)

	data := []byte(fmt.Sprintf(`{
		"type": "focus",
		"customData": "foo",
		"app": {
		  "apiKey": "app_api_key",
		  "customData": "bar"
		},
		"extensions": [
		  {
			"uuid": "%s",
			"customData": "baz",
			"development": {"status": "success"},
			"metafields": [{"namespace": "another-namespace", "key": "another-key"}]
		  }
		]
	  }`, dispatchExtensionUUID))

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

	extensionRootUrl := fmt.Sprintf("%s/%s", api.ApiRootUrl, dispatchExtensionUUID)
	extensionAssetUrl := fmt.Sprintf("%s/assets/main.js", extensionRootUrl)
	expectedExtensions := fmt.Sprintf(`[
		{
			"customData": "baz",
			"assets": {
			"main": {
				"name": "main",
				"url": "%s",
				"lastUpdated": 0
			}
			},
			"development": {
			"hidden": false,
			"resource": {"url": ""},
			"root": {"url": "%s"},
			"localizationStatus": "",
			"status": "success",
			"resource": {"url": "cart/1234"}
			},
			"externalType": "checkout_ui",
			"type": "checkout_ui_extension",
			"metafields": [{"namespace": "another-namespace", "key": "another-key"}],
			"uuid": "%s",
			"version": "",
			"extensionPoints": null,
			"localization": null,
			"surface": "checkout",
			"capabilities": {
				"networkAccess": false,
				"blockProgress": false
			}
		}
		]`, extensionAssetUrl, extensionRootUrl, dispatchExtensionUUID)

	match, err := isEqualJSON(expectedExtensions, string(extensions))
	if err != nil {
		t.Error(err)
	}
	if !match {
		t.Errorf("unexpected extensions in message, received %v, expected %v", string(extensions), expectedExtensions)
	}

	response := extensionsResponse{}

	getAllExtensionsJSONResponse(api, t, &response)

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
	_, message, err := ws.ReadMessage()
	if !websocket.IsCloseError(err, websocket.CloseNormalClosure) {
		notification := notification{}
		json.Unmarshal(message, &notification)
		return fmt.Errorf("Expected connection to be terminated but the read error returned: %v and the connection received the notification: %v", err, notification)
	}
	return nil
}

func createWebsocket(server *httptest.Server) (*websocket.Conn, error) {
	url := fmt.Sprintf("ws%s%s", strings.TrimPrefix(server.URL, "http"), apiRoot)
	connection, _, err := websocket.DefaultDialer.Dial(url, nil)
	return connection, err
}

func getJSONResponse(api *ExtensionsApi, t *testing.T, requestUri string, response interface{}) interface{} {
	fmt.Printf("GET %s\n", requestUri)
	req, err := http.NewRequest("GET", requestUri, nil)
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

func getSingleExtensionJSONResponse(api *ExtensionsApi, t *testing.T, uuid string, response interface{}) interface{} {
	return getJSONResponse(api, t, apiRoot+"/"+uuid, response)
}

func getAllExtensionsJSONResponse(api *ExtensionsApi, t *testing.T, response interface{}) interface{} {
	return getJSONResponse(api, t, apiRoot, response)
}

func getHTMLRequest(api *ExtensionsApi, t *testing.T, requestUri string) *httptest.ResponseRecorder {
	req, err := http.NewRequest("GET", requestUri, nil)
	req.Header.Add("accept", "text/html")
	req.RequestURI = requestUri

	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api.ServeHTTP(rec, req)
	return rec
}

func getSingleExtensionHTMLRequest(api *ExtensionsApi, t *testing.T, uuid string) *httptest.ResponseRecorder {
	return getHTMLRequest(api, t, apiRoot+"/"+uuid)
}

func getSingleExtensionHTMLResponse(api *ExtensionsApi, t *testing.T, uuid string) string {
	rec := getSingleExtensionHTMLRequest(api, t, uuid)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected ok status – received: %d", rec.Code)
		t.Log(rec.Body)
	}

	return rec.Body.String()
}

func getExpectedExtensionWithUrls(extension core.Extension, host string) core.Extension {
	extension.Development.Root.Url = fmt.Sprintf("%s/%s", host, extension.UUID)
	extension.Assets["main"] = core.Asset{Name: "main", Url: fmt.Sprintf("%s/assets/main.js", extension.Development.Root.Url)}
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
