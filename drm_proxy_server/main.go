package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
)

var client = &http.Client{} // Shared HTTP client
type Channel struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Logo       string `json:"logo"`
	Group      string `json:"group"`
	LicenseURL string `json:"license_url"`
	StreamURL  string `json:"stream_url"`
}

func loadChannels() ([]Channel, error) {
	// Open the channels.json file
	file, err := os.Open("channels.json")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// Read the contents of the file
	data, err := ioutil.ReadAll(file)
	if err != nil {
		return nil, err
	}

	// Unmarshal JSON data into a slice of Channel structs
	var channels []Channel
	err = json.Unmarshal(data, &channels)
	if err != nil {
		return nil, err
	}
	// log.Println("[INFO] Channels loaded")
	return channels, nil
}

func extractHost(mpUrl string) (string, error) {
	parsedUrl, err := url.Parse(mpUrl)
	if err != nil {
		return "", err
	}
	return parsedUrl.Host, nil
}

func getLicenseId(id string) (Channel, string) {
	channels, err := loadChannels()
	if err != nil {
		log.Fatalf("Error loading channels: %v", err)
		return Channel{}, ""
	}

	// Loop through channels to find the channel where license_url contains the id
	for _, channel := range channels {
		if strings.Contains(channel.LicenseURL, id) {
			// log.Printf("[INFO] Found channel: %+v", channel)
			host, _ := extractHost(channel.StreamURL)
			return channel, host
		}
	}
	return Channel{}, "" // Return empty if not found
}

func main() {
	http.HandleFunc("/mpd-proxy.mpd", func(w http.ResponseWriter, r *http.Request) {
		log.Println("[INFO] Incoming request to /mpd-proxy")
		id := r.URL.Query().Get("id")
		if id == "" {
			log.Println("[ERROR] Missing id param")
			http.Error(w, "Missing id param", http.StatusBadRequest)
			return
		}

		channel, host := getLicenseId(id)

		if channel.StreamURL == "" {
			log.Println("[ERROR] No mpd url found for id", id)
			http.Error(w, "No license url found", http.StatusNotFound)
			return
		}
		req, err := http.NewRequest("GET", channel.StreamURL, nil)
		if err != nil {
			log.Println("[ERROR] Failed to build request:", err)
			http.Error(w, "Request build error", http.StatusInternalServerError)
			return
		}

		// Spoof headers
		req.Header.Set("User-Agent", "OTT Navigator/1.7.2.2 (Linux;Android 13; 7177yu) ExoPlayerLib/2.15.1")
		req.Header.Set("Accept-Encoding", "gzip")
		req.Header.Set("Connection", "Keep-Alive")
		req.Host = host

		log.Println("[INFO] Request Headers:")
		for k, v := range req.Header {
			log.Println(k, ":", v)
		}

		resp, err := client.Do(req)
		if err != nil {
			log.Println("[ERROR] MPD fetch failed:", err)
			http.Error(w, "MPD fetch failed", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		log.Println("[INFO] MPD fetch successful. Status Code:", resp.StatusCode)

		// Read the full body
		buf := new(bytes.Buffer)
		_, err = io.Copy(buf, resp.Body)
		if err != nil {
			log.Println("[ERROR] Failed reading MPD body:", err)
			http.Error(w, "Failed to read MPD", http.StatusInternalServerError)
			return
		}

		originalContent := buf.String()

		// Optional: Fix mixed content issues (HTTP -> HTTPS)
		modified := strings.ReplaceAll(originalContent, "http://", "https://")

		// Return to client
		w.Header().Set("Content-Type", "application/dash+xml")
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write([]byte(modified))
	})

	// http.HandleFunc("/license-proxy", func(w http.ResponseWriter, r *http.Request) {
	// 	log.Println("[INFO] Incoming request to /license-proxy")

	// 	log.Println("[INFO] License request Headers:")
	// 	for k, v := range r.Header {
	// 		log.Println(k, ":", v)
	// 	}
	// 	// Read the body coming from the player
	// 	body, err := io.ReadAll(r.Body)
	// 	log.Println("[INFO] Request body:", string(body))
	// 	if err != nil {
	// 		log.Println("[ERROR] Failed to read request body:", err)
	// 		http.Error(w, "Failed to read request body", http.StatusInternalServerError)
	// 		return
	// 	}

	// 	req, err := http.NewRequest("POST", "https://la.drmlive.net/tp/sling_ck?id=672", bytes.NewReader(body))
	// 	if err != nil {
	// 		log.Println("[ERROR] Failed to build license request:", err)
	// 		http.Error(w, "Request build error", http.StatusInternalServerError)
	// 		return
	// 	}

	// 	// Spoof headers
	// 	req.Header.Set("User-Agent", "OTT Navigator/1.7.2.2 (Linux;Android 13; 7177yu) ExoPlayerLib/2.15.1")
	// 	req.Header.Set("Content-Type", "application/json")
	// 	req.Header.Set("Accept-Encoding", "gzip")
	// 	req.Header.Set("Connection", "Keep-Alive")
	// 	req.Header.Set("Host", "la.drmlive.net")

	// 	resp, err := client.Do(req)
	// 	if err != nil {
	// 		log.Println("[ERROR] License request failed:", err)
	// 		http.Error(w, "License request failed", http.StatusBadGateway)
	// 		return
	// 	}
	// 	defer resp.Body.Close()

	// 	log.Println("[INFO] License response received. Status Code:", resp.StatusCode)
	// 	log.Println("[INFO] Response Body:", resp.Body)
	// 	// Return the license response to the client
	// 	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	// 	w.WriteHeader(resp.StatusCode)
	// 	_, _ = io.Copy(w, resp.Body)
	// })

	http.HandleFunc("/proxy/license", func(w http.ResponseWriter, r *http.Request) {
		log.Println("[INFO] Incoming request to /license-proxy")
		id := r.URL.Query().Get("id")
		if id == "" {
			log.Println("[ERROR] Missing id param")
			http.Error(w, "Missing id param", http.StatusBadRequest)
			return
		}
		// Read the body from the original player request
		playerBody, err := io.ReadAll(r.Body)
		if err != nil {
			log.Println("[ERROR] Failed to read player request body:", err)
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		channel, host := getLicenseId(id)
		log.Println("[INFO] Channel:", channel.Name, "License URL:", channel.LicenseURL, "Body:", r.Body)
		// Send that same body to the license server
		req, err := http.NewRequest("POST", channel.LicenseURL, bytes.NewReader(playerBody))
		if err != nil {
			log.Println("[ERROR] Failed to build license request:", err)
			http.Error(w, "Request build error", http.StatusInternalServerError)
			return
		}

		// Copy headers exactly
		req.Header.Set("User-Agent", r.Header.Get("User-Agent"))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept-Encoding", "gzip")
		req.Header.Set("Connection", "Keep-Alive")
		req.Header.Set("Host", host)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			log.Println("[ERROR] License request failed:", err)
			http.Error(w, "License request failed", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		// Decompress if response is gzipped
		var responseBody []byte
		if resp.Header.Get("Content-Encoding") == "gzip" {
			gr, err := gzip.NewReader(resp.Body)
			if err != nil {
				log.Println("[ERROR] Failed to decompress gzip response:", err)
				http.Error(w, "Decompression error", http.StatusInternalServerError)
				return
			}
			defer gr.Close()
			responseBody, err = io.ReadAll(gr)
			log.Println("[INFO] Channel:", channel.Name, "License URL:", channel.LicenseURL, "Response Key:", responseBody)
		} else {
			responseBody, err = io.ReadAll(resp.Body)
		}
		if err != nil {
			log.Println("[ERROR] Failed to read license response:", err)
			http.Error(w, "Read response error", http.StatusInternalServerError)
			return
		}

		// Set proper headers for JSON response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(responseBody)
	})

	http.HandleFunc("/playlist.m3u", func(w http.ResponseWriter, r *http.Request) {
		log.Println("[INFO] Incoming request to /proxy_playlist.m3u")
		playlistData, err := os.ReadFile("proxy_playlist.m3u")
		if err != nil {
			log.Println("[ERROR] Failed to read proxy playlist:", err)
			http.Error(w, "Proxy playlist read error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/x-mpegURL")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(playlistData)
	})

	log.Println("✅ Proxy server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
