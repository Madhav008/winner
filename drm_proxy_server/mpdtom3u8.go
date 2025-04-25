package main

import (
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
)

type MPD struct {
	XMLName                   xml.Name `xml:"MPD"`
	Period                    Period   `xml:"Period"`
	MediaPresentationDuration string   `xml:"mediaPresentationDuration,attr"`
}

type Period struct {
	AdaptationSets []AdaptationSet `xml:"AdaptationSet"`
	BaseUrl        string          `xml:"BaseURL"`
}

type AdaptationSet struct {
	Representations []Representation `xml:"Representation"`
}

type Representation struct {
	ID                string            `xml:"id,attr"`
	Bandwidth         string            `xml:"bandwidth,attr"`
	BaseURL           string            `xml:"BaseURL"`
	SegmentTemplate   SegmentTemplate   `xml:"SegmentTemplate"`
	ContentProtection ContentProtection `xml:"ContentProtection"`
}

type ContentProtection struct {
	SchemeIdUri  string `xml:"schemeIdUri,attr"`
	LicenseURL   string `xml:"licenseURL,attr"`
	DefaultKeyID string `xml:"cenc:default_KID,attr"`
}

type SegmentTemplate struct {
	Media           string          `xml:"media,attr"`
	Initialization  string          `xml:"initialization,attr"`
	StartNumber     int             `xml:"startNumber,attr"`
	Duration        int             `xml:"duration,attr"`
	Timescale       int             `xml:"timescale,attr"`
	SegmentTimeline SegmentTimeline `xml:"SegmentTimeline"`
}

type SegmentTimeline struct {
	S []struct {
		T int `xml:"t,attr"`
		D int `xml:"d,attr"`
		R int `xml:"r,attr"`
	}
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run mpd2m3u8.go <input.mpd>")
		return
	}

	mpdFile := os.Args[1]
	data, err := ioutil.ReadFile(mpdFile)
	if err != nil {
		panic(err)
	}

	var mpd MPD
	err = xml.Unmarshal(data, &mpd)
	if err != nil {
		panic(err)
	}

	// Assume one AdaptationSet and one Representation for simplicity
	rep := mpd.Period.BaseUrl

	proxyHost := "http://drm.ipl2025.space?url=" // Define the proxy host
	rep = proxyHost + rep                        // Concatenate the proxy host with the base URL

	// Marshal the MPD struct back to XML
	mpdBytes, err := xml.MarshalIndent(mpd, "", "  ")
	if err != nil {
		panic(err)
	}

	// Write the MPD XML to stdout
	fmt.Println(string(mpdBytes))
	// durationSec := float64(tpl.Duration) / float64(tpl.Timescale)

	// // Add ClearKey DRM protection if ContentProtection is found
	// if rep.ContentProtection.SchemeIdUri == "urn:uuid:edef8ba9-79d6-4ace-a3c8-d6d5c6c69c3e" { // ClearKey UUID
	// 	fmt.Printf("#EXT-X-KEY:METHOD=NONE,URI=\"%s\",KEYID=%s\n", rep.ContentProtection.LicenseURL, rep.ContentProtection.DefaultKeyID)
	// }

	// fmt.Println("#EXTM3U")
	// fmt.Println("#EXT-X-VERSION:3")
	// fmt.Printf("#EXT-X-TARGETDURATION:%.0f\n", durationSec)
	// fmt.Printf("#EXT-X-MEDIA-SEQUENCE:%d\n", tpl.StartNumber)

	// // Generate 10 segments as example
	// for i := 0; i < 10; i++ {
	// 	num := tpl.StartNumber + i
	// 	segment := tpl.Media
	// 	segment = replacePlaceholder(segment, "$Number$", strconv.Itoa(num))
	// 	fmt.Printf("#EXTINF:%.3f,\n", durationSec)
	// 	fmt.Println(segment)
	// }

	// fmt.Println("#EXT-X-ENDLIST")
}

// Replace placeholder in the segment template (e.g., $Number$ with actual segment number)
func replacePlaceholder(template, placeholder, value string) string {
	return strings.Replace(template, placeholder, value, -1)
}
