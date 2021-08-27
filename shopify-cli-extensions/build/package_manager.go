package build

import (
	"bytes"
	"context"
	"errors"
	"os"
	"os/exec"
)

type LookPath func(file string) (string, error)

func FindPackageManager(lp LookPath, workingDir string) *PackageManager {
	_, err := lp("yarn")
	if err != nil {
		return npm(workingDir)
	}
	return yarn(workingDir)
}

type FormatArgs func(script string, args ...string) []string

type PackageManager struct {
	name       string
	formatArgs FormatArgs
	workingDir string
}

func npm(workingDir string) *PackageManager {
	return &PackageManager{
		name: "npm",
		formatArgs: func(script string, args ...string) []string {
			args = append([]string{"run", script, "--"}, args...)
			return args
		},
		workingDir: workingDir,
	}
}

func yarn(workingDir string) *PackageManager {
	return &PackageManager{
		name: "yarn",
		formatArgs: func(script string, args ...string) []string {
			return append([]string{script}, args...)
		},
		workingDir: workingDir,
	}
}

func (pm *PackageManager) RunScript(ctx context.Context, script string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, pm.name, pm.formatArgs(script, args...)...)
	cmd.Dir = pm.workingDir

	if _, err := os.Stat(pm.workingDir); os.IsNotExist(err) {
		return "", errors.New(err.Error())
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", errors.New(stderr.String())
	}

	return stdout.String(), nil
}
