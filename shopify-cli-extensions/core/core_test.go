package core_test

import (
	"strings"
	"testing"

	"github.com/Shopify/shopify-cli-extensions/core"
)

func TestLoadConfig(t *testing.T) {
	serializedConfig := formatYAML(`---
extensions:
	- uuid: 123
		external_type: checkout_ui
		type: checkout_ui_extension
		title: Test Extension
		name: Alternate Name
		capabilities:
			network_access: true
`)

	config, err := core.LoadConfig(strings.NewReader(serializedConfig))

	if err != nil {
		t.Fatal(err)
	}

	if len(config.Extensions) != 1 {
		t.Fatalf("expected one extension got %d instead", len(config.Extensions))
	}

	extension := config.Extensions[0]

	if extension.UUID != "123" {
		t.Errorf("invalid uuid expected 123 got %s", extension.UUID)
	}

	if extension.Type != "checkout_ui" {
		t.Errorf("invalid external extension type – expected checkout_ui got %s", extension.ExternalType)
	}

	if extension.Type != "checkout_ui_extension" {
		t.Errorf("invalid extension type – expected checkout_ui_extension got %s", extension.Type)
	}

	if extension.Title != "Test Extension" {
		t.Errorf("invalid title - expected Test Extension got %s", extension.Title)
	}

	if extension.Name != "Alternate Name" {
		t.Errorf("invalid name - expected Alternate Name got %s", extension.Name)
	}

	if *extension.Capabilities.NetworkAccess != true {
		t.Errorf("invalid value for Capabilities - expected network_access got %t", *extension.Capabilities.NetworkAccess)
	}
}

func formatYAML(s string) string {
	return strings.Replace(s, "\t", "  ", -1)
}
