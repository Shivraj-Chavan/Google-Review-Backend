require("dotenv").config();

async function checkReviewId() {
  const url = new URL(
    "https://connectors.windsor.ai/google_my_business"
  );

  url.searchParams.set("api_key", process.env.WINDSOR_API_KEY);
  url.searchParams.set(
    "select_accounts",
    "locations/17250409495488330814"
  );
  url.searchParams.set("date_preset", "last_30d");

  url.searchParams.set(
    "fields",
    [
      "review_id",
      "review_reviewer",
      "review_comment",
      "review_star_rating",
      "review_create_time",
      "review_reply_comment"
    ].join(",")
  );

  const response = await fetch(url);
  const result = await response.json();

  console.log("STATUS:", response.status);
  console.log("REVIEWS:");

  for (const review of result.data || []) {
    console.log("-------------------------");
    console.log("Review ID:", review.review_id);
    console.log("Reviewer:", review.review_reviewer);
    console.log("Comment:", review.review_comment);
    console.log("Rating:", review.review_star_rating);
    console.log("Created:", review.review_create_time);
    console.log("Existing reply:", review.review_reply_comment);
  }

  if (!result.data?.length) {
    console.log("No reviews returned by Windsor yet.");
  }
}

checkReviewId().catch(console.error);