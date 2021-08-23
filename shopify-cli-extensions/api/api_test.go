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

func TestGenerateManifest(t *testing.T) {
	req, err := http.NewRequest("GET", "/manifest", nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api := NewApi(core.NewExtension(buildDir))
	api.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected ok status – received: %d", rec.Code)
	}

	extension := core.Extension{}
	if err := json.Unmarshal(rec.Body.Bytes(), &extension); err != nil {
		t.Error(err)
	}

	t.Logf("%+v\n", extension)

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
	req, err := http.NewRequest("GET", "/assets/index.js", nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api := NewApi(core.NewExtension(buildDir))
	api.ServeHTTP(rec, req)

	if rec.Body.String() != "console.log(\"Hello World!\");\n" {
		t.Error("Unexpected body")
		t.Log(rec.Body)
	}
}
