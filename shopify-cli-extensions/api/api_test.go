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

func TestNotify(t *testing.T) {
	api := New(config, context.TODO())
	expectedUpdate := StatusUpdate{Type: "Some message", Extensions: config.Extensions}

	go api.Notify(expectedUpdate)

	update := <-api.notifier.updates

	if update.Type != expectedUpdate.Type {
		t.Errorf("Unexpected Type in update event, received %v, expected %v", update.Type, expectedUpdate.Type)
	}

	expectedResult, err := json.Marshal(expectedUpdate.Extensions)
	if err != nil {
		t.Error("Cannot convert Extensions in expected update event to JSON", err)
	}

	result, err := json.Marshal(update.Extensions)
	if err != nil {
		t.Error("Cannot convert Extensions in update event to JSON", err)
	}

	if string(result) != string(expectedResult) {
		t.Errorf("Unexpected extensions in update event, received %v, expected %v", string(result), string(expectedResult))
	}
}
