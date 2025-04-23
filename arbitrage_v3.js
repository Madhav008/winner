async function fetchOddsFromMySportsFeed() {
  try {
    const response = await fetch("https://scatalog.mysportsfeed.io/api/v2/core/getmarkets", {
      method: "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/json",
        dnt: "1",
        origin: "https://sports-v3.mysportsfeed.io",
        pragma: "no-cache",
        priority: "u=1, i",
        referer: "https://sports-v3.mysportsfeed.io/",
        "sec-ch-ua": '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        operatorId: "rolexsb",
        sportId: "sr:sport:21",
        eventId: "sr:match:58970655",
        token: "dbe1adac-a0ae-479d-a0ef-66b62ac0eec2",
        providerId: "sportsbook",
      }),
    });

    if (!response.ok) throw new Error("MySportsFeed API error");

    const json = await response.json();

    const market = json?.event?.markets?.matchOdds?.[0];
    const teamA = parseFloat(market?.runners?.[0]?.backPrices?.[0].price);
    const teamB = parseFloat(market?.runners?.[1]?.backPrices?.[0].price);

    return {
      odds1: teamA,
      odds2: teamB,
      odds3: 
      parseFloat(
        teamA > teamB
          ? (teamA / (teamA - 1)).toFixed(2)
          : (teamB / (teamB - 1)).toFixed(2)
      ),
    };
  } catch (err) {
    console.error("MySportsFeed error:", err.message);
    return null;
  }
}


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
        body: "market_ids[]=1.242600095", // Adjust as needed
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    const dataString = data[0];

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

  return {
    odds1: teamABackElement,
    odds2: teamBBackElement,
    odds3:
      teamABackElement > teamBBackElement
        ? teamABackElement / (teamABackElement - 1)
        : teamBBackElement / (teamBBackElement - 1),
  };
}
async function fetchOddsFromMBet() {
  let teamABackElement = document.querySelector("#root > div.MainLayout_root__rqxHz.MainLayout_withLeftSide__OMWDb.MainLayout_withRightSide__Hpdej.MainLayout_withSlider__d7mzJ > div.MainLayout_inner__qNqoW.MainLayout_withSlider__d7mzJ > div > div > div > div.OutcomesGroups_groupsWrapper__wJmUq > div > div > div.Group_body__msMaZ > button:nth-child(1) > div").innerText;
  let teamBBackElement =document.querySelector("#root > div.MainLayout_root__rqxHz.MainLayout_withLeftSide__OMWDb.MainLayout_withRightSide__Hpdej.MainLayout_withSlider__d7mzJ > div.MainLayout_inner__qNqoW.MainLayout_withSlider__d7mzJ > div > div > div > div.OutcomesGroups_groupsWrapper__wJmUq > div > div > div.Group_body__msMaZ > button:nth-child(2) > div").innerText;

  teamABackElement = parseFloat(teamABackElement);
  teamBBackElement = parseFloat(teamBBackElement);

  return {
    odds1: teamABackElement,
    odds2: teamBBackElement,
    odds3:
      teamABackElement > teamBBackElement
        ? teamABackElement / (teamABackElement - 1)
        : teamBBackElement / (teamBBackElement - 1),
  };
}
async function fetchOddsFromStake() {
  let teamABackElement = document.querySelector(
    "#main-content > div > div:nth-child(1) > div.content.svelte-vx3xm.is-open > div > div > button:nth-child(1) > div > div > div > span"
  ).innerText;
  let teamBBackElement = document.querySelector(
    "#main-content > div > div:nth-child(1) > div.content.svelte-vx3xm.is-open > div > div > button:nth-child(2) > div > div > div > span"
  ).innerText;

  teamABackElement = parseFloat(teamABackElement);
  teamBBackElement = parseFloat(teamBBackElement);

  return {
    odds1: teamABackElement,
    odds2: teamBBackElement,
    odds3:
      teamABackElement > teamBBackElement
        ? teamABackElement / (teamABackElement - 1)
        : teamBBackElement / (teamBBackElement - 1),
  };
}

async function getAllOdds() {
  const lotus365Odds = await fetchOddsFromLotus365(); // { odds1, odds2 }
  const parimatchOdds = await fetchOddsFromMBet(); // { odds1, odds2 }
  // const parimatchOdds = await fetchOddsFromMySportsFeed(); // { odds1, odds2 }

  console.log("Lotus365 Odds: ", lotus365Odds);
  console.log("Parimatch Odds: ", parimatchOdds);
  // console.log("UltraWin Odds: ", parimatchOdds);



  if (lotus365Odds && parimatchOdds) {
    const totalStake = 100;

    // Case 1: Back Team A on Lotus365, Team B on Parimatch
    const stakeA_Case1 = totalStake / (lotus365Odds.odds1 / parimatchOdds.odds2 + 1);
    const stakeB_Case1 = totalStake - stakeA_Case1;
    const returnA_Case1 = stakeA_Case1 * lotus365Odds.odds1;
    const returnB_Case1 = stakeB_Case1 * parimatchOdds.odds2;

    console.log("\n--- Case 1: Lotus365 (Team A) | Parimatch (Team B) ---");
    console.log(
      `Bet on Lotus365: Rs ${stakeA_Case1.toFixed(2)} at odds ${lotus365Odds.odds1} => Return: Rs ${returnA_Case1.toFixed(2)}`
    );
    console.log(
      `Bet on Parimatch: Rs ${stakeB_Case1.toFixed(2)} at odds ${parimatchOdds.odds2} => Return: Rs ${returnB_Case1.toFixed(2)}`
    );

    if (returnA_Case1 > totalStake && returnB_Case1 > totalStake) {
      console.log("✅ True Arbitrage Opportunity Found in Case 1!");
    } else {
      console.log("❌ No Arbitrage in Case 1.");
    }

    // Case 2: Back Team A on Parimatch, Team B on Lotus365
    const stakeA_Case2 = totalStake / (parimatchOdds.odds1 / lotus365Odds.odds2 + 1);
    const stakeB_Case2 = totalStake - stakeA_Case2;
    const returnA_Case2 = stakeA_Case2 * parimatchOdds.odds1;
    const returnB_Case2 = stakeB_Case2 * lotus365Odds.odds2;

    console.log("\n--- Case 2: Parimatch (Team A) | Lotus365 (Team B) ---");
    console.log(
      `Bet on Parimatch: Rs ${stakeA_Case2.toFixed(2)} at odds ${parimatchOdds.odds1} => Return: Rs ${returnA_Case2.toFixed(2)}`
    );
    console.log(
      `Bet on Lotus365: Rs ${stakeB_Case2.toFixed(2)} at odds ${lotus365Odds.odds2} => Return: Rs ${returnB_Case2.toFixed(2)}`
    );

    if (returnA_Case2 > totalStake && returnB_Case2 > totalStake) {
      console.log("✅ True Arbitrage Opportunity Found in Case 2!");
    } else {
      console.log("❌ No Arbitrage in Case 2.");
    }
  }
}


setInterval(() => {
  getAllOdds();
}, 2000);
