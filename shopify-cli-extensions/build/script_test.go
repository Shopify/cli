package build

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

func TestYarnCommandStructure(t *testing.T) {
	LookPath = func(file string) (string, error) {
		if file == "yarn" {
			return "yarn", nil
		}

		return "", errors.New("command not found")
	}

	cmd, err := script(".", "build", "some-arg")
	if err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(cmd.Args, []string{"yarn", "run", "--silent", "build", "some-arg"}) {
		t.Errorf("Unexpected program arguments: %s", strings.Join(cmd.Args, " "))
	}
}

func TestNpmCommandStructure(t *testing.T) {
	LookPath = func(file string) (string, error) {
		if file == "npm" {
			return "npm", nil
		}
		return "", errors.New("command not found")
	}

	cmd, err := script(".", "build", "some-arg")
	if err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(cmd.Args, []string{"npm", "run", "--silent", "build", "--", "some-arg"}) {
		t.Errorf("Unexpected program arguments: %s", strings.Join(cmd.Args, " "))
	}
}

func TestPrefersYarn(t *testing.T) {
	lookupOrder := []string{}
	LookPath = func(file string) (string, error) {
		lookupOrder = append(lookupOrder, file)
		return "", errors.New("command not found")
	}

	script(".", "build")

	if lookupOrder[0] != "yarn" {
		t.Error("Expected yarn to be checked first")
	}

	if lookupOrder[1] != "npm" {
		t.Error("Expected npm to be checked second")
	}
}
