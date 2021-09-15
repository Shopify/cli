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

	api := New(config)
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

	api := New(config)
	api.ServeHTTP(rec, req)

	if rec.Body.String() != "console.log(\"Hello World!\");\n" {
		t.Error("Unexpected body")
		t.Log(rec.Body)
	}
}

func TestWebsocketNotify(t *testing.T) {
	api := New(config)
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

func TestWebsocketConnection(t *testing.T) {
	api := New(config)
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
		log.Println("close handler")
		return nil
	})

	api.Shutdown()

	_, _, err = ws.ReadMessage()
	if !websocket.IsCloseError(err, websocket.CloseNormalClosure) {
		t.Errorf("Expected connection to be terminated: %v", err)
	}
}

func TestWebsocketClientClose(t *testing.T) {
	api := New(config)
	server := httptest.NewServer(api)
	ws, err := createWebsocket(server)
	if err != nil {
		t.Fatal(err)
	}

	ws.WriteControl(websocket.CloseMessage, []byte{}, time.Now().Add(1*time.Second))
	err = ws.Close()
	if err != nil {
		t.Errorf("Expected closing socket to work: %v", err)
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

func createWebsocket(server *httptest.Server) (*websocket.Conn, error) {
	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/extensions/"
	connection, _, err := websocket.DefaultDialer.Dial(url, nil)
	return connection, err
}
