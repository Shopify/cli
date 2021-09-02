package build

import (
	"context"
	"errors"
	"reflect"
	"strings"
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

func TestRunScript(t *testing.T) {
	var buffer strings.Builder

	pm := PackageManager{
		name: "bash",
		formatArgs: func(script string, args ...string) []string {
			return []string{script}
		},
		workingDir: "testdata/build",
		stdout:     &buffer,
	}

	if err := pm.RunScript(context.TODO(), "test.sh"); err != nil {
		t.Error("Expected RunScript to be successful")
	}

	if buffer.String() != "Hello world!\n" {
		t.Errorf("Incorrect output, got: %s", buffer.String())
	}
}

func TestRunScriptErrorIfDirectoryNotFound(t *testing.T) {
	pm := PackageManager{
		name: "bash",
		formatArgs: func(script string, args ...string) []string {
			return []string{script}
		},
		workingDir: "doesnotexist123",
	}

	err := pm.RunScript(context.TODO(), "test.sh")

	if err == nil {
		t.Error("Expected operation to be unsuccessful")
	}

	if !strings.Contains(err.Error(), "no such file or directory") {
		t.Errorf("Expected error to include 'no such file or directory', got: %v", err)
	}
}
