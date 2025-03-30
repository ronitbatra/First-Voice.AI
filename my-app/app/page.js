"use client";

import Image from "next/image";
import Modal from "../components/Modal";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// 1) NEW - import speech recognition
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

export default function Home() {
  // Existing states
  const [language, setLanguage] = useState("English");
  const [isMute, setIsMute] = useState(false);
  const [isCall, setIsCall] = useState(false);
  const [isModal1Open, setModal1Open] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);

  // NEW - add callLog, partialSpeech, etc. for transcripts
  const [callLog, setCallLog] = useState([]);
  const [partialSpeech, setPartialSpeech] = useState("");
  // Add conversationHistory state to track the full conversation
  const [conversationHistory, setConversationHistory] = useState([]);

  // Updated state management for structured question flow
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [answerSufficient, setAnswerSufficient] = useState(true);
  const [askForProviders, setAskForProviders] = useState(false);
  const [stage, setStage] = useState(0);
  const [loading, setLoading] = useState(false);

  // New: Track how many times we repeat the same question
  const [repeatQuestionCount, setRepeatQuestionCount] = useState(0);

  // New: State for handling personal help question
  const [showingPersonalHelpQuestion, setShowingPersonalHelpQuestion] =
    useState(false);
  const [personalHelpAsked, setPersonalHelpAsked] = useState(false);
  const [personalHelpResponse, setPersonalHelpResponse] = useState(null);

  // ================ react-speech-recognition variables ==================
  const {
    interimTranscript,
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // Show partial text live as the user speaks
  useEffect(() => {
    setPartialSpeech(interimTranscript);
  }, [interimTranscript]);

  // Once the user stops speaking → finalTranscript is set
  useEffect(() => {
    if (finalTranscript && finalTranscript.trim() !== "") {
      // Add final transcript to call log
      setCallLog((prev) => [...prev, { type: "user", text: finalTranscript }]);
      // Add user's message to conversation history
      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: finalTranscript },
      ]);
      setPartialSpeech("");

      // If we're in personal help question mode, handle it differently
      if (showingPersonalHelpQuestion) {
        handlePersonalHelpResponse(finalTranscript.trim());
      } else {
        // Otherwise handle normal conversation flow
        handleUserResponse(finalTranscript.trim());
      }

      resetTranscript();
    }
  }, [
    finalTranscript,
    resetTranscript,
    stage,
    currentQuestion,
    showingPersonalHelpQuestion,
  ]);

  // ==================== Evaluate if an answer is sufficient (local UI check) ====================
  const evaluateAnswerSufficiency = (userText, questionNumber) => {
    // Check for brevity
    const wordCount = userText
      .split(/\s+/)
      .filter((word) => word.trim().length > 0).length;

    // Check for generic/one-word responses
    const genericResponses = [
      "yes",
      "no",
      "ok",
      "okay",
      "sure",
      "fine",
      "good",
      "bad",
      "maybe",
    ];
    const isGenericResponse = genericResponses.includes(
      userText.toLowerCase().trim()
    );

    // For Q1 (name) or Q6 (professional help), minimal is okay
    if (questionNumber === 1 || questionNumber === 6) {
      return wordCount > 0;
    } else {
      // For Q2–Q5, require at least ~3 words
      return wordCount >= 3 && !isGenericResponse;
    }
  };

  // ==================== Handle user responses in the structured question flow ====================
  const handleUserResponse = async (userSpokenText) => {
    console.log(
      `Stage: ${stage}, Question: ${currentQuestion}, User said: ${userSpokenText}`
    );

    if (stage === 0) {
      // If stage 0, set stage to 1 (though normally we handle startCall differently)
      setStage(1);
      return;
    }

    // Once we've done the summary (stage 3), check if we should show personal help question
    if (stage === 3) {
      if (!personalHelpAsked) {
        setPersonalHelpAsked(true);
        // Generate and show the personal help question
        generatePersonalHelpQuestion();
      } else {
        // If we've already asked about personal help, just show a closing message
        setCallLog((prev) => [
          ...prev,
          {
            type: "support",
            text: "Thank you for using First Voice. If you'd like to start a new session, please click 'End Call' and then 'Start Call'.",
          },
        ]);
      }
      return;
    }

    try {
      setLoading(true);

      // Evaluate answer locally before calling the API
      const localAnswerCheck = evaluateAnswerSufficiency(
        userSpokenText,
        currentQuestion
      );
      console.log(
        `Local answer check: ${
          localAnswerCheck ? "Sufficient" : "Insufficient"
        }`
      );

      // Make the API request
      const res = await fetch("/api/v1/query", {
        method: "POST",
        body: JSON.stringify({
          problem_description: "Mental health support",
          stage: 1, // Using stage 1 for the structured conversation flow
          last_reply: userSpokenText,
          history: conversationHistory,
          questionNumber: currentQuestion,
          answerSufficient: localAnswerCheck, // Pass our local check to the API
        }),
      });

      if (!res.ok) {
        throw new Error(`API responded with status: ${res.status}`);
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("API didn't return valid JSON");
      }

      const data = await res.json();
      console.log("API response:", data);

      // Add AI's response to conversation history and callLog
      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content: data.msg },
      ]);
      setCallLog((prev) => [...prev, { type: "support", text: data.msg }]);

      // If answer is insufficient according to the API
      if (data.answerSufficient === false) {
        setRepeatQuestionCount((prev) => prev + 1);

        // If repeated too many times, forcibly move to next question to avoid loops
        if (repeatQuestionCount >= 2 && currentQuestion < 6) {
          console.log(
            "Forcing question advance after multiple insufficient answers..."
          );
          setCurrentQuestion(currentQuestion + 1);
          setRepeatQuestionCount(0);
        }
      } else {
        // The answer was sufficient
        setRepeatQuestionCount(0);
        // Update question if the API indicates we should
        if (data.questionNumber && data.questionNumber !== currentQuestion) {
          setCurrentQuestion(data.questionNumber);
        }
      }

      // If the API says we should move to summary (i.e., after Q6 is answered sufficiently)
      if (data.moveTo === "summary") {
        console.log("Moving to summary stage...");
        setStage(3);

        if (data.askForProviders) {
          setAskForProviders(true);
        }

        // Make the summary request
        handleFinalSummary(conversationHistory);
      }

      setLoading(false);
    } catch (error) {
      console.error("API error:", error);
      setLoading(false);
      setCallLog((prev) => [
        ...prev,
        {
          type: "error",
          text: "Sorry, I'm having trouble connecting. Could you try again?",
        },
      ]);
    }
  };

  // ==================== Helper function for final summary processing ====================
  const handleFinalSummary = async (history) => {
    // Show "thinking" messages
    setCallLog((prev) => [
      ...prev,
      {
        type: "support",
        text: "Thank you for sharing. Let me analyze this information...",
      },
      { type: "support", text: "Please hold..." },
    ]);
    setLoading(true);

    try {
      const res2 = await fetch("/api/v1/query", {
        method: "POST",
        body: JSON.stringify({
          problem_description: "Mental health support",
          stage: 2, // Summaries are done in stage 2
          history: history,
        }),
      });

      if (!res2.ok) {
        throw new Error(`API responded with status: ${res2.status}`);
      }

      const contentType = res2.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("API didn't return valid JSON");
      }

      const data2 = await res2.json();

      // Final summary text: ensure it's a string
      let summaryText = "";
      if (typeof data2.triage === "string") {
        summaryText = data2.triage;
      } else {
        // If triage is an object, convert it to string
        summaryText = JSON.stringify(data2.triage);
      }

      // Add the summary response to conversation history
      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content: `Summary: ${summaryText}` },
      ]);

      // Possibly include info about location-based resources
      let providerInfo = "";
      if (
        data2.openToHelp &&
        data2.location &&
        data2.location !== "their area"
      ) {
        providerInfo = `\n\nBased on your location (${data2.location}), you may want to explore mental health providers in your area. Would you like me to help you find local resources?`;
      }

      setLoading(false);

      // Display final summary to user
      setCallLog((prev) => [
        ...prev,
        {
          type: "ai",
          text: "Based on our conversation, here's my assessment:",
        },
        { type: "summary", text: summaryText + providerInfo },
      ]);

      // Wait a bit before showing the personal help question
      setTimeout(() => {
        if (isCall) {
          // Only if still in a call
          generatePersonalHelpQuestion();
        }
      }, 2000);
    } catch (error) {
      console.error("Final summary API error:", error);
      setLoading(false);
      setCallLog((prev) => [
        ...prev,
        {
          type: "error",
          text: "I'm having trouble processing your information. Our team will reach out to assist you.",
        },
      ]);
    }
  };

  // ==================== Generate and handle personal help question ====================
  const generatePersonalHelpQuestion = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/v1/query", {
        method: "POST",
        body: JSON.stringify({
          stage: 3, // Personal help question stage
          history: conversationHistory,
        }),
      });

      if (!res.ok) {
        throw new Error(`API responded with status: ${res.status}`);
      }

      const data = await res.json();
      const personalHelpQuestion =
        data.personalHelpQuestion ||
        "Would you like me to help you find mental health resources in your area?";

      // Add question to conversation
      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content: personalHelpQuestion },
      ]);

      // Display question
      setCallLog((prev) => [
        ...prev,
        { type: "support", text: personalHelpQuestion },
      ]);

      setPersonalHelpAsked(true);
      setShowingPersonalHelpQuestion(true);
      setLoading(false);
    } catch (error) {
      console.error("Personal help question error:", error);
      setLoading(false);

      // Fall back to a default question
      const defaultQuestion =
        "Would you like me to help you find mental health resources in your area?";
      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content: defaultQuestion },
      ]);
      setCallLog((prev) => [
        ...prev,
        { type: "support", text: defaultQuestion },
      ]);
      setPersonalHelpAsked(true);
      setShowingPersonalHelpQuestion(true);
    }
  };

  // Handle user's response to the personal help question
  const handlePersonalHelpResponse = (response) => {
    setShowingPersonalHelpQuestion(false);
    setPersonalHelpResponse(response);

    // Check if they want help
    const lowerResponse = response.toLowerCase();
    const wantsHelp =
      lowerResponse.includes("yes") ||
      lowerResponse.includes("sure") ||
      lowerResponse.includes("okay") ||
      lowerResponse.includes("ok") ||
      lowerResponse.includes("please") ||
      lowerResponse.includes("would like");

    if (wantsHelp) {
      // They want help - provide resources
      setCallLog((prev) => [
        ...prev,
        {
          type: "support",
          text:
            "Great! Here are some resources that might be helpful:\n\n" +
            "1. National Mental Health Hotline: 988 - Call or text 24/7\n" +
            "2. Crisis Text Line: Text HOME to 741741\n" +
            "3. BetterHelp: Online therapy and counseling\n" +
            "4. Psychology Today: Directory to find therapists near you\n\n" +
            "Is there a specific type of resource you're looking for?",
        },
      ]);

      setConversationHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Great! Here are some resources that might be helpful: National Mental Health Hotline (988), Crisis Text Line (Text HOME to 741741), BetterHelp, and Psychology Today's therapist directory. Is there a specific type of resource you're looking for?",
        },
      ]);
    } else {
      // They don't want help
      setCallLog((prev) => [
        ...prev,
        {
          type: "support",
          text: "I understand. If you ever need resources in the future, don't hesitate to reach out. Thank you for talking with me today.",
        },
      ]);

      setConversationHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I understand. If you ever need resources in the future, don't hesitate to reach out. Thank you for talking with me today.",
        },
      ]);
    }
  };

  // ==================== If browser not supported ====================
  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="min-h-screen bg-slate-700 text-white">
        <h1>Your browser doesn&apos;t support Speech Recognition.</h1>
      </div>
    );
  }

  // ==================== Start / End Call logic =====================
  const handleStartCall = () => {
    setIsCall(true);
    // Reset all state
    setCallLog([]);
    setStage(1);
    setCurrentQuestion(1);
    setAnswerSufficient(true);
    setAskForProviders(false);
    setUserAnswers([]);
    setConversationHistory([]);
    setLoading(false);
    setRepeatQuestionCount(0);
    setShowingPersonalHelpQuestion(false);
    setPersonalHelpAsked(false);
    setPersonalHelpResponse(null);

    // Use randomized greeting that asks for name directly
    const greetings = [
      "Hello, I'm here to listen and support you. What is your name?",
      "Hi there, I'm your mental health support assistant. Could you tell me your name?",
      "Welcome to First Voice AI. I'm here to help. May I know your name?",
      "Thank you for reaching out today. I'm here to support you. What's your name?",
      "I'm your mental health assistant. Before we begin, could you share your name with me?",
      "I'm here to provide support during difficult times. What should I call you?",
    ];

    // Choose a random greeting
    const randomGreeting =
      greetings[Math.floor(Math.random() * greetings.length)];

    // Set the greeting as the first message
    setCallLog([{ type: "support", text: randomGreeting }]);
    setConversationHistory([{ role: "assistant", content: randomGreeting }]);

    // Start listening if not muted
    if (!isMute) {
      SpeechRecognition.startListening({
        continuous: true,
        interimResults: true,
      });
    }
  };

  const handleEndCall = () => {
    setIsCall(false);
    SpeechRecognition.stopListening();
    // Reset states
    setStage(0);
    setCurrentQuestion(1);
    setRepeatQuestionCount(0);
    setShowingPersonalHelpQuestion(false);
    setPersonalHelpAsked(false);
  };

  // ==================== Mute logic ====================
  const handleToggleMute = () => {
    setIsMute((prev) => {
      const nextMuteValue = !prev;
      if (nextMuteValue) {
        SpeechRecognition.stopListening();
      } else if (isCall) {
        SpeechRecognition.startListening({
          continuous: true,
          interimResults: true,
        });
      }
      return nextMuteValue;
    });
  };

  // ==================== Display question label ====================
  const getQuestionLabel = () => {
    return `Question ${currentQuestion} of 6${
      repeatQuestionCount > 0 ? " (please elaborate)" : ""
    }`;
  };

  // ==================== Render UI ====================
  return (
    <div className="min-h-screen bg-slate-700">
      <div className="flex flex-col items-center">
        <header className="font-bold text-4xl mt-12 font-poppins">
          First Voice AI
        </header>
        <p className="text-sm text-center mt-4">
          <a
            href="https://www.linkedin.com/in/ronit-batra"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold"
          >
            Ronit Batra
          </a>
          , University of Virginia <br />
          <a
            href="https://www.linkedin.com/in/samuelpark316"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold"
          >
            Samuel Park
          </a>
          , University of Virginia <br />
          <a
            href="https://www.linkedin.com/in/sagun-venuganti"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold"
          >
            Sagun Venuganti
          </a>
          , University of Virginia <br />
          <a
            href="https://www.linkedin.com/in/phlobater-habshy-371087312"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold"
          >
            Phlo Habshy
          </a>
          , Virgina Tech
        </p>
        <div className="mt-4 font-poppins">
          First Voice: Mental Health Support & Redirection
        </div>
        <div className="font-poppins">
          Connecting people with appropriate mental health resources through
          structured conversation.
        </div>

        {/* Progress indicator for questions */}
        {isCall && stage !== 3 && (
          <div className="w-2/3 bg-gray-200 h-2 mt-4 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-in-out ${
                repeatQuestionCount > 0 ? "bg-yellow-500" : "bg-blue-600"
              }`}
              style={{ width: `${(currentQuestion / 6) * 100}%` }}
            ></div>
            <div className="text-xs text-center mt-1 text-gray-200">
              {getQuestionLabel()}
            </div>
          </div>
        )}

        {/* Call log + partial speech */}
        <div className="flex flex-col bg-gray-100 text-black h-[350px] w-2/3 p-4 mt-2 font-poppins overflow-auto">
          {callLog.map((item, index) => {
            let messageClass = "";
            let prefix = "";

            if (item.type === "user") {
              messageClass = "text-blue-600 font-medium";
              prefix = "User: ";
            } else if (item.type === "support") {
              messageClass = "text-green-700";
              prefix = "Support: ";
            } else if (item.type === "ai") {
              messageClass = "text-purple-700 font-bold";
              prefix = "AI: ";
            } else if (item.type === "summary") {
              messageClass =
                "text-red-600 bg-gray-100 p-1 mt-1 rounded border border-gray-300";
              prefix = "Summary: ";
            } else if (item.type === "error") {
              messageClass = "text-red-600 font-bold";
              prefix = "System: ";
            }

            return (
              <div key={index} className={messageClass}>
                {prefix}
                {item.text}
              </div>
            );
          })}

          {/* Show partial speech while talking */}
          {partialSpeech && (
            <div className="text-gray-500 italic">
              User (speaking): {partialSpeech}
            </div>
          )}

          {/* Show listening status or Mute status */}
          <div className="mt-2 text-sm text-gray-500">
            {isCall
              ? `Call in progress... Listening: ${listening ? "Yes" : "No"}`
              : "No active call. Start one!"}
            <br />
            {isMute ? "Muted (no audio captured)" : "Unmuted (audio capturing)"}
          </div>

          {/* If loading data from server, show something */}
          {loading && (
            <div className="text-blue-600 font-bold animate-pulse">
              Processing...
            </div>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-row justify-center mt-4 font-poppins">
        <motion.button
          onClick={handleStartCall}
          className="bg-green-600 p-2 text-white rounded-lg hover:bg-white hover:text-green-600 border border-green-600 mx-4"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          Start Call
        </motion.button>
        <motion.button
          onClick={handleEndCall}
          className="bg-red-600 p-2 text-white rounded-lg hover:bg-white hover:text-red-600 mx-4 border border-red-600"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          End Call
        </motion.button>
        <motion.button
          onClick={handleToggleMute}
          className="bg-blue-600 p-2 text-white rounded-lg hover:bg-white hover:text-blue-600 border border-blue-600 mx-4"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isMute ? "Unmute" : "Mute"}
        </motion.button>
        <motion.button
          onClick={() => setModal1Open(true)}
          className="bg-blue-600 p-2 text-white rounded-lg hover:bg-white hover:text-blue-600 border border-blue-600 mx-4"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          Settings
        </motion.button>

        <Modal isOpen={isModal1Open} onClose={() => setModal1Open(false)}>
          <h2 className="text-xl font-bold p-4">Settings</h2>
          <div> Set your Language </div>
        </Modal>
      </div>
    </div>
  );
}
