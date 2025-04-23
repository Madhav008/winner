const express = require("express");
const axios = require("axios");
const fs = require("fs");
const morgan = require("morgan"); // <- Added morgan
const app = express();
const port = 8080;

// Middleware
app.use(morgan("dev"));

// Static OTT Navigator headers
let ottHeaders = {
  "Accept-Encoding": "gzip",
  Connection: "Keep-Alive",
  Host: "mix.drmlive.net",
  //   Range: "bytes=1015-61345",
  "User-Agent": "OTT Navigator/1.7.2.2 (Linux;Android 13; en; 7177yu)",
};

// Helper to forward requests with OTT headers
const makeRequestWithNavigatorHeaders = async (
  method,
  targetURL,
  additionalHeaders = {}
) => {
  try {
    const headers = { ...ottHeaders, ...additionalHeaders };
    const response = await axios({
      method,
      url: targetURL,
      headers,
      responseType: "text",
    });
    return response;
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
};
// Load channels from channels.json
const loadChannels = () => {
  const data = fs.readFileSync("./channels.json", "utf-8");
  return JSON.parse(data);
};

// Route to fetch and serve the playlist as-is
app.get("/proxy/playlist", (req, res) => {
  try {
    const playlistData = fs.readFileSync("./proxy_playlist.m3u", "utf-8");
    res.setHeader("Content-Type", "application/x-mpegURL");
    res.send(playlistData);
  } catch (err) {
    res.status(500).send("Error reading playlist: " + err.message);
  }
});

// Route to fetch and serve the license data
app.get("/proxy/license", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send("Missing id param");

  const channels = loadChannels();
  const channel = channels.find((ch) => ch.id === id);

  if (!channel) {
    return res.status(404).send("Channel not found");
  }

  try {
    const licenseURL = channel.license_url;
    const response = await makeRequestWithNavigatorHeaders("GET", licenseURL);

    // Forward the response headers and data
    res.set(response.headers);
    res.setHeader("Content-Type", "application/json");
    res.send(response.data);
  } catch (err) {
    res.status(500).send("Error fetching license: " + err.message);
  }
});

// Route to proxy individual stream assets
app.get("/proxy/:asset", async (req, res) => {
  const asset = req.params.asset;
  if (asset.includes("mpd")) {
    return manifestRequest(req, res);
  }

  const channels = loadChannels();

  try {
    const baseUrl = new URL(channels[0].stream_url);
    const redirectHost =
      baseUrl.origin + baseUrl.pathname.replace(/drmlive\.mpd$/, "");
    const targetUrl = `${redirectHost}${asset}`;

    const additionalHeaders = {
      ...req.headers,
    };
    delete additionalHeaders.host;
    console.log(additionalHeaders);
    const response = await makeRequestWithNavigatorHeaders(
      "GET",
      targetUrl,
      additionalHeaders
    );

    res.set(response.headers);
    res.send(response.data);
  } catch (err) {
    res.status(500).send("Error processing stream URL: " + err.message);
  }
});

// Route to fetch and serve the MPD data
const manifestRequest = async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send("Missing id param");

  const channels = loadChannels();
  const channel = channels.find((ch) => ch.id === id);

  if (!channel) {
    return res.status(404).send("Channel not found");
  }
  try {
    const mpdURL = channel.stream_url;
    const response = await makeRequestWithNavigatorHeaders("GET", mpdURL);

    // Forward the response headers and data
    res.set(response.headers);
    res.setHeader("Content-Type", "application/dash+xml");
    res.send(response.data);
  } catch (err) {
    res.status(500).send("Error fetching MPD: " + err.message);
  }
};

app.listen(port, () => {
  console.log(`🎯 DRM Proxy Server running at http://localhost:${port}`);
});
