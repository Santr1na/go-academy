//go:build !unix

package main

import (
	"os/exec"
	"time"
)

func setupProcess(cmd *exec.Cmd) {
	cmd.WaitDelay = 2 * time.Second
}
