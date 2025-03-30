import { NextResponse } from "next/server";
import OpenAI from "openai";

// Next.js already loads environment variables from .env.local

export async function POST(req) {
  try {
    // Initialize OpenAI client (used in all stages)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });

    const req_json = await req.json();
    if (
      !req_json.problem_description &&
      typeof req_json.stage === "undefined"
    ) {
      return NextResponse.json(
        {
          msg: "Usage: body {problem_description: text for request, stage: stage of request}",
        },
        { status: 400 }
      );
    }
    // Get conversation history if available
    const conversationHistory = req_json.history || [];
    console.log("History length:", conversationHistory.length);

    // Log the entire conversation history for debugging
    if (conversationHistory.length > 0) {
      console.log("Conversation context:");
      conversationHistory.forEach((msg, i) => {
        console.log(
          `[${i}] ${msg.role}: ${msg.content.substring(0, 50)}${
            msg.content.length > 50 ? "..." : ""
          }`
        );
      });
    }

    // Base system message for all interactions
    const baseSystemMessage = {
      role: "system",
      content:
        "You are a mental health professional providing support to someone who may be in distress. Maintain a supportive, empathetic tone throughout the conversation. Keep responses concise (under 60 words).",
    };

    // Get the current question number from the request or default to 1
    const currentQuestion = req_json.questionNumber || 1;
    console.log("Current question number:", currentQuestion);

    // Get the answer quality flag if available
    // (If answerSufficient is not explicitly false, we treat it as true)
    const answerSufficient = req_json.answerSufficient !== false;

    // Define the 6 main question prompts EXACTLY as given:
    const questionPrompts = {
      1: `Prompt 1: Initial Introduction & Onboarding
  You are FirstVoice, a compassionate and non-judgmental AI mental health support assistant. Your tone should be warm, kind, and validating—like a thoughtful friend who's always there to listen.
  Begin the conversation by gently introducing yourself and letting the user know you're here to talk about anything on their mind. Ask for their first name and general location (city or state) to better support them, but let them know it's completely optional.
  After they share (or decline), offer reassurance and transition to the next part of the conversation by saying:
  "Thanks for being here. Whenever you're ready, I'd love to hear how you've been feeling lately."
  Do not attempt to diagnose or provide clinical advice. Focus on creating a space of emotional safety, support, and gentle reflection.`,

      2: `Prompt 2: Exploring Current Emotional State
  You are FirstVoice, a deeply empathetic AI mental health support assistant. Continue a conversation with a warm, validating tone.
  Ask the user:
  "What's been on your mind lately? If you'd like, you can describe how you've been feeling recently—no need for perfect words or labels."
  When the user responds, reflect on their emotional state with compassion. For example:
  "It sounds like you've been carrying a lot." or "That makes a lot of sense given what you've been through."
  Reassure them that there's no judgment and they're doing something strong by opening up. Let them guide the pace of the conversation.`,

      3: `Prompt 3: Identifying When It Started
  You are FirstVoice, a supportive and non-judgmental mental health assistant. Continue a compassionate and grounded conversation.
  After validating the user's previous response, gently ask:
  "When did you first notice yourself feeling this way? Was it gradual, or tied to something that happened?"
  Reaffirm that their experiences are valid. Avoid assumptions or analysis—just focus on giving the user space to reflect, share, and`,

      4: `Prompt 4: Understanding Triggers
  You are FirstVoice, a caring AI assistant offering emotional support. Build on the prior conversation with sensitivity and warmth.
  First, validate the user's most recent response. Then ask:
  "Are there certain situations, thoughts, or experiences that tend to make these feelings stronger or come up more often?"
  Let them take their time. After they respond, mirror what you hear gently to help them feel understood, e.g.,
  "That seems like a really tough moment to sit with."
  Your focus is on compassion, not analysis.`,

      5: `Prompt 5: Exploring Coping Strategies
  You are FirstVoice, a gentle and encouraging mental health support assistant. Continue with warmth and empathy.
  Acknowledge the effort it takes to reflect on emotions. Then ask:
  "How have you been dealing with these feelings lately—have there been things you've tried, even small ones, that have helped or made it harder?"
  Respond with non-judgmental support regardless of what they share. Highlight any strengths, resilience, or effort you see in their response.`,

      6: `Prompt 6: Forward-Looking Support and Encouragement
  You are FirstVoice, a kind and hopeful mental health assistant. Your goal is to gently guide the user toward empowerment and possible next steps.
  Begin by acknowledging how meaningful it is that they've opened up. Then ask:
  "Would you be open to talking to a professional about some of this at some point? No pressure at all—just exploring what might feel helpful."
  Reassure them that support is always available, and say something like:
  "Whatever you decide, I'll always be here to listen when you need someone."
  Your tone should close the session with warmth, encouragement, and hope.`,
    };

    // If the user answer is insufficient, we give a rephrasing guide
    const rephrasingGuides = {
      1: `The user's response about their name/location was too brief. Apologize gently and restate the question. Encourage them to share their name and (optionally) their location.`,
      2: `The user's response about their emotional state was insufficient. Apologize gently and encourage them to elaborate on how they're feeling.`,
      3: `The user's response about when these feelings started was insufficient. Ask again if it was gradual or tied to an event. Encourage them to reflect more on the timeline.`,
      4: `The user's response about triggers was insufficient. Gently re-ask them about any particular situations or experiences that intensify these feelings.`,
      5: `The user's response about coping strategies was insufficient. Encourage them to share anything they've tried, even if it didn't help.`,
      6: `The user's response about talking to a professional was insufficient. Gently clarify if they're open, or if they'd like to consider professional support in the future.`,
    };

    switch (req_json.stage) {
      // ======================== CASE 1: The 6-question flow ========================
      case 1: {
        const userReply = req_json.last_reply || "";
        console.log(
          `Processing question ${currentQuestion}, user reply: ${userReply}`
        );
        // Because we do a local check in page.js, let's also finalize it here:
        // If the user or the front-end flagged it as not sufficient, treat it as not sufficient
        let isAnswerSufficient = answerSufficient;

        // If the user is on Q6 and their answer is sufficient, check if they said yes => open to help
        let askForProviders = false;
        if (currentQuestion === 6 && isAnswerSufficient) {
          const lowerReply = userReply.toLowerCase();
          const userOpenToHelp =
            lowerReply.includes("yes") ||
            lowerReply.includes("sure") ||
            lowerReply.includes("ok") ||
            lowerReply.includes("open") ||
            lowerReply.includes("willing") ||
            !lowerReply.includes("no");
          askForProviders = userOpenToHelp;
        }

        // The normal flow: if the answer is good and we haven't reached Q6 => increment question
        let nextQuestionNumber = currentQuestion;
        if (isAnswerSufficient && currentQuestion < 6) {
          nextQuestionNumber = currentQuestion + 1;
        }

        // If it's Q6 and sufficient, let's go to the summary
        if (currentQuestion === 6 && isAnswerSufficient) {
          return NextResponse.json(
            {
              msg: "Thank you for sharing. Let me analyze this information...\nPlease hold...",
              questionNumber: 6,
              moveTo: "summary",
              askForProviders,
            },
            { status: 200 }
          );
        }

        // Otherwise, let's produce the response from GPT
        let contextualGuidance =
          questionPrompts[currentQuestion] || "Continue with empathy...";
        if (!isAnswerSufficient) {
          // Add rephrasing instructions
          const rephraseTip = rephrasingGuides[currentQuestion] || "";
          contextualGuidance += `\n\n${rephraseTip}\n\nImportant: The user's answer was insufficient; restate the question with an apology and encourage them to elaborate. DO NOT increment question number.`;
        }

        // Build the message array for GPT
        const messages = [
          baseSystemMessage,
          {
            role: "system",
            content: contextualGuidance,
          },
          ...conversationHistory,
        ];

        // Let GPT create a new answer
        const gptResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          temperature: 0.7,
          messages,
        });
        const rawOutput = gptResponse.choices[0].message.content.trim();
        // Return the assistant's new text, and the updated questionNumber
        return NextResponse.json(
          {
            msg: rawOutput,
            questionNumber: nextQuestionNumber,
            answerSufficient: isAnswerSufficient,
            askForProviders,
          },
          { status: 200 }
        );
      }

      // ======================== CASE 2: Final summary creation ========================
      case 2: {
        console.log("Creating final summary from conversation...");
        // If the conversation is too short, do minimal
        if (conversationHistory.length < 2) {
          return NextResponse.json(
            {
              triage:
                "Not enough conversation to create a meaningful summary. Please continue the conversation.",
            },
            { status: 200 }
          );
        }
        // Prepare a system prompt that instructs GPT to produce the summary as a single string
        let systemPrompt = `
         You are a clinical mental health professional creating a structured assessment summary for a referral.
         Create a concise, objective summary of the user's needs, with these sections:
         1) PRESENTING CONCERNS
         2) EMOTIONAL STATE
         3) RISK FACTORS
         4) SUPPORT NEEDS
         5) RECOMMENDED CARE
         
         Use a professional third-person voice (e.g. "the patient reports...") and keep it under 200 words total. Do not provide direct quotes from the user. Summarize all relevant details from the conversation. Return the result in JSON as:
         {"triage": "Your entire summary text in one string."}
         
         If the user expressed openness to professional help, mention that in the recommended care section.
                 `;

        // Also we can add any context about location if we want
        // But we are capturing that in the conversation or with the location logic
        const summaryRequest = [
          baseSystemMessage,
          {
            role: "system",
            content: systemPrompt,
          },
          ...conversationHistory,
        ];
        const finalGPT = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          temperature: 0.2,
          messages: summaryRequest,
        });

        let summaryOut = finalGPT.choices[0].message.content.trim();
        console.log("Raw summary output from GPT:", summaryOut);

        // Attempt to parse it as JSON
        let finalJson;
        try {
          finalJson = JSON.parse(summaryOut);
        } catch (err) {
          // If parsing fails, let's wrap it in a JSON field ourselves
          finalJson = { triage: summaryOut };
        }

        // We'll guess if the user is open to help by scanning conversation for yes/no
        let openToHelp = false;
        let userLocation = "their area";
        // (We can do more sophisticated checks here if desired)

        // Return final JSON with location + openToHelp if needed
        finalJson.location = userLocation;
        finalJson.openToHelp = openToHelp;

        console.log("Final summary output:", finalJson);
        return NextResponse.json(finalJson, { status: 200 });
      }

      /*
       * ============== CASE 3: Dynamic personal help question ==============
       */
      case 3: {
        console.log("Generating dynamic personal help question");

        // Extract user's name and location if available
        let userName = "there";
        let userLocation = "your area";

        // Try to find the user's name from the conversation history
        for (let i = 0; i < conversationHistory.length; i++) {
          const msg = conversationHistory[i];
          if (msg.role === "user") {
            const lowerContent = msg.content.toLowerCase();
            if (
              lowerContent.includes("name is") ||
              lowerContent.includes("my name")
            ) {
              const nameMatch = msg.content.match(
                /(?:name is|my name is|i'm) (\w+)/i
              );
              if (nameMatch && nameMatch[1]) {
                userName = nameMatch[1];
                break;
              }
            }
          }
        }

        // Try to identify location from conversation
        for (let i = 0; i < conversationHistory.length; i++) {
          const msg = conversationHistory[i];
          if (msg.role === "user") {
            const lowerContent = msg.content.toLowerCase();
            const locationIndicators = [
              "live in",
              "from",
              "located in",
              "staying in",
              "based in",
              "city",
              "state",
              "town",
            ];
            for (const locIndicator of locationIndicators) {
              if (lowerContent.includes(locIndicator)) {
                const locText = msg.content.split(locIndicator)[1];
                if (locText && locText.length > 3 && locText.length < 50) {
                  userLocation = locText
                    .trim()
                    .replace(/[,.;].*$/, "")
                    .trim();
                  break;
                }
              }
            }
          }
        }

        // Create a system prompt for generating a dynamic personal help question
        const personalHelpPrompt = `
 You are a compassionate mental health AI. Based on your conversation with the user, generate a personalized question asking if they would like personal help or assistance with finding mental health resources.
 
 Your question should:
 1. Use the user's name (${userName}) if available
 2. Reference their location (${userLocation}) if relevant
 3. Offer to help connect them with local mental health providers or resources
 4. Be warm, supportive, and non-pressuring
 5. Have slightly different phrasing each time
 
 Create a single, concise question (2-3 sentences maximum) asking if they'd like personal help finding resources. DO NOT include any other content - just the question itself.
 
 Examples (but don't use these exact phrasings):
 - "Would you like me to help you find mental health services in your area? I can suggest some resources that might be helpful."
 - "I'm wondering if you'd like some assistance finding local mental health support options? I'd be happy to help."
 - "Based on what you've shared, would it be helpful if I provided some information about mental health resources near you?"
 `;

        const messages = [
          baseSystemMessage,
          {
            role: "system",
            content: personalHelpPrompt,
          },
          ...conversationHistory,
        ];

        const personalHelpGPT = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          temperature: 0.7, // Higher temperature for more variation
          messages,
        });

        const personalHelpQuestion =
          personalHelpGPT.choices[0].message.content.trim();
        console.log("Generated personal help question:", personalHelpQuestion);

        return NextResponse.json(
          {
            personalHelpQuestion: personalHelpQuestion,
          },
          { status: 200 }
        );
      }

      default:
        return NextResponse.json(
          { msg: "No matching stage." },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        error: "An error occurred processing your request",
        msg: "Our systems are experiencing technical difficulties. Please try again.",
      },
      { status: 500 }
    );
  }
}
