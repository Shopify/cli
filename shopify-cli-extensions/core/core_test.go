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
		type: checkout_ui_extension
		title: Test Extension
		name: Alternate Name
		can_access_network: true
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

	if extension.Type != "checkout_ui_extension" {
		t.Errorf("invalid extension type – expected checkout_ui_extension got %s", extension.Type)
	}

	if extension.Title != "Test Extension" {
		t.Errorf("invalid title - expected Test Extension go %s", extension.Title)
	}

	if extension.Name != "Alternate Name" {
		t.Errorf("invalid name - expected Alternate Name go %s", extension.Name)
	}

	if !extension.CanAccessNetwork {
		t.Errorf("invalid value for CanAccessNetwork - expected true got %t", extension.CanAccessNetwork)
	}
}

func formatYAML(s string) string {
	return strings.Replace(s, "\t", "  ", -1)
}
