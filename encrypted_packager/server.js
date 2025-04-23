const express = require("express");
const morgan = require("morgan");
const app = express();
const PORT = 8180;
const fs = require("fs");
const axios = require("axios");
const { DOMParser } = require("xmldom");

app.use(morgan("dev"));
let adpresent = false;
// Middleware
app.use(express.raw({ type: "*/*", limit: "50mb" }));

const spoofHeaders = {
  "X-Forwarded-For": "59.178.74.184",
  Origin: "https://watch.tataplay.com",
  Referer: "https://watch.tataplay.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
};

// Middleware to parse JSON requests
const path = require("path");

// Serve all files in the current directory
app.use(express.static(path.join(__dirname)));

app.use(express.json());

const { XMLParser } = require("fast-xml-parser");

const insertAdIntoMPD = (mpdText) => {
  // Initialize the XML parser
  const parser = new XMLParser();
  let mpd;

  try {
    // Parse the MPD text into an object
    mpd = parser.parse(mpdText);
  } catch (error) {
    console.error("MPD Parsing Error:", error);
    return;
  }

  // Ensure the MPD structure contains periods
  let periods = mpd.MPD.Period;
  if (!periods) {
    console.error("No periods found in the parsed MPD.");
    return;
  }

  // Handle the case where Period is not an array but a single object
  if (!Array.isArray(periods)) {
    periods = [periods]; // Make it an array
  }

  // Extract the first period (assuming single period as per your case)
  const period = periods[0];

  // Helper function to calculate segment durations from SegmentTimeline
  const getSegmentDurations = (period) => {
    const segmentDurations = [];

    if (period.SegmentTimeline && Array.isArray(period.SegmentTimeline.S)) {
      // SegmentTimeline exists, get durations from S elements
      period.SegmentTimeline.S.forEach((segment) => {
        const duration = segment.d;
        if (duration) {
          segmentDurations.push(parseInt(duration));
        }
      });
    } else if (period.SegmentTemplate && period.SegmentTemplate.duration) {
      // Use SegmentTemplate duration if SegmentTimeline is absent
      const duration = period.SegmentTemplate.duration;
      const segmentCount = period.Representation[0].startNumber;
      for (let i = 0; i < segmentCount; i++) {
        segmentDurations.push(parseInt(duration));
      }
    }

    return segmentDurations;
  };

  // Function to create a new ad period
  const createAdPeriod = (startTime) => {
    console.log("I am here");
    return `
      <Period id="ad-${startTime}">
        <AdaptationSet id="1" contentType="video" width="720" height="1280" frameRate="12800/512"
          subsegmentAlignment="true" par="9:16" xmlns:cenc="urn:mpeg:cenc:2013">
          <ContentProtection value="cenc" schemeIdUri="urn:mpeg:dash:mp4protection:2011"
            cenc:default_KID="1ae8ccd0-e4f7-6c23-f026-8756e64f9a3a" />
          <Representation id="1" mimeType="video/mp4" codecs="avc1.64001F" width="720" height="1280" frameRate="25"
            sar="1:1" startWithSAP="1" bandwidth="800000">
            <BaseURL>ad_segment/</BaseURL>
            <SegmentTemplate timescale="1000" media="segment-$Number$.m4s" initialization="init.mp4" startNumber="1" duration="2000"/>
          </Representation>
        </AdaptationSet>
      </Period>
    `;
  };

  // Get segment durations from the single period
  const segmentDurations = getSegmentDurations(period);
  let currentTime = 72;
  let updatedMPD = mpdText;
  console.log(segmentDurations);
  // Go through each segment and insert ads every 60 seconds
  let currentPeriodTime = currentTime;
  for (let duration of segmentDurations) {
    currentPeriodTime += duration;

    // Check if we need to insert an ad (every 60 seconds in this case)
    if (currentPeriodTime >= 60) {
      // Insert ad Period
      const adPeriod = createAdPeriod(currentPeriodTime);
      const periodIndex = updatedMPD.indexOf(
        "</Period>",
        updatedMPD.indexOf("<Period")
      );

      if (periodIndex !== -1) {
        updatedMPD =
          updatedMPD.slice(0, periodIndex) +
          adPeriod +
          updatedMPD.slice(periodIndex);
      }

      // Reset time and continue with the next segment
      currentPeriodTime = 0;
    }
  }

  return updatedMPD;
};

// Path to the JSON file for storing key responses
const keysFilePath = path.join(__dirname, "keys.json");

// Load existing keys from the file or initialize an empty object
let keysCache = {};
try {
  if (fs.existsSync(keysFilePath)) {
    const fileContent = fs.readFileSync(keysFilePath, "utf-8");
    keysCache = fileContent ? JSON.parse(fileContent) : {};
  }
} catch (err) {
  console.error("❌ Failed to load keys.json:", err.message);
  keysCache = {}; // Initialize an empty object if the file is invalid
}
// License Proxy
app.use("/get_license", express.raw({ type: "*/*" }));

app.post("/get_license", async (req, res) => {
  try {
    const decodedBody = Buffer.from(req.body).toString();
    const jsonBody = JSON.parse(decodedBody);
    console.log(jsonBody);

    const kid = jsonBody.kids && jsonBody.kids[0];

    if (!kid) {
      return res.status(400).json({ error: "KID not found in request" });
    }

    // Check if the key ID exists in the cache
    if (keysCache[kid]) {
      console.log("✅ Returning cached key response");
      return res.json(keysCache[kid]);
    }

    // Custom license response for specific KID
    if (kid === "GujM0OT3bCPwJodW5k-aOg") {
      const customResponse = {
        keys: [
          {
            kty: "oct",
            k: "GujM0OT3bCPwJodW5k-aOg",
            kid: "GujM0OT3bCPwJodW5k-aOg",
          },
        ],
        type: "temporary",
      };

      // Save the custom response to the cache and file
      keysCache[kid] = customResponse;
      fs.writeFileSync(keysFilePath, JSON.stringify(keysCache, null, 2));

      return res.json(customResponse);
    }

    // Forward to license server if not custom KID
    const response = await axios.post(
      "https://tp.drmlive-01.workers.dev?id=78",
      jsonBody,
      {
        headers: {
          ...spoofHeaders,
          "Content-Type": "application/json",
        },
      }
    );

    // Save the response to the cache and file
    keysCache[kid] = response.data;
    fs.writeFileSync(keysFilePath, JSON.stringify(keysCache, null, 2));

    res.setHeader("Content-Type", "application/json");
    res.send(response.data);
  } catch (err) {
    console.error("❌ License Proxy Error:", err.message);
    res.status(500).json({ error: "License proxy failed" });
  }
});

// Rewrite MPD so all URLs go through proxy
app.get("/encrypted.mpd", async (req, res) => {
  try {
    const realMPDUrl = "http://192.168.1.68/tataplay/manifest.mpd?id=78";

    let mpdText;

    if (!adpresent) {
      const response = await axios.get(realMPDUrl, {
        headers: spoofHeaders,
      });

      mpdText = response.data;
      // console.log(mpdText);
    } else {
      mpdText = fs.readFileSync("./ad_encrypted.mpd", "utf-8");
      adpresent = false;
    }
    res.setHeader("Content-Type", "application/dash+xml");
    res.set(spoofHeaders);
    // const updatedMPD = insertAdIntoMPD(mpdText);
    // fs.writeFileSync("./encrypted.mpd", mpdText);
    res.send(mpdText);
  } catch (err) {
    console.error("MPD Fetch Error:", err.message);
    res.status(500).send("MPD fetch failed");
  }
});

// Generate M3U Playlist with License URL and MPD
app.get("/playlist.m3u", (req, res) => {
  const playlist = `#EXTINF:-1 tvg-id="ts78" tvg-logo="https://ltsk-cdn.s3.eu-west-1.amazonaws.com/jumpstart/Temp_Live/cdn/HLS/Channel/transparentImages/Star Sports 1 HD.png" group-title="Sports, HD",Star Sports 1 HD
#KODIPROP:inputstream.adaptive.license_type=clearkey
#KODIPROP:inputstream.adaptive.license_key=http://192.168.1.68:8180/get_license
#KODIPROP:inputstream.adaptive.manifest_type=mpd
#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36
http://192.168.1.68:8180/encrypted.mpd|X-Forwarded-For=59.178.74.184&Origin=https://watch.tataplay.com&Referer=https://watch.tataplay.com/`;

  res.setHeader("Content-Type", "application/x-mpegURL");
  res.send(playlist);
});

app.get("/insert-ad", async (req, res) => {
  try {
    const realMPDUrl = "http://192.168.1.68/tataplay/manifest.mpd?id=78"; // Replace with actual MPD URL

    const response = await axios.get(realMPDUrl, {
      headers: spoofHeaders,
    });

    const originalMPD = response.data;
    const updatedMPD = insertAdIntoMPD(originalMPD);
    console.log(updatedMPD);
    res.setHeader("Content-Type", "application/dash+xml");
    res.send(updatedMPD);
  } catch (err) {
    console.error("❌ Insert Ad Error:", err.message);
    res.status(500).send("Failed to insert ad into MPD");
  }
});
app.get("/ad-insert", (req, res) => {
  if (!adpresent) {
    adpresent = true;
  }
  res.json({ adpresent: adpresent });
});

app.listen(PORT, () => {
  console.log(
    `🛰️ DRM proxy server with auto-rewrite running on http://localhost:${PORT}`
  );
});
