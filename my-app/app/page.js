"use client";

import Image from "next/image";
import Modal from "../components/Modal";
import NavBar from "../components/NavBar";
import { useState, useEffect, useRef } from "react";
import { motion, useInView, useAnimation } from "framer-motion";

// 1) NEW - import speech recognition
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

export default function Home() {
  // Existing states
  const [language, setLanguage] = useState("English");
  const [isMute, setIsMute] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
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

  // Add state for transcript visibility toggle
  const [showTranscript, setShowTranscript] = useState(true);

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
        if (isCallActive) {
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
    setIsCallActive(true);
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
    setIsCallActive(false);
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
      } else if (isCallActive) {
        SpeechRecognition.startListening({
          continuous: true,
          interimResults: true,
        });
      }
      return nextMuteValue;
    });
  };

  const handleCallToggle = () => {
    if (isCallActive) {
      handleEndCall();
    } else {
      handleStartCall();
    }
    setIsCallActive(!isCallActive);
  };

  // ==================== Display question label ====================
  const getQuestionLabel = () => {
    return `Question ${currentQuestion} of 6${
      repeatQuestionCount > 0 ? " (please elaborate)" : ""
    }`;
  };

  // Animation refs for scroll reveal
  const headerRef = useRef(null);
  const subtitleRef = useRef(null);
  const tryItRef = useRef(null);
  const conversationBoxRef = useRef(null);
  const buttonsRef = useRef(null);
  const missionTitleRef = useRef(null);
  const missionBoxRef = useRef(null);

  // Check if elements are in view
  const headerInView = useInView(headerRef, { once: true, amount: 0.3 });
  const subtitleInView = useInView(subtitleRef, { once: true, amount: 0.3 });
  const tryItInView = useInView(tryItRef, { once: true, amount: 0.3 });
  const conversationBoxInView = useInView(conversationBoxRef, {
    once: true,
    amount: 0.2,
  });
  const buttonsInView = useInView(buttonsRef, { once: true, amount: 0.3 });
  const missionTitleInView = useInView(missionTitleRef, {
    once: true,
    amount: 0.3,
  });
  const missionBoxInView = useInView(missionBoxRef, {
    once: true,
    amount: 0.3,
  });

  // Animation controls
  const headerControls = useAnimation();
  const subtitleControls = useAnimation();
  const tryItControls = useAnimation();
  const conversationBoxControls = useAnimation();
  const buttonsControls = useAnimation();
  const missionTitleControls = useAnimation();
  const missionBoxControls = useAnimation();

  // Trigger animations when elements come into view
  useEffect(() => {
    if (headerInView) headerControls.start({ opacity: 1, y: 0 });
    if (subtitleInView) subtitleControls.start({ opacity: 1, y: 0 });
    if (tryItInView) tryItControls.start({ opacity: 1, y: 0 });
    if (conversationBoxInView)
      conversationBoxControls.start({ opacity: 1, y: 0 });
    if (buttonsInView) buttonsControls.start({ opacity: 1, y: 0 });
    if (missionTitleInView) missionTitleControls.start({ opacity: 1, y: 0 });
    if (missionBoxInView) missionBoxControls.start({ opacity: 1, y: 0 });
  }, [
    headerInView,
    headerControls,
    subtitleInView,
    subtitleControls,
    tryItInView,
    tryItControls,
    conversationBoxInView,
    conversationBoxControls,
    buttonsInView,
    buttonsControls,
    missionTitleInView,
    missionTitleControls,
    missionBoxInView,
    missionBoxControls,
  ]);

  // ==================== Render UI ====================
  return (
    <main className="pb-0">
      {/* Global styles for all animations */}
      <style jsx global>{`
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        /* Audio wave animation styles */
        @keyframes wave {
          0% {
            height: 10px;
          }
          50% {
            height: 80px;
          }
          100% {
            height: 10px;
          }
        }

        .audio-wave {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100px;
        }

        .wave-bar {
          width: 8px;
          margin: 0 4px;
          border-radius: 4px;
          background: linear-gradient(180deg, #3b82f6, #10b981);
        }

        /* Enhanced background animations */
        @keyframes float {
          0% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-15px) rotate(2deg);
          }
          50% {
            transform: translateY(-30px) rotate(5deg);
          }
          75% {
            transform: translateY(-15px) rotate(2deg);
          }
          100% {
            transform: translateY(0px) rotate(0deg);
          }
        }

        @keyframes pulse {
          0% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
          100% {
            opacity: 0.5;
            transform: scale(1);
          }
        }

        @keyframes moveAround {
          0% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(20px, -20px);
          }
          50% {
            transform: translate(40px, 0);
          }
          75% {
            transform: translate(20px, 20px);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        body {
          background: linear-gradient(135deg, #0f172a, #1e293b, #0f172a);
          background-size: 400% 400%;
          animation: gradient 15s ease infinite;
        }
      `}</style>

      {/* Background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Large gradient orbs - enhanced */}
        <div
          className="absolute top-10 right-[10%] w-[600px] h-[600px] rounded-full bg-purple-500/20 blur-3xl"
          style={{
            animation:
              "pulse 8s ease-in-out infinite, moveAround 30s ease-in-out infinite",
          }}
        ></div>
        <div
          className="absolute bottom-20 left-[5%] w-[500px] h-[500px] rounded-full bg-blue-500/20 blur-3xl"
          style={{
            animation:
              "pulse 10s ease-in-out infinite, moveAround 40s ease-in-out infinite alternate",
          }}
        ></div>
        <div
          className="absolute top-[40%] left-[20%] w-[400px] h-[400px] rounded-full bg-cyan-500/15 blur-3xl"
          style={{
            animation:
              "pulse 12s ease-in-out infinite, moveAround 35s ease-in-out infinite 2s",
          }}
        ></div>
        <div
          className="absolute bottom-[30%] right-[15%] w-[350px] h-[350px] rounded-full bg-indigo-500/20 blur-3xl"
          style={{
            animation:
              "pulse 9s ease-in-out infinite, moveAround 38s ease-in-out infinite alternate-reverse",
          }}
        ></div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-white/[0.03] bg-[length:40px_40px]"></div>

        {/* Additional decorative elements - enhanced */}
        <div
          className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full border-2 border-blue-500/30"
          style={{ animation: "float 10s ease-in-out infinite" }}
        ></div>
        <div
          className="absolute bottom-1/3 right-1/3 w-24 h-24 rounded-full border-2 border-purple-500/30"
          style={{
            animation: "float 13s ease-in-out infinite",
            animationDelay: "2s",
          }}
        ></div>
        <div
          className="absolute top-2/3 left-1/3 w-40 h-40 rounded-full border-2 border-cyan-500/30"
          style={{
            animation: "float 15s ease-in-out infinite",
            animationDelay: "1s",
          }}
        ></div>
      </div>

      {/* Add NavBar component */}
      <NavBar />

      <div className="w-full py-12 px-4 pt-24">
        <div className="flex flex-col items-center max-w-6xl mx-auto">
          {/* Header with scroll reveal */}
          <motion.header
            ref={headerRef}
            initial={{ opacity: 0, y: 30 }}
            animate={headerControls}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="font-bold text-5xl mt-16 mb-8 font-poppins drop-shadow-md relative"
            style={{
              backgroundImage:
                "linear-gradient(-45deg, #9333ea, #3b82f6, #10b981)",
              backgroundSize: "200% 200%",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              animation: "gradient 3s ease infinite",
            }}
          >
            First Voice AI
          </motion.header>
          <div className="w-full h-12"></div>
          {/* Logo Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="w-40 h-40 relative mx-auto mb-8 mt-4 overflow-hidden rounded-full flex items-center justify-center shadow-lg"
            style={{
              background:
                "linear-gradient(45deg, rgba(147, 51, 234, 0.2), rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.2))",
              boxShadow: "0 0 30px rgba(147, 51, 234, 0.3)",
            }}
          >
            <Image
              src="/logos/logo.png"
              alt="FirstVoice AI Logo"
              width={160}
              height={160}
              className="object-contain -ml-12 -mt-12 "
              style={{
                objectPosition: "center",
                position: "absolute",
                inset: "0",
                margin: "auto",
              }}
              priority
            />
          </motion.div>

          <div className="w-full h-8"></div>

          {/* Subtitle with scroll reveal */}
          <motion.div
            ref={subtitleRef}
            initial={{ opacity: 0, y: 30 }}
            animate={subtitleControls}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="mt-4 mb-4 font-poppins text-white text-xl font-semibold"
          >
            Mental Health Support & Redirection
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={subtitleControls}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="font-poppins text-white/80 mb-24 max-w-2xl text-center"
          >
            Connecting people with appropriate mental health resources through
            structured conversation. Our AI-driven platform provides a safe
            space for individuals to express their concerns and receive
            personalized guidance toward professional mental health services and
            support networks.
          </motion.div>

          {/* Add vertical space before Try It! section */}
          <div className="w-full h-12"></div>

          {/* Try It! title with scroll reveal */}
          <motion.h2
            ref={tryItRef}
            initial={{ opacity: 0, y: 30 }}
            animate={tryItControls}
            transition={{ duration: 0.8, ease: "easeOut" }}
            id="tryit"
            className="text-5xl font-bold mb-20 mt-12 font-poppins drop-shadow-md relative scroll-mt-24"
            style={{
              backgroundImage:
                "linear-gradient(-45deg, #9333ea, #3b82f6, #10b981)",
              backgroundSize: "200% 200%",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              animation: "gradient 3s ease infinite",
            }}
          >
            Try It!
          </motion.h2>

          <div className="w-full h-12"></div>

          {/* Conversation box with scroll reveal */}
          <motion.div
            ref={conversationBoxRef}
            initial={{ opacity: 0, y: 30 }}
            animate={conversationBoxControls}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full"
          >
            {/* Progress indicator with improved spacing */}
            {isCallActive && stage !== 3 && (
              <div className="w-2/3 bg-white/30 h-3 my-6 rounded-full overflow-hidden backdrop-blur-sm mx-auto">
                <div
                  className={`h-full transition-all duration-500 ease-in-out ${
                    repeatQuestionCount > 0 ? "bg-yellow-500" : "bg-blue-600"
                  }`}
                  style={{ width: `${(currentQuestion / 6) * 100}%` }}
                ></div>
                <div className="text-xs text-center mt-2 text-white">
                  {getQuestionLabel()}
                </div>
              </div>
            )}

            {/* Add toggle switch for transcript/visualization mode */}
            <div className="flex items-center justify-center mb-4 gap-4">
              <motion.button
                onClick={() => setShowTranscript(true)}
                className={`py-2 px-4 rounded-lg flex items-center text-sm ${
                  showTranscript
                    ? "bg-blue-600 text-white"
                    : "bg-white/20 text-white/70"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"
                    clipRule="evenodd"
                  />
                </svg>
                Show Transcript
              </motion.button>
              <motion.button
                onClick={() => setShowTranscript(false)}
                className={`py-2 px-4 rounded-lg flex items-center text-sm ${
                  !showTranscript
                    ? "bg-blue-600 text-white"
                    : "bg-white/20 text-white/70"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                    clipRule="evenodd"
                  />
                </svg>
                Voice Only
              </motion.button>
            </div>

            <div className="w-full h-12"></div>

            {/* Call log or visualization */}
            {showTranscript ? (
              <div
                className="flex flex-col bg-white/20 backdrop-blur-md text-white h-[380px] w-3/4 max-w-4xl p-7 mt-6 mb-12 font-poppins overflow-auto rounded-xl shadow-lg relative mx-auto"
                style={{
                  boxShadow: "0 0 25px rgba(52, 152, 219, 0.15)",
                }}
              >
                {callLog.map((item, index) => {
                  let messageClass = "";
                  let prefix = "";

                  if (item.type === "user") {
                    messageClass =
                      "text-blue-200 font-medium bg-blue-900/30 p-3 rounded-lg my-2";
                    prefix = "User: ";
                  } else if (item.type === "support") {
                    messageClass =
                      "text-green-200 bg-green-900/30 p-3 rounded-lg my-2";
                    prefix = "Support: ";
                  } else if (item.type === "ai") {
                    messageClass =
                      "text-purple-200 font-bold bg-purple-900/30 p-3 rounded-lg my-2";
                    prefix = "AI: ";
                  } else if (item.type === "summary") {
                    messageClass =
                      "text-white bg-gradient-to-r from-blue-900/50 to-indigo-900/50 p-4 my-3 rounded-lg shadow-inner";
                    prefix = "Summary: ";
                  } else if (item.type === "error") {
                    messageClass =
                      "text-red-200 font-bold bg-red-900/30 p-3 rounded-lg my-2";
                    prefix = "System: ";
                  }

                  return (
                    <div key={index} className={`${messageClass} relative`}>
                      {prefix}
                      {item.text}
                    </div>
                  );
                })}

                {/* Speech display with better spacing */}
                {partialSpeech && (
                  <div className="text-blue-200 italic bg-blue-800/20 p-3 rounded-lg my-2 relative">
                    User (speaking): {partialSpeech}
                  </div>
                )}

                {/* Status display with better spacing */}
                <div className="mt-4 text-sm text-white/70 bg-black/10 p-3 rounded-lg relative">
                  {isCallActive
                    ? `Call in progress... Listening: ${
                        listening ? "Yes" : "No"
                      }`
                    : "No active call. Start one!"}
                  <br />
                  {isMute
                    ? "Muted (no audio captured)"
                    : "Unmuted (audio capturing)"}
                </div>

                {/* Loading indicator with better spacing */}
                {loading && (
                  <div className="text-blue-200 font-bold animate-pulse bg-blue-900/30 p-3 rounded-lg my-2 relative">
                    Processing...
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center h-[380px] w-3/4 max-w-4xl p-7 mt-6 mb-12 font-poppins mx-auto">
                <div className="text-center mb-8 text-white">
                  {isCallActive ? (
                    listening ? (
                      <div className="text-xl font-semibold">Listening...</div>
                    ) : (
                      <div className="text-xl font-semibold">Processing...</div>
                    )
                  ) : (
                    <div className="text-xl font-semibold">
                      Start a call to begin
                    </div>
                  )}
                </div>

                {isCallActive && (
                  <div className="audio-wave">
                    {[...Array(16)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="wave-bar"
                        animate={{
                          height: listening
                            ? [10, Math.random() * 70 + 10, 10]
                            : 10,
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.07,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Last speaker indicator - more subtle without container */}
                {isCallActive && callLog.length > 0 && (
                  <div className="mt-10 text-center text-white/80">
                    <div className="text-sm mb-2">Last speaker:</div>
                    <div className="text-lg font-medium">
                      {callLog[callLog.length - 1].type === "user"
                        ? "You"
                        : "AI Assistant"}
                    </div>
                  </div>
                )}

                {/* Status info at bottom - more subtle */}
                <div className="mt-8 text-center text-sm text-white/60">
                  {isCallActive
                    ? listening
                      ? "Listening for your voice..."
                      : "Processing your response..."
                    : "Click 'Start Call' to begin"}
                  <br />
                  {isMute && "Audio currently muted"}
                </div>
              </div>
            )}
          </motion.div>

          <div className="w-full h-8"></div>
          <div className="w-full h-8"></div>

          {/* Buttons with scroll reveal */}
          <motion.div
            ref={buttonsRef}
            initial={{ opacity: 0, y: 30 }}
            animate={buttonsControls}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-row flex-wrap justify-center gap-4 mt-10 mb-28 font-poppins"
          >
            <motion.button
              onClick={handleCallToggle}
              className={`py-3 px-6 text-white rounded-lg shadow-lg relative flex items-center ${
                isCallActive
                  ? "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                  : "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
              }`}
              whileHover={{
                scale: 1.05,
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
              }}
              whileTap={{ scale: 0.95 }}
            >
              {isCallActive ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  End Call
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  Start Call
                </>
              )}
            </motion.button>

            <motion.button
              onClick={handleToggleMute}
              className="bg-gradient-to-r from-blue-600 to-blue-500 py-3 px-6 text-white rounded-lg hover:from-blue-500 hover:to-blue-400 shadow-lg relative flex items-center"
              whileHover={{
                scale: 1.05,
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
              }}
              whileTap={{ scale: 0.95 }}
            >
              {isMute ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Unmute
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Mute
                </>
              )}
            </motion.button>

            <motion.button
              onClick={() => setModal1Open(true)}
              className="bg-gradient-to-r from-indigo-600 to-indigo-500 py-3 px-6 text-white rounded-lg hover:from-indigo-500 hover:to-indigo-400 shadow-lg relative flex items-center"
              whileHover={{
                scale: 1.05,
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
              }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
              Settings
            </motion.button>

            <Modal isOpen={isModal1Open} onClose={() => setModal1Open(false)}>
              <h2 className="text-xl font-bold p-4">Settings</h2>
              <div> Set your Language </div>
            </Modal>
          </motion.div>
        </div>

        <div className="w-full h-8"></div>
        <div className="w-full h-8"></div>

        {/* Mission section with scroll reveal */}
        <div
          id="mission"
          className="w-full py-24 mt-24 relative scroll-mt-24"
          style={{
            background:
              "linear-gradient(180deg, rgba(30,58,138,0) 0%, rgba(30,58,138,0.05) 100%)",
          }}
        >
          {/* Mission title with scroll reveal */}
          <motion.h2
            ref={missionTitleRef}
            initial={{ opacity: 0, y: 30 }}
            animate={missionTitleControls}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-5xl font-bold mb-28 font-poppins drop-shadow-md relative text-center"
            style={{
              backgroundImage:
                "linear-gradient(-45deg, #9333ea, #3b82f6, #10b981)",
              backgroundSize: "200% 200%",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              animation: "gradient 3s ease infinite",
            }}
          >
            Our Mission
          </motion.h2>

          {/* Add extra vertical spacing */}
          <div className="w-full h-12"></div>

          {/* Mission box with scroll reveal */}
          <div className="flex justify-center mb-16">
            <motion.div
              ref={missionBoxRef}
              initial={{ opacity: 0, y: 30 }}
              animate={missionBoxControls}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="bg-white/20 backdrop-filter backdrop-blur-md rounded-xl p-10 shadow-lg max-w-3xl w-full mx-auto relative"
              style={{
                boxShadow: "0 0 25px rgba(52, 152, 219, 0.15)",
              }}
            >
              <p className="text-white/90 leading-relaxed text-lg mb-5 tracking-wide px-2">
                A compassionate mental health support assistant that provides a
                safe space for emotional support and connects people with
                appropriate mental health resources through structured
                conversation.
              </p>
              <p className="text-white/80 leading-relaxed text-base tracking-wide px-2">
                We believe that everyone deserves access to mental health
                support in moments of need. Our AI-powered platform serves as a
                bridge between those seeking help and the professional resources
                available to them.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
