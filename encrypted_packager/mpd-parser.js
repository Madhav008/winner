const { XMLParser } = require("fast-xml-parser");
const fs = require("fs");

const insertAdIntoMPD = (mpdText) => {
  // Initialize the XML parser
  const parser = new XMLParser({ ignoreAttributes: false, parseNodeValue: true });
  let mpd;

  try {
    // Parse the MPD text into an object
    mpd = parser.parse(mpdText);
  } catch (error) {
    console.error("MPD Parsing Error:", error);
    return;
  }

  // Debugging: Log the parsed MPD object to check its structure
  console.log("Parsed MPD Structure:", JSON.stringify(mpd, null, 2));

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

  // Debugging: Log out the period to inspect the structure
  console.log("Period Data:", JSON.stringify(period, null, 2));

  // Helper function to calculate segment durations from SegmentTimeline
  const getSegmentDurations = (period) => {
    const segmentDurations = [];
    
    if (period.SegmentTimeline && period.SegmentTimeline.S) {
      const segment = period.SegmentTimeline.S;
      
      // Check if 'S' is an object (not an array)
      if (typeof segment === 'object' && segment['@_d']) {
        // Extract duration if 'S' is an object
        const duration = segment['@_d']; // Access the duration attribute directly
        segmentDurations.push(parseInt(duration)); // Add segment duration
      }
    } else if (period.SegmentTemplate && period.SegmentTemplate['@_duration']) {
      // Use SegmentTemplate duration if SegmentTimeline is absent
      const duration = period.SegmentTemplate['@_duration'];
      const segmentCount = period.Representation[0].startNumber;
      for (let i = 0; i < segmentCount; i++) {
        segmentDurations.push(parseInt(duration)); // Add duration for each segment
      }
    }

    return segmentDurations;
  };

  // Function to create a new ad period
  const createAdPeriod = (startTime) => {
    console.log("Inserting ad at time:", startTime);
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
  console.log("Segment Durations:", segmentDurations); // Log the durations to ensure they are calculated

  let currentTime = 0;
  let updatedMPD = mpdText;

  // Go through each segment and insert ads every 24 seconds
  let currentPeriodTime = currentTime;
  for (let duration of segmentDurations) {
    currentPeriodTime += duration;

    // Check if we need to insert an ad (every 24 seconds in this case)
    if (currentPeriodTime >= 24) {
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

      // Reset time after inserting an ad
      currentPeriodTime = 0;
    }
  }

  return updatedMPD;
};

// Read the MPD file and process it
const mpdText = fs.readFileSync(__dirname + "/encrypted_.mpd", "utf8");
const updatedMPD = insertAdIntoMPD(mpdText);