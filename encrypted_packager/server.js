const express = require('express');
const app = express();
const port = 8000;

// Predefined key_id and key (simplified version)
const key_id = "1ae8ccd0e4f76c23f0268756e64f9a3a";
const key = "1ae8ccd0e4f76c23f0268756e64f9a3a";

// Middleware to parse raw data (if needed for other purposes)
app.use(express.raw({ type: "*/*", limit: "500mb" }));

// Serve encrypted content and MPD file from the current directory
app.use(express.static("./")); // This will serve everything in the current directory

// License request endpoint - returning the key_id and key
app.post("/widevine-license", (req, res) => {
  try {
    // License response with key_id and key
    const license = {
      "keys": [
        {
          "kty": "oct",
          "kid": key_id,
          "k": key
        }
      ]
    };

    // Send the license as a JSON response
    res.json(license);
  } catch (error) {
    console.error("License error:", error);
    res.status(500).send("License error");
  }
});

// Serve the MPD file (if needed in a custom route)
app.get("/encrypted.mpd", (req, res) => {
  res.sendFile(__dirname + "/encrypted.mpd"); // Adjust path as necessary
});

// Serve the MPD file (if needed in a custom route)
app.get("/encrypted_video.mp4", (req, res) => {
  res.sendFile(__dirname + "/encrypted_video.mp4"); // Adjust path as necessary
});
// Starting the server
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
