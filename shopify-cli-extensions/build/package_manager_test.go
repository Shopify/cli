package build

import (
	"errors"
	"reflect"
	"testing"
)

func TestNewPackageManagerDefaultsToYarnIfYarnInstalled(t *testing.T) {
	lp := func(file string) (string, error) {
		return "yarn", nil
	}

	p := FindPackageManager(lp, "testdata")
	if p.name != "yarn" {
		t.Errorf("Expected default package manager to be yarn, got %s\n", p.name)
	}
}

func TestNewPackageManagerDefaultsToNpmIfYarnNotInstalled(t *testing.T) {
	lp := func(file string) (string, error) {
		return "", errors.New("yarn not found")
	}

	p := FindPackageManager(lp, "testdata")
	if p.name != "npm" {
		t.Errorf("Expected default package manager to be npm, got %s\n", p.name)
	}
}

func TestNpmFormatter(t *testing.T) {
	npm := npm("testdata")
	actual_output := npm.formatArgs("test.js", "foo", "bar")
	expected_output := []string{"run", "test.js", "--", "foo", "bar"}
	if !reflect.DeepEqual(actual_output, expected_output) {
		t.Errorf("Unexpected NPM format. Expected: %s, actual: %s", expected_output, actual_output)
	}
}

func TestYarnFormatter(t *testing.T) {
	yarn := yarn("testdata")
	actual_output := yarn.formatArgs("test.js", "foo", "bar")
	expected_output := []string{"test.js", "foo", "bar"}
	if !reflect.DeepEqual(actual_output, expected_output) {
		t.Errorf("Unexpected YARN format. Expected: %s, actual: %s", expected_output, actual_output)
	}
}
