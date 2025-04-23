const fs = require("fs");
const readline = require("readline");

async function parsePlaylist(filePath, outputPath) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const channels = [];
  let currentChannel = {
    id: "",
    name: "",
    logo: "",
    group: "",
    license_url: "",
    stream_url: "",
  };

  for await (const line of rl) {
    if (line.startsWith("#KODIPROP:inputstream.adaptive.license_key=")) {
      currentChannel.license_url = line
        .replace("#KODIPROP:inputstream.adaptive.license_key=", "")
        .trim();
    } else if (line.startsWith("#EXTINF")) {
      const idMatch = line.match(/tvg-id="?([^"\s]+)"?/);
      const nameMatch = line.split(",")[1]?.trim();
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);

      currentChannel.id = idMatch?.[1] || "";
      currentChannel.name = nameMatch || "";
      currentChannel.logo = logoMatch?.[1] || "";
      currentChannel.group = groupMatch?.[1] || "";
    } else if (line.startsWith("http") && line.includes(".mpd")) {
      currentChannel.stream_url = line.trim();
      channels.push({ ...currentChannel }); // Push a copy

      // Reset for next channel
      currentChannel = {
        id: "",
        name: "",
        logo: "",
        group: "",
        license_url: "",
        stream_url: "",
      };
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(channels, null, 2));
  console.log(`✅ Parsed ${channels.length} channels and saved to ${outputPath}`);
}

parsePlaylist("./playlist.m3u", "./channels2.json").catch(console.error);
