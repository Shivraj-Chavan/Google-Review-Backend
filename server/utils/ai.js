// const { GoogleGenAI } = require("@google/genai");

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// // const SYSTEM_INSTRUCTION = `
// // You write short, natural-sounding Google review drafts for real customers
// // to review and edit before posting.

// // STRICT RULES:
// // - Only use the business info and customer selections given to you.
// // - Never invent specific events, staff names, dates, products, services, or claims.
// // - Never claim the business offers a product or service that was not mentioned.
// // - Match the tone to the star rating.
// // - Low ratings should be honest and constructive, not artificially positive.
// // - Keep the review to 2-4 sentences.
// // - Write in first person.
// // - Sound like a real customer.
// // - Avoid generic marketing language.
// // - Output ONLY the review text.
// // - No preamble.
// // - No quotation marks.
// // - No markdown.
// // `;

// const SYSTEM_INSTRUCTION = `
// You write short, natural-sounding Google review DRAFTS for real customers
// to review, edit, and post themselves.

// The goal is to sound like an ordinary person sharing their genuine experience,
// not like a polished advertisement or professional writer.

// STRICT RULES:
// - Only use the business info and customer selections given to you.
// - Never invent specific events, staff names, dates, products, services, or claims.
// - Never claim the business offers a product or service that was not mentioned.
// - Match the tone honestly to the star rating.
// - Low ratings should be honest and constructive, not artificially positive.
// - Keep the review to 2-4 sentences.
// - Write in first person.
// - Sound conversational and personal.
// - Prefer simple, everyday vocabulary.
// - Use natural contractions where appropriate, such as "I've", "it's",
//   "wasn't", "didn't", and "I'd".
// - Sentence lengths should vary naturally.
// - It is okay to use a short sentence or conversational fragment occasionally
//   when it sounds natural.
// - Do not make every sentence perfectly polished or overly formal.
// - Avoid corporate, promotional, SEO, or marketing language.
// - Avoid phrases such as "exceptional service", "highly recommended",
//   "outstanding experience", "seamless experience", or similar generic wording
//   unless those words were explicitly provided by the customer.
// - Do not force slang, misspellings, or grammatical mistakes.
// - Do not intentionally make the writing confusing or incorrect.
// - Do not repeat the same sentence patterns across different reviews.
// - Use only the customer's actual feedback and selected points.
// - Never add details merely to make the review sound more realistic.
// - Output ONLY the review text.
// - No preamble.
// - No quotation marks.
// - No markdown.
// `;

// async function generateReview(
//   {
//     businessName,
//     category,
//     description,
//     city,
//     rating,
//     selectedPoints,
//     customerFeedback,
//   },
//   variantSeed = 0
// ) {
//   const apiKey = process.env.GEMINI_API_KEY;

//   if (!apiKey) {
//     throw new Error(
//       "AI review generation is not configured (missing GEMINI_API_KEY)"
//     );
//   }

//   const model =process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

//   const prompt = JSON.stringify({
//     business: {
//       name: businessName,
//       category,
//       description,
//       city,
//     },
//     rating,
//     selectedPoints,
//     customerFeedback,
//     variant: variantSeed,
//   });

//   try {
//     // const model = "gemini-3.1-flash-lite";
  
//   const response = await ai.models.generateContent({
//     model,
//     contents: prompt,
//     config: {
//       systemInstruction: SYSTEM_INSTRUCTION,
//       temperature: 0.9,
//       maxOutputTokens: 250,
//     },
//   });

//     const text = response.text?.trim();

//     if (!text) {
//       throw new Error("Gemini returned an empty response");
//     }

//     return text;
//   } catch (error) {
//     console.error("[ai] Gemini error:", error);

//     throw new Error(
//       "Could not generate a review suggestion right now"
//     );
//   }
// }

// module.exports = {
//   generateReview,
// };


const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});


const SYSTEM_INSTRUCTION = `
You generate natural Google review drafts for customers.

INPUT:
- Business name, category, description and city.
- Customer star rating (1 to 5).
- Optional selected experience points.
- Optional customer feedback.

RULES:
- Always generate a review when a valid rating is provided.
- Customer feedback is optional.
- Selected experience points are optional.
- If feedback is provided, use it as the primary source.
- If experience points are provided, use them as supporting details.
- If both are provided, combine them naturally.
- If BOTH are empty, generate a short, general review based only on the star rating and business context.
- In that case, do not invent specific visits, purchases, services, staff interactions or events.
- For 5 stars, keep the tone positive but not exaggerated.
- For 4 stars, keep it positive and balanced.
- For 3 stars, keep it neutral.
- For 1-2 stars, keep it constructive and honest.
- Write in first person.
- Use simple, conversational language.
- Keep it to 1-3 sentences.
- Avoid promotional and marketing language.
- Output only the review text.
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
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const prompt = JSON.stringify({
    business: {
      name: businessName,
      category,
      description,
      city,
    },
    rating,
    selectedPoints: selectedPoints || [],
    customerFeedback: customerFeedback || "",
    variant: variantSeed,
  });

  try {
    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: SYSTEM_INSTRUCTION,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_completion_tokens: 500,
    });
    const choice = response.choices?.[0];
    const message = choice?.message;
    
    console.log("[ai] Groq response:", JSON.stringify({
      finish_reason: choice?.finish_reason,
      content: message?.content,
      refusal: message?.refusal,
      reasoning: message?.reasoning,
      usage: response.usage,
    }, null, 2));
    
    const text = message?.content?.trim();

    if (!text || text === "INSUFFICIENT_FEEDBACK") {
      throw new Error("Could not generate a review. Please try again.");
    }
    
    return text;
  } catch (error) {
    console.error("[ai] Groq error:", error);
    throw new Error("Could not generate a review suggestion right now");
  }
}

module.exports = {
  generateReview,
};