import { NextResponse } from "next/server";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import OpenAI from "openai";

require("dotenv").config();

export async function POST(req) {
  const address = process.env.MILVUS_URL;
  const token = process.env.MILVUS_KEY;

  const client = new MilvusClient({ address, token });
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
  });

  const req_json = await req.json();
  if (!req_json.problem_description || typeof req_json.stage === "undefined") {
    return NextResponse.json(
      {
        msg: "Usage: body {problem_description: text for request, stage: stage of request}",
      },
      { status: 400 }
    );
  }

  switch (req_json.stage) {
    /*
     * ============== CASE 0: No change ==============
     */
    case 0:
      return NextResponse.json(
        {
          msg: "Hello, I'm here to listen and support you. What is your name?",
        },
        { status: 200 }
      );

    /*
     * ============== CASE 1: Simple GPT flow with NO vector DB ==============
     * (As requested, we skip vectorization here. We do a quick GPT to guide the conversation.)
     * We'll read "history" if provided, to keep context.
     */
    case 1: {
      // Gather any conversation so far
      const conversationHistory = req_json.history || [];
      const userReply = req_json.last_reply || "";

      // We'll do a simple GPT call to get the next response
      // or a small set of questions. This is flexible.
      // Example: "msg" for a single answer
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        temperature: 0.5,
        messages: [
          // Insert prior conversation
          ...conversationHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          {
            role: "user",
            content: `Problem: ${req_json.problem_description}\nUser's last reply: ${userReply}`,
          },
          {
            role: "system",
            content:
              "You are a mental health professional. Please respond with the next step or question to better understand the caller's emotional state. Return JSON: { msg: '...' } if you prefer a single text message, or { questions: [...] } if you want a list. Keep it short.",
          },
        ],
      });

      // The assistant's text
      const rawOutput = gptResponse.choices[0].message.content.trim();

      // Attempt to parse if it's valid JSON, else just wrap in { msg: ... }
      let jsonOut;
      try {
        jsonOut = JSON.parse(rawOutput);
      } catch (err) {
        jsonOut = { msg: rawOutput };
      }

      return NextResponse.json(jsonOut, { status: 200 });
    }

    /*
     * ============== CASE 2: Final summary ==============
     * We:
     *  1) Take "userAnswers" (the 5 user statements + problem_description)
     *  2) Vectorize them, search DB for relevant context
     *  3) Then prompt GPT with the user "history" + DB context to produce final summary
     *  4) Return { summary: "..."} as the final JSON
     */
    case 2: {
      // (1) read the combined userAnswers + the conversation history
      const userAnswersString = req_json.userAnswers || "";
      const conversationHistory = req_json.history || [];

      // (2) Vectorize userAnswers
      const vectorRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_KEY}`,
        },
        body: JSON.stringify({
          input: userAnswersString,
          model: "text-embedding-ada-002",
        }),
      }).then((r) => r.json());

      const userAnswersEmbedding = vectorRes.data[0].embedding;

      // Search DB for similar content
      const dbSearch = await client.search({
        collection_name: "mental_health_responses",
        vectors: [userAnswersEmbedding],
        output_fields: ["text"],
        limit: 5,
      });

      if (dbSearch.status.error_code !== "Success") {
        return NextResponse.json(
          {
            msg: `DB query error (${dbSearch.status.error_code}:${dbSearch.status.reason})`,
          },
          { status: 405 }
        );
      }

      const dbContext = dbSearch.results;

      // (3) GPT with final summary request
      // We feed in both the conversation so far + the context from DB
      const finalGPT = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        temperature: 0.5,
        messages: [
          ...conversationHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          {
            role: "system",
            content: `Relevant DB info:\n${JSON.stringify(dbContext, null, 2)}`,
          },
          {
            role: "system",
            content:
              "Please produce a short mental-health summary integrating the caller's personal info from the conversation. Return JSON: { summary: 'some short text' }. Do not add anything else.",
          },
        ],
      });

      let summaryOut = finalGPT.choices[0].message.content.trim();

      // Attempt to parse as JSON
      let finalJson;
      try {
        finalJson = JSON.parse(summaryOut);
      } catch (err) {
        // fallback
        finalJson = { summary: summaryOut };
      }

      return NextResponse.json(finalJson, { status: 200 });
    }

    default:
      return NextResponse.json({ msg: "No matching stage." }, { status: 400 });
  }
}