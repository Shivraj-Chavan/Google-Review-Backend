
require("dotenv").config();

const API_KEY = process.env.WINDSOR_API_KEY;

async function testWindsor() {
  if (!API_KEY) {
    throw new Error("WINDSOR_API_KEY is missing");
  }

  const accountUrl = new URL(
    "https://onboard.windsor.ai/api/common/ds-accounts"
  );
  accountUrl.searchParams.set("datasource", "google_my_business");
  accountUrl.searchParams.set("api_key", API_KEY);

  const actionsUrl = new URL(
    "https://connectors.windsor.ai/google_my_business/actions"
  );
  actionsUrl.searchParams.set("api_key", API_KEY);

  const [accountResponse, actionsResponse] = await Promise.all([
    fetch(accountUrl),
    fetch(actionsUrl)
  ]);

  const accounts = await accountResponse.json();
  const actions = await actionsResponse.json();

  console.log("CONNECTED ACCOUNTS:");
  console.log(JSON.stringify(accounts, null, 2));

  console.log("AVAILABLE ACTIONS:");
  console.log(JSON.stringify(actions, null, 2));
}

testWindsor().catch(console.error);
