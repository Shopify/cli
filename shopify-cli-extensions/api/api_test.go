package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Shopify/shopify-cli-extensions/core"
)

const (
	buildDir = "testdata/build"
)

func TestGetExtensions(t *testing.T) {
	req, err := http.NewRequest("GET", "/", nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api := NewApi(core.NewExtensionService(buildDir))
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

	if extension.App == nil {
		t.Error("Expected app to not be null")
	}

	if extension.User.Metafields == nil {
		t.Error("Expected user metafields to not be null")
	}
}

func TestServeAssets(t *testing.T) {
	req, err := http.NewRequest("GET", "/00000000-0000-0000-0000-000000000000/assets/index.js", nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api := NewApi(core.NewExtensionService(buildDir))
	api.ServeHTTP(rec, req)

	if rec.Body.String() != "console.log(\"Hello World!\");\n" {
		t.Error("Unexpected body")
		t.Log(rec.Body)
	}
}
