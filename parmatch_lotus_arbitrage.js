async function fetchOddsFromLotus365() {
  try {
    const response = await fetch(
      "https://odds.o99exch.com/ws/getMarketDataNew",
      {
        method: "POST",
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "en-US,en;q=0.9",
          authorization: "bearer YOUR_TOKEN_HERE", // Replace with actual token
          "cache-control": "no-cache",
          "content-type": "application/x-www-form-urlencoded",
          pragma: "no-cache",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "cross-site",
        },
        body: "market_ids[]=1.242260021&market_ids[]=8.888109105&market_ids[]=8.888109106&market_ids[]=8.888109107", // Adjust as needed
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();

    // Assuming the data you provided is the first value in the response
    const dataString = data[0]; // This is the data string you provided

    // console.log(dataString)
    let teamAods = dataString.split("ACTIVE")[1];
    // console.log(teamAods);
    const team_A_Back_ODS = teamAods.split("|")[1];
    // console.log(team_A_Back_ODS);

    let teamBods = dataString.split("ACTIVE")[2];
    const team_B_Back_ODS = teamBods.split("|")[1];

    // Extract the odds from the positions (10th and 11th from the end)
    const odds1 = parseFloat(team_A_Back_ODS); // 1.08 (10th from end)
    const odds2 = parseFloat(team_B_Back_ODS); // 1.07 (11th from end)

    return { odds1, odds2 }; // Return the odds for further calculations
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

// Function to fetch odds from Parimatch
async function fetchOddsFromParimatch() {
  // Simulated data for demonstration purposes
  let teamABackElement = document.querySelector(
    "#line-holder > div.EC_CN > div:nth-child(2) > div > div.EC_Es > div > span:nth-child(1) > span:nth-child(1) > span"
  ).innerText;
  let teamBBackElement = document.querySelector(
    "#line-holder > div.EC_CN > div:nth-child(2) > div > div.EC_Es > div > span:nth-child(2) > span:nth-child(1) > span"
  ).innerText;

  teamABackElement = parseFloat(teamABackElement);
  teamBBackElement = parseFloat(teamBBackElement);

  const oddsFromParimatch = {
    odds1: teamABackElement, // Convert Team A's back odds into lay odds
    odds2: teamBBackElement, // Team B back odds remain the same
  };

  return oddsFromParimatch; // Return the odds for further calculations
}

// Run both fetch functions and display results
async function getAllOdds() {
  const lotus365Odds = await fetchOddsFromLotus365();
  const parimatchOdds = await fetchOddsFromParimatch();

  console.log("Lotus365 Odds: ", lotus365Odds);
  console.log("Parimatch Odds: ", parimatchOdds);

  if (lotus365Odds && parimatchOdds) {
    const totalStake = 100; // Total Stake: ₹100

    // Cross-book Arbitrage calculation (using Lotus365 for Team A and Parimatch for Team B)
    const stake1Lotus =
      (totalStake * parimatchOdds.odds2) /
      (lotus365Odds.odds1 + parimatchOdds.odds2 - 1); // Team A back on Lotus365
    const stake2Parimatch = totalStake - stake1Lotus; // Team B back on Parimatch

    console.log("\n--- Cross-Book Arbitrage ---");
    console.log(
      "Place Bet 1 on Lotus365 (Team A): Rs",
      stake1Lotus.toFixed(2),
      "at odds",
      lotus365Odds.odds1
    );
    console.log(
      "Place Bet 2 on Parimatch (Team B): Rs",
      stake2Parimatch.toFixed(2),
      "at odds",
      parimatchOdds.odds2
    );

    // Arbitrage Profit Calculation
    const profit =
      totalStake * (1 / lotus365Odds.odds1 + 1 / parimatchOdds.odds2 - 1); // Arbitrage profit formula
    console.log("Arbitrage Profit: Rs", profit.toFixed(2));

    // Check if Arbitrage is possible (profit must be > 0)
    if (profit > 0) {
      console.log("Arbitrage opportunity found!");
    } else {
      console.log("No arbitrage opportunity at the moment.");
    }
  }
}

// SetInterval to update the element and display the odds
setInterval(() => {
  getAllOdds(); // Call the function every 20 seconds to fetch and display updated odds
}, 200); // Runs every 20000ms (20 seconds)
