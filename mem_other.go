//go:build !linux

package main

// watchMemory: ограничение памяти реализовано только для Linux (/proc).
func watchMemory(pid int, limit int64, stop <-chan struct{}, onExceed func()) {}
