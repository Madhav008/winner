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
        body: "market_ids[]=1.242329005&market_ids[]=8.888109186&market_ids[]=8.888109187&market_ids[]=8.888109188", // Adjust as needed
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();

    // Assuming the data you provided is the first value in the response
    const dataString = data[0]; // This is the data string you provided

    let teamAods = dataString.split("ACTIVE")[1];
    const team_A_Back_ODS = teamAods.split("|")[1];

    let teamBods = dataString.split("ACTIVE")[2];
    const team_B_Back_ODS = teamBods.split("|")[1];

    const odds1 = parseFloat(team_A_Back_ODS);
    const odds2 = parseFloat(team_B_Back_ODS);

    return { odds1, odds2 };
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

async function fetchOddsFromParimatch() {
  let teamABackElement = document.querySelector(
    "#line-holder > div.EC_CN > div:nth-child(2) > div > div.EC_Es > div > span:nth-child(1) > span:nth-child(1) > span"
  ).innerText;
  let teamBBackElement = document.querySelector(
    "#line-holder > div.EC_CN > div:nth-child(2) > div > div.EC_Es > div > span:nth-child(2) > span:nth-child(1) > span"
  ).innerText;

  teamABackElement = parseFloat(teamABackElement);
  teamBBackElement = parseFloat(teamBBackElement);

  const oddsFromParimatch = {
    odds1: teamABackElement,
    odds2: teamBBackElement,
  };

  return oddsFromParimatch;
}

// Run both fetch functions and display results
async function getAllOdds() {
  const lotus365Odds = await fetchOddsFromLotus365();
  const parimatchOdds = await fetchOddsFromParimatch();

  console.log("Lotus365 Odds: ", lotus365Odds);
  console.log("Parimatch Odds: ", parimatchOdds);

  if (lotus365Odds && parimatchOdds) {
    const totalStake = 100; // Total Stake: ₹100

    // Cross-book Arbitrage calculation
    const stake1Lotus =
      (totalStake * parimatchOdds.odds2) /
      (lotus365Odds.odds1 + parimatchOdds.odds2 - 1); // Team A back on Lotus365
    const stake2Parimatch = totalStake - stake1Lotus; // Team B back on Parimatch

    console.log("\n--- True Arbitrage ---");
    console.log(
      "Place Bet 1 on Lotus365 (Team A): Rs",
      stake1Lotus.toFixed(2),
      "at odds",
      lotus365Odds.odds1 + " Return: " + (stake1Lotus.toFixed(2) *lotus365Odds.odds1).toFixed(2)
    );
    console.log(
      "Place Bet 2 on Parimatch (Team B): Rs",
      stake2Parimatch.toFixed(2),
      "at odds",
      parimatchOdds.odds2 + " Return: " + (stake2Parimatch.toFixed(2) * parimatchOdds.odds2).toFixed(2)
    );

    // Calculate total returns for both outcomes:
    const returnIfTeamAWins = stake1Lotus * lotus365Odds.odds1;
    const returnIfTeamBWins = stake2Parimatch * parimatchOdds.odds2;

    // Check if both returns exceed the total stake (True Arbitrage)
    if (returnIfTeamAWins > totalStake && returnIfTeamBWins > totalStake) {
      console.log("True Arbitrage opportunity found!");
      console.log(
        "Return if Team A wins: Rs",
        returnIfTeamAWins.toFixed(2),
        "(greater than ₹100)"
      );
      console.log(
        "Return if Team B wins: Rs",
        returnIfTeamBWins.toFixed(2),
        "(greater than ₹100)"
      );
    } else {
      console.log("\n--- No true arbitrage opportunity at the moment. ---\n");
    }
  }
}

// SetInterval to update the element and display the odds
setInterval(() => {
  getAllOdds(); // Call the function every 20 seconds to fetch and display updated odds
}, 2000); // Runs every 20000ms (20 seconds)
