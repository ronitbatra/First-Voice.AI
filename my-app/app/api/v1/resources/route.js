import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI with better error handling
let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
  });
} catch (error) {
  console.error("Error initializing OpenAI:", error);
  // Will use fallback mechanism when API is called
}

export async function POST(request) {
  try {
    // Check if OpenAI initialized correctly
    if (!openai || !process.env.OPENAI_API_KEY) {
      console.error("OpenAI not initialized or API key missing");
      // Return fallback resources instead of error
      return NextResponse.json(
        {
          resources: generateFallbackResources(),
        },
        { status: 200 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { history } = body;

    if (!history || !Array.isArray(history)) {
      return NextResponse.json(
        {
          resources: generateFallbackResources(
            "No valid conversation history provided"
          ),
        },
        { status: 200 }
      );
    }

    // Extract user's name and possible mental health concerns
    let userName = "";
    let concerns = [];
    let location = "";

    // Look for the name in the early messages
    for (let i = 0; i < Math.min(5, history.length); i++) {
      const message = history[i];
      if (message.role === "user") {
        // Look for name patterns like "my name is X" or "I'm X"
        const nameMatch =
          message.content.match(/my name is (\w+)/i) ||
          message.content.match(/i(?:'|')?m (\w+)/i) ||
          message.content.match(/(?:^|\s)(\w+) here/i);

        if (nameMatch && nameMatch[1]) {
          userName = nameMatch[1];
          // Capitalize first letter
          userName =
            userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase();
          break;
        }
      }
    }

    // Extract concerns from user messages
    for (const message of history) {
      if (message.role === "user") {
        const content = message.content.toLowerCase();

        // Check for common mental health concerns
        if (content.includes("depress")) concerns.push("depression");
        if (content.includes("anxi")) concerns.push("anxiety");
        if (content.includes("stress")) concerns.push("stress");
        if (content.includes("trauma")) concerns.push("trauma");
        if (
          content.includes("grief") ||
          content.includes("loss") ||
          content.includes("died")
        )
          concerns.push("grief or loss");
        if (content.includes("suicid")) concerns.push("suicidal thoughts");
        if (content.includes("sleep")) concerns.push("sleep issues");
        if (content.includes("addict") || content.includes("substance"))
          concerns.push("substance use");

        // Check for location mentions
        const locationMatch = content.match(
          /(?:i(?:'|')?m in|i live in|from) ([^,.]+)/i
        );
        if (locationMatch && locationMatch[1]) {
          location = locationMatch[1].trim();
        }
      }
    }

    // Remove duplicates from concerns
    concerns = [...new Set(concerns)];

    try {
      // Construct the prompt for GPT
      const resourcesPrompt = `
You are a compassionate mental health AI tasked with providing helpful resources. Based on your conversation with ${
        userName || "the user"
      }, provide a concise list of mental health resources tailored to their needs${
        concerns.length > 0 ? ` related to ${concerns.join(", ")}` : ""
      }.

The resources should:
1. Include national crisis support services
2. Cover a range of options (hotlines, text services, online therapy, in-person options)
3. Be specific and actionable with contact information 
4. Be formatted in a clear, easy-to-read bullet point list
5. End with a warm, supportive closing statement (but NO questions)
6. Be limited to 7 resources maximum

Your response should be compassionate but professional. The resources must be real, legitimate services. Focus on well-established national services rather than speculative or generic recommendations. Include contact methods (phone numbers, websites, etc.) for each resource.

${
  location
    ? `Since the user mentioned they are in ${location}, include a note about how they can find local resources in that area.`
    : ""
}
`;

      // Generate resources using GPT
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: resourcesPrompt,
          },
          ...history.slice(-5), // Include last 5 messages for context
        ],
      });

      // Extract the generated resources
      const resources = completion.choices[0].message.content.trim();

      // Return the resources
      return NextResponse.json({ resources }, { status: 200 });
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);

      // Add concerns to fallback resources if available
      return NextResponse.json(
        {
          resources: generateFallbackResources(
            concerns.length > 0 ? concerns.join(", ") : null,
            userName
          ),
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Resources API error:", error);

    // Return fallback resources instead of error
    return NextResponse.json(
      {
        resources: generateFallbackResources(),
      },
      { status: 200 }
    );
  }
}

// Function to generate fallback resources when API calls fail
function generateFallbackResources(concerns = null, userName = "") {
  const nameGreeting = userName ? `${userName}, here` : "Here";
  const concernText = concerns ? ` for ${concerns}` : "";

  return `${nameGreeting} are some mental health resources that might help${concernText}:

• National Mental Health Hotline: 988 - Available 24/7 for crisis support
• Crisis Text Line: Text HOME to 741741 for immediate text-based support
• BetterHelp: Online therapy platform with licensed professionals (betterhelp.com)
• Psychology Today: Directory to find therapists in your area (psychologytoday.com/us/therapists)
• SAMHSA's National Helpline: 1-800-662-4357 - Treatment referral service
• National Alliance on Mental Illness (NAMI): Support groups and education (nami.org)
• Mental Health America: Find resources and support through their website (mhanational.org)

Remember that reaching out is a sign of strength. Support is always available when you need it.`;
}
