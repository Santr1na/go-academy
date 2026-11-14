//go:build !linux

package main

import "errors"

func enableSandbox(uid int) error {
	return errors.New("-sandbox-uid поддерживается только в Linux")
}
