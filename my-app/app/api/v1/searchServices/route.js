import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY || process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { latitude, longitude } = body;

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    // Convert coordinates to a location name (reverse geocoding)
    let locationName = `${latitude}, ${longitude}`;
    try {
      const reverseGeocode = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
      );

      if (reverseGeocode.ok) {
        const geoData = await reverseGeocode.json();

        if (geoData && geoData.display_name) {
          const locationParts = [
            geoData.address?.city,
            geoData.address?.town,
            geoData.address?.county,
            geoData.address?.state,
            geoData.address?.country,
          ].filter(Boolean);

          locationName = locationParts.join(", ") || locationName;
        }
      }
    } catch (error) {
      console.error("Error in reverse geocoding:", error);
      // Continue with coordinates if geocoding fails
    }

    // Search for mental health services using OpenAI
    const searchQuery = `top rated mental health services with contact information in ${locationName}`;

    try {
      // Try using the web search feature if available
      try {
        const webSearchResults = await openai.browse.search({
          query: searchQuery,
        });

        if (
          webSearchResults &&
          webSearchResults.search_results &&
          webSearchResults.search_results.length > 0
        ) {
          // Process the web search results
          const services = webSearchResults.search_results
            .slice(0, 5)
            .map((result) => {
              return {
                name: result.title || "Mental Health Service",
                phone: "Contact for details", // Often not directly in search results
                address: result.url || "See website for details",
                description:
                  result.snippet || "Provides mental health services",
              };
            });

          return NextResponse.json({
            services,
            location: locationName,
            source: "web_search",
          });
        }
      } catch (webSearchError) {
        console.error("Web search not available:", webSearchError);
        // Continue to fallback method
      }

      // If web search failed or is unavailable, use the chat API with domain knowledge
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant providing information about mental health services. Format your response as a valid JSON object with a 'services' array containing 3-5 services.",
          },
          {
            role: "user",
            content: `Please find 3-5 mental health services (therapy, counseling, and psychiatry) in ${locationName}. For each service, include the name, phone number, address, and a brief description. Format the output as a JSON object with a "services" array where each item has "name", "phone", "address", and "description" fields. Do not include any explanatory text outside the JSON.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      let parsedContent;

      try {
        parsedContent = JSON.parse(content);
        return NextResponse.json({
          services: parsedContent.services || [],
          location: locationName,
          source: "generated_data",
        });
      } catch (parseError) {
        console.error("Error parsing JSON from OpenAI response:", parseError);
        throw new Error("JSON parsing failed");
      }
    } catch (error) {
      console.error("Error searching for mental health services:", error);

      // Fallback to mock data if all other methods fail
      const fallbackServices = [
        {
          name: "Community Mental Health Center",
          phone: "(555) 123-4567",
          address: `Near ${locationName}`,
          description:
            "Offering therapy, counseling, and psychiatric services on a sliding fee scale.",
        },
        {
          name: "Mindful Wellness Clinic",
          phone: "(555) 987-6543",
          address: `Near ${locationName}`,
          description:
            "Specialized in cognitive behavioral therapy and stress management.",
        },
        {
          name: "Regional Psychiatric Services",
          phone: "(555) 456-7890",
          address: `Near ${locationName}`,
          description:
            "Comprehensive psychiatric care including medication management.",
        },
      ];

      return NextResponse.json({
        services: fallbackServices,
        location: locationName,
        note: "Using fallback data due to search error",
        source: "fallback_data",
      });
    }
  } catch (error) {
    console.error("Error in searchServices API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
