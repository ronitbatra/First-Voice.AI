import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req) {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
    
    const req_json = await req.json();
    
    if (!req_json.summary) {
      return NextResponse.json(
        {
          error: "Missing summary data",
          message: "The request must include a summary of the conversation"
        },
        { status: 400 }
      );
    }

    // Get conversation summary and user context
    const summary = req_json.summary;
    const userContext = req_json.userContext || {};
    
    // Extract relevant information for prompting
    const concerns = userContext.concerns || [];
    const symptoms = userContext.symptoms || [];
    const demographics = userContext.demographic || {};
    const userName = userContext.name || "the patient";
    
    console.log("Generating personalized recommendations for user");
    console.log("Concerns:", concerns);
    console.log("Symptoms:", symptoms);
    
    // Generate the doctor recommendations prompt
    const doctorRecommendationsPrompt = `
Based on the following summary of a mental health conversation, generate personalized doctor recommendations and final comments.

PATIENT SUMMARY:
${summary}

${concerns.length > 0 ? `IDENTIFIED CONCERNS: ${concerns.join(", ")}` : ''}
${symptoms.length > 0 ? `IDENTIFIED SYMPTOMS: ${symptoms.join(", ")}` : ''}
${demographics.age ? `AGE: ${demographics.age}` : ''}
${demographics.gender ? `GENDER: ${demographics.gender}` : ''}
${demographics.location ? `LOCATION: ${demographics.location}` : ''}

Please provide:

1. FINAL COMMENTS: Write a personalized closing message (2-3 sentences) that offers hope, validates their experience, and encourages them to seek appropriate care. Use a warm, professional tone. Address them by name if available.

2. DOCTOR RECOMMENDATIONS: Recommend 2-3 specific types of healthcare providers or specialists that would be most appropriate for their situation. For each recommendation, include:
   - Provider type/specialty
   - Brief explanation of why this type of provider would be beneficial
   - What to expect from this type of care
   - Any relevant credentials to look for

Format the response as a JSON object with the following structure:
{
  "finalComments": "The personalized closing message",
  "doctorRecommendations": [
    {
      "providerType": "Provider type/specialty",
      "rationale": "Why this provider would be beneficial",
      "expectations": "What to expect from this care",
      "credentials": "Relevant credentials to look for"
    },
    ...
  ]
}
`;

    // Call OpenAI to generate personalized recommendations
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are a professional mental health specialist providing personalized recommendations. Use third-person language in the recommendations (e.g., 'the patient would benefit from...'). Be specific, accurate, and compassionate."
        },
        {
          role: "user",
          content: doctorRecommendationsPrompt
        }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the JSON response
    const responseContent = response.choices[0].message.content;
    let jsonResponse;
    
    try {
      jsonResponse = JSON.parse(responseContent);
    } catch (e) {
      console.error("Failed to parse OpenAI response as JSON:", e);
      console.log("Raw response:", responseContent);
      
      // Fallback response
      jsonResponse = {
        finalComments: "Thank you for sharing your experiences. Remember that seeking help is a sign of strength, and support is available when you're ready.",
        doctorRecommendations: [
          {
            providerType: "Primary Care Physician",
            rationale: "A good first step for any health concern is consulting with a primary care provider who can help coordinate care.",
            expectations: "They can provide initial assessments and referrals to appropriate specialists.",
            credentials: "Look for board-certified physicians (MD or DO)."
          }
        ]
      };
    }

    return NextResponse.json(jsonResponse, { status: 200 });
    
  } catch (error) {
    console.error("Error generating recommendations:", error);
    
    return NextResponse.json(
      {
        error: "Failed to generate recommendations",
        message: error.message
      },
      { status: 500 }
    );
  }
} 