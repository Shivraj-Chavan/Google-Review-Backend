const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TONE_GUIDANCE = {
  friendly: 'warm and approachable',
  formal: 'polished and professional',
  casual: 'relaxed and conversational',
};

function buildPrompt({ businessName, category, description, city, rating, reviewText, tone }) {
  return `You are writing a reply AS THE BUSINESS "${businessName}" (category: ${category || 'N/A'}, city: ${city || 'N/A'}) to a customer's Google review.

Business description (for context only, do not invent beyond this): ${description || 'N/A'}

Customer review (rating ${rating}/5):
"${reviewText || '(no text provided)'}"

Tone: ${TONE_GUIDANCE[tone] || TONE_GUIDANCE.friendly}

Rules:
- Do not pretend to be the customer.
- Do not invent facts, employees, services, offers, dates, events, products, discounts, or policies not stated above.
- Match the sentiment of the review: thank the customer for positive reviews, acknowledge feedback professionally for neutral ones, stay calm/respectful/empathetic for negative ones — never argue or blame the customer.
- Do not mention AI generated this reply.
- No marketing language, no hashtags, no emojis unless the tone explicitly calls for them.
- 2-3 natural sentences. Do not repeat the entire review. Do not ask for a positive review.
- Output ONLY the reply text, nothing else.`;
}

async function generateGoogleReviewReply(input) {
  const prompt = buildPrompt(input);
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  const text = response.text?.trim();
  if (!text) throw new Error('Gemini returned an empty reply');
  return text;
}

module.exports = { generateGoogleReviewReply };