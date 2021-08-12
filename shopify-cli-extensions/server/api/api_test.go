package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGenerateManifest(t *testing.T) {
	req, err := http.NewRequest("GET", "/manifest", nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()

	api := NewApi(NewManifest())
	api.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected ok status – received: %d", rec.Code)
	}

	manifest := Manifest{}
	if err := json.Unmarshal(rec.Body.Bytes(), &manifest); err != nil {
		t.Error(err)
	}

	t.Logf("%+v\n", manifest)

	if manifest.Assets == nil {
		t.Error("Expected assets to not be null")
	}

	if manifest.App == nil {
		t.Error("Expected app to not be null")
	}

	if manifest.User.Metafields == nil {
		t.Error("Expected user metafields to not be null")
	}
}
