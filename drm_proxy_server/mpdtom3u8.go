package main

import (
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"os"
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
	DefaultKeyID string `xml:"cenc\\:default_KID,attr"` // Handle namespace prefix with escaped colon
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

	// Use pointer to pass MPD by reference and modify it in-place
	var mpd MPD
	err = xml.Unmarshal(data, &mpd)
	if err != nil {
		panic(err)
	}

	// Print the original values for verification
	fmt.Println("Original MPD Content:")
	fmt.Println(mpd)

	// Modify only specific parts of the MPD
	modifyMPD(&mpd)

	// After modification, print the updated MPD content
	fmt.Println("\nModified MPD Content:")
	updatedMPD, err := xml.MarshalIndent(mpd, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(updatedMPD))
}

// modifyMPD modifies only the required parts of the MPD
func modifyMPD(mpd *MPD) {
	// For example, modify BaseURL of the first AdaptationSet
	if len(mpd.Period.AdaptationSets) > 0 {
		rep := &mpd.Period.AdaptationSets[0].Representations[0]
		// Modify the BaseURL with a proxy
		rep.BaseURL = "http://drm.ipl2025.space?url=" + rep.BaseURL

		// Modify ContentProtection if it matches a condition (e.g., ClearKey UUID)
		if rep.ContentProtection.SchemeIdUri == "urn:uuid:edef8ba9-79d6-4ace-a3c8-d6d5c6c69c3e" { // ClearKey UUID
			// Set the LicenseURL and DefaultKeyID for ClearKey protection
			rep.ContentProtection.LicenseURL = "http://license.server.com"
			rep.ContentProtection.DefaultKeyID = "12345678-90ab-cdef-1234-567890abcdef"
		}
	}
}
