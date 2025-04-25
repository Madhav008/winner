package main

import (
	"bufio"
	"encoding/json"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/logger"
)

var config = map[string]interface{}{
	"port":    "8180",
	"host":    "http://192.168.1.68:8180",
	"drmHost": "http://192.168.1.124:8181",
}

var client = &http.Client{
	Timeout: 10 * time.Second,
}

// Cache structure
var (
	cache      = make(map[string][]byte) // In-memory cache
	cacheMutex = &sync.Mutex{}           // Mutex for thread-safe access
	cacheFile  = "cache.json"            // File to store the cache
)

// PlaylistEntry represents a single entry in the playlist
type PlaylistEntry struct {
	Title         string
	TvgID         string
	TvgLogo       string
	GroupTitle    string
	LicenseType   string
	LicenseKey    string
	ManifestType  string
	UserAgent     string
	URL           string
	AdditionalOpt string
}

// LoadCache loads the cache from the JSON file
func LoadCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	file, err := os.Open(cacheFile)
	if err != nil {
		if os.IsNotExist(err) {
			return // No cache file exists, skip loading
		}
		log.Println("Error opening cache file:", err)
		return
	}
	defer file.Close()

	data, err := ioutil.ReadAll(file)
	if err != nil {
		log.Println("Error reading cache file:", err)
		return
	}

	err = json.Unmarshal(data, &cache)
	if err != nil {
		log.Println("Error unmarshalling cache file:", err)
	}
}

// SaveCache saves the cache to the JSON file
func SaveCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	data, err := json.Marshal(cache)
	if err != nil {
		log.Println("Error marshalling cache:", err)
		return
	}

	err = ioutil.WriteFile(cacheFile, data, 0644)
	if err != nil {
		log.Println("Error writing cache file:", err)
	}
}

// ParsePlaylist parses an M3U playlist string and returns a slice of PlaylistEntry
func ParsePlaylist(content string) ([]PlaylistEntry, error) {
	var entries []PlaylistEntry
	var currentEntry PlaylistEntry

	scanner := bufio.NewScanner(strings.NewReader(content))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines
		if line == "" {
			continue
		}

		// Parse metadata lines
		if strings.HasPrefix(line, "#EXTINF:") {
			// Extract metadata from the #EXTINF line
			currentEntry = PlaylistEntry{} // Reset the current entry
			metadata := strings.SplitN(line, ",", 2)
			if len(metadata) == 2 {
				currentEntry.Title = strings.TrimSpace(metadata[1])
			}

			// Extract attributes like tvg-id, tvg-logo, and group-title
			attributes := strings.Split(metadata[0], " ")
			for _, attr := range attributes {
				if strings.Contains(attr, "tvg-id=") {
					currentEntry.TvgID = strings.Trim(attr[len("tvg-id="):], `"`)
				} else if strings.Contains(attr, "tvg-logo=") {
					currentEntry.TvgLogo = strings.Trim(attr[len("tvg-logo="):], `"`)
				} else if strings.Contains(attr, "group-title=") {
					currentEntry.GroupTitle = strings.Trim(attr[len("group-title="):], `"`)
				}
			}
		} else if strings.HasPrefix(line, "#KODIPROP:inputstream.adaptive.license_type=") {
			currentEntry.LicenseType = strings.TrimPrefix(line, "#KODIPROP:inputstream.adaptive.license_type=")
		} else if strings.HasPrefix(line, "#KODIPROP:inputstream.adaptive.license_key=") {
			currentEntry.LicenseKey = strings.TrimPrefix(line, "#KODIPROP:inputstream.adaptive.license_key=")
		} else if strings.HasPrefix(line, "#KODIPROP:inputstream.adaptive.manifest_type=") {
			currentEntry.ManifestType = strings.TrimPrefix(line, "#KODIPROP:inputstream.adaptive.manifest_type=")
		} else if strings.HasPrefix(line, "#EXTVLCOPT:http-user-agent=") {
			currentEntry.UserAgent = strings.TrimPrefix(line, "#EXTVLCOPT:http-user-agent=")
		} else if !strings.HasPrefix(line, "#") {
			// If it's not a comment, treat it as the URL
			parts := strings.SplitN(line, "|", 2)
			currentEntry.URL = parts[0]
			if len(parts) > 1 {
				currentEntry.AdditionalOpt = parts[1]
			}

			// Add the completed entry to the list
			entries = append(entries, currentEntry)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return entries, nil
}

func main() {
	LoadCache()
	defer SaveCache() // Save the cache on shutdown

	// Initialize a new Fiber app
	app := fiber.New()
	app.Use(logger.New(logger.Config{
		Format:     "[${time}] ${status} - ${method} ${path}${latency}\n",
		TimeFormat: "2006-01-02 15:04:05",
		TimeZone:   "Local",
	}))

	// Define a route for the GET method on the root path '/playlist.m3u'
	app.Get("/playlist.m3u", func(c fiber.Ctx) error {

		// Get the host from the incoming request
		host := c.Get("Host")
		log.Println(host)
		scheme := c.Get("Scheme")
		log.Println(scheme)

		// Fetch the playlist from the server
		resp, err := client.Get(config["drmHost"].(string) + "/playlist.php")
		if err != nil {
			log.Println("Error fetching playlist:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}
		defer resp.Body.Close()

		// Read the response body
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			log.Println("Error reading response body:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}

		entries, err := ParsePlaylist(string(body))
		if err != nil {
			panic(err)
		}
		// Replace URL and LicenseKey
		for i, entry := range entries {
			// Replace the base URL
			entries[i].URL = strings.Replace(entry.URL, "http://192.168.1.124:8181/", "https://"+host+"", 1)

			// Replace the license key URL
			entries[i].LicenseKey = strings.Replace(entry.LicenseKey, "https://tp.drmlive-01.workers.dev", "https://"+host+"/get_license", 1)
		}
		// Process the entries (e.g., modify URLs or metadata if needed)
		var updatedBody strings.Builder
		for _, entry := range entries {
			updatedBody.WriteString("#EXTINF:-1 tvg-id=\"" + entry.TvgID + "\" tvg-logo=\"" + entry.TvgLogo + "\" group-title=\"" + entry.GroupTitle + "\"," + entry.Title + "\n")
			updatedBody.WriteString("#KODIPROP:inputstream.adaptive.license_type=" + entry.LicenseType + "\n")
			updatedBody.WriteString("#KODIPROP:inputstream.adaptive.license_key=" + entry.LicenseKey + "\n")
			updatedBody.WriteString("#KODIPROP:inputstream.adaptive.manifest_type=" + entry.ManifestType + "\n")
			updatedBody.WriteString("#EXTVLCOPT:http-user-agent=" + entry.UserAgent + "\n")
			updatedBody.WriteString(entry.URL + "|" + entry.AdditionalOpt + "\n\n")
		}

		// Return the processed playlist to the client
		return c.SendString(updatedBody.String())
	})

	app.Post("/get_license", func(c fiber.Ctx) error {
		id := c.Query("id")
		if id == "" {
			log.Println("Missing 'id' query parameter")
			return c.Status(fiber.StatusBadRequest).SendString("Missing 'id' query parameter")
		}

		// Step 1: Read base64-encoded request body
		body := c.Body()

		log.Println("Channel License:", string(body), id)
		// Step 2: Unmarshal into a dynamic map
		var data map[string]interface{}
		if err := json.Unmarshal(body, &data); err != nil {
			log.Println("Invalid JSON:", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid JSON body",
			})
		}
		kids, ok := data["kids"].([]interface{})
		if !ok || len(kids) == 0 {
			log.Println("Missing or invalid 'kids' array in JSON body")
			return c.Status(fiber.StatusBadRequest).SendString("Missing or invalid 'kids' array in JSON body")
		}

		kid, ok := kids[0].(string)
		if !ok {
			log.Println("Invalid 'kid' in array")
			return c.Status(fiber.StatusBadRequest).SendString("Invalid 'kid' in array")
		}

		key := id + "_" + kid

		// Step 4: Check in-memory cache
		cacheMutex.Lock()
		if license, found := cache[key]; found {
			cacheMutex.Unlock()
			log.Println("License found in in-memory cache")
			return c.Status(fiber.StatusOK).Send(license)
		}
		cacheMutex.Unlock()

		// Step 5: Load cache from file and check again
		LoadCache()
		cacheMutex.Lock()
		if license, found := cache[key]; found {
			cacheMutex.Unlock()
			log.Println("License found in file cache")
			return c.Status(fiber.StatusOK).Send(license)
		}
		cacheMutex.Unlock()

		// Step 7: Fetch license from upstream server
		licenseReq, err := http.NewRequest("POST", "http://tp.drmlive-01.workers.dev/get_license?id="+id, strings.NewReader(string(body)))
		if err != nil {
			log.Println("Error creating license request:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}
		licenseReq.Header.Set("Content-Type", "application/octet-stream")

		resp, err := client.Do(licenseReq)
		if err != nil {
			log.Println("Error fetching license:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}
		defer resp.Body.Close()

		licenseBody, err := io.ReadAll(resp.Body)
		if err != nil {
			log.Println("Error reading license response body:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}
		// Step 7: Cache and respond
		cacheMutex.Lock()
		cache[key] = licenseBody
		cacheMutex.Unlock()
		SaveCache()

		return c.Status(resp.StatusCode).Send(licenseBody)
	})

	app.Get("/manifest.mpd", func(c fiber.Ctx) error {
		id := c.Query("id")
		if id == "" {
			log.Println("Missing 'id' query parameter")
			return c.Status(fiber.StatusBadRequest).SendString("Missing 'id' query parameter")
		}

		//Hit the request to drmhost
		req, err := http.NewRequest("GET", config["drmHost"].(string)+"/manifest.mpd?id="+id, nil)
		if err != nil {
			log.Println("Error creating request:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}

		resp, err := client.Do(req)
		if err != nil {
			log.Println("Error fetching manifest:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}
		defer resp.Body.Close()

		manifestBody, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			log.Println("Error reading manifest response:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}

		host := c.Get("Host")

		// Parse the mpd
		updatedManifest := strings.ReplaceAll(string(manifestBody), "https://bpaita2.akamaized.net", "https"+"://"+host+"/proxy/https://bpaita2.akamaized.net")
		// log.Println(updatedManifest)

		manifestBytes := []byte(updatedManifest)

		// Return the manifest response to the client
		return c.Status(resp.StatusCode).Send(manifestBytes)
	})

	app.Get("/proxy/*", func(c fiber.Ctx) error {

		// Extract the query parameters
		fullURL := c.Request().RequestURI()

		fullURL = []byte(strings.TrimPrefix(string(fullURL), "/proxy/"))
		updatedUrl := strings.Replace(string(fullURL), "https:/bpaita2.akamaized.net", "https://bpaita2.akamaized.net", 1)

		log.Println("Full URL:")
		log.Println(string(updatedUrl))

		// Create a new HTTP request to the provided URL
		req, err := http.NewRequest("GET", string(updatedUrl), nil)
		if err != nil {
			log.Println("Error creating request:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}

		// Remove the "/proxy" prefix from the parsed URL path
		// parsedUrl.Path = strings.TrimPrefix(parsedUrl.Path, "/proxy")

		// Add the required headers
		req.Header.Add("Accept-Encoding", "identity")
		req.Header.Add("Connection", "Keep-Alive")
		req.Header.Add("Host", "bpaita2.akamaized.net")
		req.Header.Add("Origin", "https://watch.tataplay.com")
		req.Header.Add("Referer", "https://watch.tataplay.com/")
		req.Header.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36")
		req.Header.Add("X-Forwarded-For", "59.178.74.184")

		// Send the request using the HTTP client
		resp, err := client.Do(req)
		if err != nil {
			log.Println("Error sending request:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}
		defer resp.Body.Close()

		// Read the response body
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			log.Println("Error reading response body:", err)
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
		}

		// Forward the response to the client
		return c.Status(resp.StatusCode).Send(body)
	})
	// Start the server on the configured port
	port := config["port"]
	log.Fatal(app.Listen(":" + port.(string)))
}
