const fs = require("fs");

function generatePlaylist(jsonPath, outputPath, host = "drm.ipl2025.space") {
  const channels = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const lines = ["#EXTM3U"];

  channels.forEach((channel) => {
    lines.push(
      `#EXTINF:-1 tvg-id="${channel.id}" tvg-logo="${channel.logo}" group-title="${channel.group}",${channel.name}`
    );

    let licenseId = null;
    console.log(`Processing channel: ${channel.name}`);
    if (channel.license_url) {
      const licenseIdMatch = channel.license_url.match(/id=([\w-]+)/);  // Allow non-numeric IDs too
      if (licenseIdMatch) {
        licenseId = licenseIdMatch[1];
        console.log(`Found license URL: ${channel.license_url} with id: ${licenseId}`);
        lines.push(`#KODIPROP:inputstream.adaptive.license_type=clearkey`);
        lines.push(`#KODIPROP:inputstream.adaptive.manifest_type=mpd`);
        lines.push(
          `#KODIPROP:inputstream.adaptive.license_key=http://${host}/proxy/license?id=${licenseId}`
        );
      } else {
        console.warn(`License URL in channel "${channel.name}" is not in expected format.`);
      }
    } else {
      console.warn(`No license URL found for channel "${channel.name}"`);
    }

    let streamUrl = channel.stream_url;
    if (licenseId) {
      streamUrl = `http://${host}/mpd-proxy.mpd?id=${licenseId}`;
    }

    lines.push(streamUrl);
    lines.push("");
  });

  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ Playlist written to ${outputPath}`);
}

generatePlaylist("./channels.json", "./proxy_playlist.m3u");
