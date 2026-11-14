//go:build linux

package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// watchMemory следит за резидентной памятью процесса и вызывает onExceed,
// когда она превышает limit. Завершается при закрытии stop или выходе процесса.
func watchMemory(pid int, limit int64, stop <-chan struct{}, onExceed func()) {
	path := fmt.Sprintf("/proc/%d/statm", pid)
	page := int64(os.Getpagesize())
	t := time.NewTicker(40 * time.Millisecond)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			b, err := os.ReadFile(path)
			if err != nil {
				return // процесс уже завершился
			}
			fields := strings.Fields(string(b))
			if len(fields) < 2 {
				continue
			}
			if rss, err := strconv.ParseInt(fields[1], 10, 64); err == nil && rss*page > limit {
				onExceed()
				return
			}
		}
	}
}
