const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_INSTRUCTION = `
You write short, natural-sounding Google review drafts for real customers
to review and edit before posting.

STRICT RULES:
- Only use the business info and customer selections given to you.
- Never invent specific events, staff names, dates, products, services, or claims.
- Never claim the business offers a product or service that was not mentioned.
- Match the tone to the star rating.
- Low ratings should be honest and constructive, not artificially positive.
- Keep the review to 2-4 sentences.
- Write in first person.
- Sound like a real customer.
- Avoid generic marketing language.
- Output ONLY the review text.
- No preamble.
- No quotation marks.
- No markdown.
`;

async function generateReview(
  {
    businessName,
    category,
    description,
    city,
    rating,
    selectedPoints,
    customerFeedback,
  },
  variantSeed = 0
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "AI review generation is not configured (missing GEMINI_API_KEY)"
    );
  }

  // const model =
  //   process.env.GEMINI_MODEL || "Gemini 3 Flash Live";

  const prompt = JSON.stringify({
    business: {
      name: businessName,
      category,
      description,
      city,
    },
    rating,
    selectedPoints,
    customerFeedback,
    variant: variantSeed,
  });

  try {
    const model = "gemini-3.1-flash-lite";
  
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.9,
      maxOutputTokens: 250,
    },
  });

    const text = response.text?.trim();

    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return text;
  } catch (error) {
    console.error("[ai] Gemini error:", error);

    throw new Error(
      "Could not generate a review suggestion right now"
    );
  }
}

module.exports = {
  generateReview,
};