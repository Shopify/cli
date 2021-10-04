package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/gorilla/websocket"
)

var (
	config *core.Config
)

var apiRoot = "/extensions/"

func init() {
	configFile, err := os.Open("testdata/shopifile.yml")
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
	host := "123.ngrok-url"
	api := New(config, apiRoot)
	response := extensionsResponse{}

	getJSONResponse(api, t, host, "/extensions/", &response)

	if response.App == nil || response.App["api_key"] != "app_api_key" {
		t.Errorf("Expected app to have api_key \"app_api_key\" but got %v", response.App)
	}

	if len(response.Extensions) != 2 {
		t.Errorf("Expected 2 extension got %d", len(response.Extensions))
	}

	if response.Version != "0.1.0" {
		t.Errorf("expect service version to be 0.1.0 but got %s", response.Version)
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

	if extension.User.Metafields[0] != metafields {
		t.Errorf("expected user metafields to be %v but got %v", metafields, extension.User.Metafields[0])
	}

	if api.Extensions[0].Development.Root.Url != "" || api.Extensions[0].Assets["main"].Url != "" {
		t.Error("expect extension API data urls to not to be mutated")
	}
}

func TestGetSingleExtension(t *testing.T) {
	host := "123.ngrok-url"
	api := New(config, apiRoot)
	response := singleExtensionResponse{}

	getJSONResponse(api, t, host, "/extensions/00000000-0000-0000-0000-000000000000", &response)

	if response.Version != "0.1.0" {
		t.Errorf("expect service version to be 0.1.0 but got %s", response.Version)
	}

	if response.App == nil {
		t.Error("Expected app to not be null")
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

	if extension.User.Metafields == nil {
		t.Errorf("expected user metafields to be an an array")
	}

	metafields := core.Metafield{Namespace: "my-namespace", Key: "my-key"}

	if extension.User.Metafields[0] != metafields {
		t.Errorf("expected user metafields to be %v but got %v", metafields, extension.User.Metafields[0])
	}

	if api.Extensions[0].Development.Root.Url != "" || api.Extensions[0].Assets["main"].Url != "" {
		t.Error("expect extension API data urls to not to be mutated")
	}
}

func TestServeAssets(t *testing.T) {
	req, err := http.NewRequest("GET", "/extensions/00000000-0000-0000-0000-000000000000/assets/main.js", nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api := New(config, apiRoot)
	api.ServeHTTP(rec, req)

	if rec.Body.String() != "console.log(\"Hello World!\");\n" {
		t.Error("Unexpected body")
		t.Log(rec.Body)
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
	firstConnection.ReadJSON(&WebsocketMessage{})
	secondConnection.ReadJSON(&WebsocketMessage{})

	expectedExtensions := []core.Extension{
		getExpectedExtensionWithUrls(api.Extensions[0], server.URL),
		getExpectedExtensionWithUrls(api.Extensions[1], server.URL),
	}
	expectedUpdate := WebsocketMessage{
		Event: "update",
		Data:  WebsocketData{Extensions: expectedExtensions, App: api.App},
	}

	api.Notify(api.Extensions)

	if err := verifyWebsocketMessage(firstConnection, expectedUpdate); err != nil {
		t.Error(err)
	}

	if err = verifyWebsocketMessage(secondConnection, expectedUpdate); err != nil {
		t.Error(err)
	}
}

func TestWebsocketConnectionStartAndShutdown(t *testing.T) {
	api := New(config, apiRoot)
	server := httptest.NewServer(api)
	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	expectedExtensions := []core.Extension{getExpectedExtensionWithUrls(api.Extensions[0], server.URL), getExpectedExtensionWithUrls(api.Extensions[1], server.URL)}
	expectedMessage := WebsocketMessage{
		Event: "connected",
		Data:  WebsocketData{Extensions: expectedExtensions, App: api.App},
	}

	if err := verifyWebsocketMessage(ws, expectedMessage); err != nil {
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
	}

	expectedMessage := WebsocketMessage{
		Event: "connected",
		Data:  WebsocketData{Extensions: expectedExtensions, App: api.App},
	}

	if err := verifyWebsocketMessage(ws, expectedMessage); err != nil {
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
	ws.ReadJSON(&WebsocketMessage{})

	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	ws.SetWriteDeadline(deadline)
	ws.WriteJSON(WebsocketMessage{Event: "update", Data: WebsocketData{
		App: map[string]interface{}{
			"apiKey": "app_api_key",
			"title":  "my app",
		},
	}})

	<-time.After(duration)

	expectedUpdate := WebsocketMessage{
		Event: "update",
		Data: WebsocketData{
			Extensions: []core.Extension{},
			App: map[string]interface{}{
				"api_key": "app_api_key",
				"title":   "my app",
			}},
	}

	if err := verifyWebsocketMessage(ws, expectedUpdate); err != nil {
		t.Error(err)
	}

	response := extensionsResponse{}
	getJSONResponse(api, t, server.URL, "/extensions/", &response)

	if response.App == nil {
		t.Error("Expected app to not be null")
	}

	if response.App["api_key"] != "app_api_key" {
		t.Errorf("expected App[\"api_key\"] to be `\"app_api_key\"` but got %v", api.App["api_key"])
	}

	if response.App["title"] != "my app" {
		t.Errorf("expected App[\"title\"] to be updated to `\"my app\"` but got %v", api.App["title"])
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
	ws.ReadJSON(&WebsocketMessage{})

	updatedExtensions := []core.Extension{getExpectedExtensionWithUrls(api.Extensions[0], server.URL)}
	updatedExtensions[0].Development.Hidden = true
	updatedExtensions[0].Development.Status = "error"

	expectedUpdate := WebsocketMessage{
		Event: "update",
		Data:  WebsocketData{Extensions: updatedExtensions, App: api.App},
	}

	duration := 1 * time.Second
	deadline := time.Now().Add(duration)

	ws.SetWriteDeadline(deadline)
	ws.WriteJSON(WebsocketMessage{Event: "update", Data: WebsocketData{
		Extensions: append([]core.Extension{}, core.Extension{
			UUID: "00000000-0000-0000-0000-000000000000",
			Development: core.Development{
				Status: "error",
				Hidden: true,
			},
		}, core.Extension{
			UUID: "NON_MATCHING_UUID",
			Development: core.Development{
				Status: "error",
				Hidden: true,
			},
		}),
	}})

	<-time.After(duration)

	if err := verifyWebsocketMessage(ws, expectedUpdate); err != nil {
		t.Error(err)
	}

	updated := singleExtensionResponse{}
	getJSONResponse(api, t, server.URL, "/extensions/00000000-0000-0000-0000-000000000000", &updated)

	if !updated.Extension.Development.Hidden {
		t.Errorf("expected extension Development.Hidden to be true but got %v", updated.Extension.Development.Hidden)
	}

	if updated.Extension.Development.Status != "error" {
		t.Errorf("expected extension Development.Status to be \"error\" but got %v", updated.Extension.Development.Hidden)
	}

	unchanged := singleExtensionResponse{}
	getJSONResponse(api, t, server.URL, "/extensions/00000000-0000-0000-0000-000000000001", &unchanged)

	if unchanged.Extension.Development.Hidden {
		t.Errorf("expected extension Development.Hidden to be unchanged but got %v", unchanged.Extension.Development.Hidden)
	}

	if unchanged.Extension.Development.Status != "" {
		t.Errorf("expected extension Development.Status to be unchanged but got %v", unchanged.Extension.Development.Status)
	}
}

func verifyWebsocketMessage(ws *websocket.Conn, expectedMessage WebsocketMessage) error {
	message := WebsocketMessage{}

	ws.ReadJSON(&message)

	if message.Event != expectedMessage.Event {
		log.Printf("message received: %v, message expected: %v", message, expectedMessage)
		return fmt.Errorf("Could not connect to websocket")
	}

	result, err := json.Marshal(message.Data.Extensions)

	if err != nil {
		return fmt.Errorf("converting Extensions in message to JSON failed with error: %v", err)
	}

	expectedResult, err := json.Marshal(expectedMessage.Data.Extensions)
	if err != nil {
		return fmt.Errorf("converting Extensions in expected message to JSON failed with error: %v", err)
	}

	if string(result) != string(expectedResult) {
		return fmt.Errorf("unexpected extensions in message, received %v, expected %v", string(result), string(expectedResult))
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
		notification := StatusUpdate{}
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

func getExpectedExtensionWithUrls(extension core.Extension, host string) core.Extension {
	extension.Development.Root.Url = fmt.Sprintf("%s/extensions/%s", host, extension.UUID)
	extension.Assets["main"] = core.Asset{Name: "main", Url: fmt.Sprintf("%s/extensions/%s/assets/main.js", host, extension.UUID)}
	return extension
}
