require("dotenv").config();

async function testReviews() {
  const url = new URL(
    "https://connectors.windsor.ai/google_my_business"
  );

  url.searchParams.set("api_key", process.env.WINDSOR_API_KEY);
  url.searchParams.set(
    "select_accounts",
    "locations/17250409495488330814"
  );
  url.searchParams.set("date_preset", "last_30d");
  url.searchParams.set("_max_rows", "100");
  url.searchParams.set(
    "fields",
    "review_id,review_comment,review_star_rating,review_create_time,review_reply_comment"
  );

  const response = await fetch(url);
  console.log("STATUS:", response.status);
  console.log(JSON.stringify(await response.json(), null, 2));
}

testReviews().catch(console.error);