package main

import (
	"bytes"
	"compress/gzip"
	hex2 "encoding/hex"
	"fmt"
	"github.com/miekg/dns"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func getIp(hostname string) string {
	dnsServer := "127.0.0.1:1053"

	m := new(dns.Msg)
	m.SetQuestion(hostname, dns.TypeA)

	in, err := dns.Exchange(m, dnsServer)
	if err != nil {
		fmt.Printf("DNS query failed: %v\n", err)
		return ""
	}

	return in.Answer[0].String()
}

func getSessionId(filename string) string {
	cleanFilename := strings.ReplaceAll(filename, ".", "_")

	response := getIp(cleanFilename + ".s.domain.ltd.")
	responseElements := strings.Split(response, ".")
	return responseElements[len(responseElements)-1]
}

func endSession(sessionId string) {
	getIp("1." + sessionId + ".domain.ltd.")
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go <filepath>")
		os.Exit(1)
	}

	filePath := os.Args[1]

	sourceFile, err := os.Open(filePath)
	if err != nil {
		panic(err)
	}
	defer sourceFile.Close()

	var buf bytes.Buffer

	gzipWriter := gzip.NewWriter(&buf)

	_, err = io.Copy(gzipWriter, sourceFile)
	if err != nil {
		panic(err)
	}

	if err := gzipWriter.Close(); err != nil {
		panic(err)
	}

	hexString := hex2.EncodeToString(buf.Bytes())

	// start session
	sessionId := getSessionId(filepath.Base(filePath))

	println("Starting file transfer")

	maxQuerySize := 189
	chunkSize := 63
	for i := 0; i < len(hexString); i += maxQuerySize {
		end := i + maxQuerySize
		if end > len(hexString) {
			end = len(hexString)
		}

		row := hexString[i:end]

		chunk1 := row[0:min(chunkSize, len(row))]

		query := strconv.Itoa(i) + "." + sessionId + ".domain.ltd."

		if chunkSize*2 <= len(row) {
			chunk3 := row[chunkSize*2 : min(chunkSize*3, len(row))]
			query = chunk3 + "." + query
		} else {
			query = "_." + query
		}

		if chunkSize <= len(row) {
			chunk2 := row[chunkSize:min(chunkSize*2, len(row))]
			query = chunk2 + "." + query
		} else {
			query = "_." + query
		}

		if chunk1 != "" {
			query = chunk1 + "." + query
		} else {
			query = "_." + query
		}

		getIp(query)
	}

	endSession(sessionId)

	println("Transfer finished")
}
