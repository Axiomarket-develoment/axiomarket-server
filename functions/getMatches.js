const axios = require("axios");

const API_KEY = "gH8hYUn480H9chHS0lxx3xaPMWMaUlxY494PuL7mQ0avq4SPSBtk2bhrUoL0";

async function testAPI() {

  const today = "2026-05-07";

  try {

    const res = await axios.get(
      `https://api.sportmonks.com/v3/football/leagues/date/${today}`,
      {
        params: {
          api_token: API_KEY,
          include:
            "today.scores;today.participants"
        }
      }
    );

    // DEBUG
    console.log("RAW RESPONSE:");
    console.log(JSON.stringify(res.data, null, 2));

    // SAFE CHECK
    if (!res.data.data) {
      console.log("\nNo match data returned.");
      return;
    }

    const leagues = res.data.data;

    console.log(`\nLeagues Found: ${leagues.length}`);

  } catch (err) {

    console.error(
      err.response?.data || err.message
    );

  }

}


testAPI();