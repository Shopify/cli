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
	req, err := http.NewRequest("GET", "/extensions/", nil)
	req.Host = "localhost:8000"
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api := New(config, apiRoot)
	api.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected ok status – received: %d", rec.Code)
	}

	service := core.ExtensionService{}
	if err := json.Unmarshal(rec.Body.Bytes(), &service); err != nil {
		t.Logf("%+v\n", rec.Body.String())
		t.Fatal(err)
	}

	t.Logf("%+v\n", service)

	if len(service.Extensions) != 1 {
		t.Errorf("Expected one extension got %d", len(service.Extensions))
	}

	if service.Version != "0.1.0" {
		t.Errorf("expect service version to be 0.1.0 but got %s", service.Version)
	}

	extension := service.Extensions[0]

	if extension.Assets == nil {
		t.Error("expect assets to not be null")
	}

	if extension.Assets["main"].Name != "main" {
		t.Errorf("expect an asset with the name main, got %s", extension.Assets["main"].Name)
	}

	if extension.Assets["main"].Url != fmt.Sprintf("http://localhost:8000/extensions/%s/assets/main.js", extension.UUID) {
		t.Errorf("expect a main asset url, got %s", extension.Assets["main"].Url)
	}

	if extension.Development.Root.Url != fmt.Sprintf("http://localhost:8000/extensions/%s", extension.UUID) {
		t.Errorf("expect an extension root url, got %s", extension.Development.Root.Url)
	}

	if extension.App == nil {
		t.Error("Expected app to not be null")
	}

	if extension.User.Metafields == nil {
		t.Error("Expected user metafields to not be null")
	}
}

func TestGetSingleExtension(t *testing.T) {
	requestUri := "/extensions/00000000-0000-0000-0000-000000000000"
	req, err := http.NewRequest("GET", requestUri, nil)
	req.Host = "localhost:8000"
	req.RequestURI = requestUri

	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api := New(config, apiRoot)
	api.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected ok status – received: %d", rec.Code)
	}

	response := singleExtensionResponse{}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Logf("%+v\n", rec.Body.String())
		t.Fatal(err)
	}

	t.Logf("%+v\n", response)

	if response.Version != "0.1.0" {
		t.Errorf("expect service version to be 0.1.0 but got %s", response.Version)
	}

	extension := response.Extension

	if extension.Assets == nil {
		t.Error("expect assets to not be null")
	}

	if extension.Assets["main"].Name != "main" {
		t.Errorf("expect an asset with the name main, got %s", extension.Assets["main"].Name)
	}

	if extension.Assets["main"].Url != fmt.Sprintf("http://localhost:8000/extensions/%s/assets/main.js", extension.UUID) {
		t.Errorf("expect a main asset url, got %s", extension.Assets["main"].Url)
	}

	if extension.Development.Root.Url != fmt.Sprintf("http://localhost:8000/extensions/%s", extension.UUID) {
		t.Errorf("expect an extension root url, got %s", extension.Development.Root.Url)
	}

	if extension.App == nil {
		t.Error("Expected app to not be null")
	}

	if extension.User.Metafields == nil {
		t.Error("Expected user metafields to not be null")
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
	firstConnection.ReadJSON(&StatusUpdate{})
	secondConnection.ReadJSON(&StatusUpdate{})

	expectedUpdate := StatusUpdate{Type: "Some message", Extensions: config.Extensions}
	api.Notify(expectedUpdate)

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

	if err := verifyWebsocketMessage(ws, StatusUpdate{Type: "connected", Extensions: api.Extensions}); err != nil {
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

	if err := verifyWebsocketMessage(ws, StatusUpdate{Type: "connected", Extensions: api.Extensions}); err != nil {
		t.Error(err)
	}

	ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(1000, "client close connection"))

	if err := verifyConnectionShutdown(api, ws); err != nil {
		t.Error(err)
	}
}

func verifyWebsocketMessage(ws *websocket.Conn, expectedMessage StatusUpdate) error {
	message := StatusUpdate{}

	ws.ReadJSON(&message)

	if message.Type != expectedMessage.Type {
		log.Printf("%v, %v", message, expectedMessage)
		return fmt.Errorf("Could not connect to websocket")
	}

	result, err := json.Marshal(message.Extensions)

	if err != nil {
		return fmt.Errorf("Converting Extensions in message to JSON failed with error: %v", err)
	}

	expectedResult, err := json.Marshal(expectedMessage.Extensions)
	if err != nil {
		return fmt.Errorf("Converting Extensions in expected message to JSON failed with error: %v", err)
	}

	if string(result) != string(expectedResult) {
		return fmt.Errorf("Unexpected extensions in message, received %v, expected %v", string(result), string(expectedResult))
	}

	return nil
}

func verifyConnectionShutdown(api *ExtensionsApi, ws *websocket.Conn) error {
	// TODO: Break out of this 1 second wait if the client responds correctly to the close message
	// Currently the test will fail without the wait since the channel and connection is still open
	<-time.After(time.Second * 1)

	api.Notify(StatusUpdate{Type: "Some message"})
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
