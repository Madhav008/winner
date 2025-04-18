package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// Struct to hold clearkey responses (optional)
type Key struct {
	KID string `json:"kid"`
	Key string `json:"key"`
}

type LicenseResponse struct {
	Keys []Key `json:"keys"`
}

// OTT Navigator static headers
var ottHeaders = map[string]string{
	"Accept-Encoding": "gzip",
	"Connection":      "Keep-Alive",
	"Host":            "la.drmlive.net",
	"User-Agent":      "OTT Navigator/1.7.2.2 (Linux;Android 13; en; 7177yu)",
}

// Middleware to forward the headers from the OTT Navigator app and inject static headers
func makeRequestWithNavigatorHeaders(method, targetURL string, originalReq *http.Request) (*http.Response, error) {
	client := &http.Client{}
	req, err := http.NewRequest(method, targetURL, nil)
	if err != nil {
		return nil, err
	}

	// Inject static OTT headers ONLY
	for k, v := range ottHeaders {
		req.Header.Set(k, v)
	}

	// Log the request details (headers injected)
	log.Printf("Sending request to %s with headers: %v\n", targetURL, req.Header)

	// Perform the request
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	// Log the response headers
	log.Printf("Received response from %s with headers: %v\n", targetURL, resp.Header)

	return resp, nil
}

// Handler to fetch and rewrite playlist to use your proxy URLs
func handlePlaylistProxy(w http.ResponseWriter, r *http.Request) {
	playlistURL := r.URL.Query().Get("url")
	if playlistURL == "" {
		http.Error(w, "Missing url param", http.StatusBadRequest)
		return
	}

	// Fetch the original playlist
	resp, err := makeRequestWithNavigatorHeaders("GET", playlistURL, r)
	if err != nil {
		http.Error(w, "Failed to fetch playlist: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	var output strings.Builder

	for scanner.Scan() {
		line := scanner.Text()

		// Replace license_key=... with your proxy
		if strings.Contains(line, "license_key=") {
			// Extract id from original URL
			if idx := strings.Index(line, "id="); idx != -1 {
				id := strings.Split(line[idx:], "&")[0][3:] // crude id=xyz extraction
				line = `#KODIPROP:inputstream.adaptive.license_key=http://` + r.Host + `/proxy/license?id=` + id
			}
		}

		// Replace MPD URLs with your proxy
		if strings.HasSuffix(line, ".mpd") {
			parts := strings.Split(line, "/")
			mpdName := parts[len(parts)-1]
			line = `http://` + r.Host + `/proxy/mpd?url=` + mpdName

			
		}
		output.WriteString(line + "\n")
	}

	if err := scanner.Err(); err != nil {
		http.Error(w, "Failed to scan playlist", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/x-mpegURL")
	w.Write([]byte(output.String()))
}

// Proxy request and forward headers from client (e.g., OTT Navigator)
func handleLicense(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "Missing id param", http.StatusBadRequest)
		return
	}

	licenseURL := "https://mix.drmlive.net/mix/sports_key.php?id=" + url.QueryEscape(id)

	resp, err := makeRequestWithNavigatorHeaders("GET", licenseURL, r)
	if err != nil {
		http.Error(w, "Failed to fetch license: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read license body", http.StatusInternalServerError)
		return
	}

	// Optional: parse and log clearkeys
	var license LicenseResponse
	if err := json.Unmarshal(body, &license); err == nil {
		for _, key := range license.Keys {
			fmt.Printf("Captured KID: %s | KEY: %s\n", key.KID, key.Key)
			// Optional: Save to DB here
		}
	}

	// Forward license response to client
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

// Proxy for DASH MPD URL
func handleMPD(w http.ResponseWriter, r *http.Request) {
	// Example: /proxy/mpd?url=sportsss1.mpd
	path := r.URL.Query().Get("url")
	if path == "" {
		http.Error(w, "Missing url param", http.StatusBadRequest)
		return
	}

	mpdURL := "https://mix.drmlive.net/mix/" + path

	resp, err := makeRequestWithNavigatorHeaders("GET", mpdURL, r)
	if err != nil {
		http.Error(w, "Failed to fetch MPD: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/dash+xml")
	io.Copy(w, resp.Body)
}

func main() {
	http.HandleFunc("/proxy/license", handleLicense)
	http.HandleFunc("/proxy/mpd", handleMPD)
	http.HandleFunc("/proxy/playlist", handlePlaylistProxy)

	fmt.Println("🎯 DRM Proxy Server running at :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
