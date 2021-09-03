package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/gorilla/websocket"
)

var (
	config *core.Config
)

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
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api := New(config, context.TODO())
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

	extension := service.Extensions[0]

	if extension.Assets == nil {
		t.Error("Expected assets to not be null")
	}

	if extension.Assets[0].Name != "main" {
		t.Errorf("expect an asset with the name main, got %s", extension.Assets[0].Name)
	}

	if extension.Assets[0].Url != fmt.Sprintf("http://localhost:8000/extensions/%s/assets/main.js", extension.UUID) {
		t.Errorf("expect a main asset url, got %s", extension.Assets[0].Url)
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

	api := New(config, context.TODO())
	api.ServeHTTP(rec, req)

	if rec.Body.String() != "console.log(\"Hello World!\");\n" {
		t.Error("Unexpected body")
		t.Log(rec.Body)
	}
}

func TestWebsocketNotify(t *testing.T) {
	api := New(config, context.TODO())
	ctx, cancel := context.WithCancel(context.Background())
	go api.Start(ctx)
	defer cancel()

	firstConnection := createWebsocket(t, api.Port)
	secondConnection := createWebsocket(t, api.Port)

	// First message received is the connected message which can be ignored
	firstConnection.ReadJSON(&StatusUpdate{})
	secondConnection.ReadJSON(&StatusUpdate{})

	expectedUpdate := StatusUpdate{Type: "Some message", Extensions: config.Extensions}
	api.Notify(expectedUpdate)

	err := verifyWebsocketMessage(firstConnection, expectedUpdate)

	if err != nil {
		t.Error(err)
	}

	err = verifyWebsocketMessage(secondConnection, expectedUpdate)

	if err != nil {
		t.Error(err)
	}
}

func TestWebsocketConnectedMessage(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	api := New(config, ctx)
	go api.Start(ctx)
	defer cancel()

	ws := createWebsocket(t, api.Port)
	err := verifyWebsocketMessage(ws, StatusUpdate{Type: "connected", Extensions: api.Extensions})

	if err != nil {
		t.Error(err)
	}
}

func verifyWebsocketMessage(ws *websocket.Conn, expectedMessage StatusUpdate) error {
	message := StatusUpdate{}

	ws.ReadJSON(&message)

	if message.Type != expectedMessage.Type {
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

func createWebsocket(t *testing.T, port int) *websocket.Conn {
	ws, _, err := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://localhost:%d/extensions/", port), nil)
	if err != nil {
		t.Fatalf("%v", err)
	}
	return ws
}
