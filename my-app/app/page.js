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

  // NEW - add callLog, partialSpeech, etc. for transcripts
  const [callLog, setCallLog] = useState([]);
  const [partialSpeech, setPartialSpeech] = useState("");

  // CHANGED - incorporate stage-based states from old code
  const STAGES = [
    "describe_emergency",
    "personal_information",
    "followup_questions",
  ];
  const [stage, setStage] = useState(0);
  const [problemDescription, setProblemDescription] = useState("");
  const [questions, setQuestions] = useState([]);
  const [backNForth, setBackNForth] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // 4) NEW - Once the user stops speaking → finalTranscript is set
  // This is where we do the "stages" logic from the old microphone code
  useEffect(() => {
    if (finalTranscript && finalTranscript.trim() !== "") {
      // Add final transcript to call log
      setCallLog((prev) => [...prev, `User: ${finalTranscript}`]);
      setPartialSpeech("");
      // Now handle stage logic
      handleStageLogic(finalTranscript.trim());
      resetTranscript();
    }
  }, [finalTranscript, resetTranscript]);

  // 5) NEW - Stage-based logic after user stops speaking
  // Mirrors microphone.jsx, but we call it here in page.js
  const handleStageLogic = async (userSpokenText) => {
    console.log(`Stage: ${stage}, user said: ${userSpokenText}`);

    switch (stage) {
      case 0: {
        // The user described their problem
        setProblemDescription(userSpokenText);
        // We fetch the next question from server
        const res = await fetch("/api/v1/query", {
          method: "POST",
          body: JSON.stringify({
            problem_description: userSpokenText,
            stage: 0,
          }),
        });
        const data = await res.json();

        // "data.msg" is the operator's reply
        setCallLog((prev) => [...prev, `Support: ${data.msg}`]);
        setStage(1);
        break;
      }
      case 1: {
        // The user responded with their name (stage 1)
        // Now we call the server again to get follow-up questions
        const res = await fetch("/api/v1/query", {
          method: "POST",
          body: JSON.stringify({
            problem_description,
            stage: 1,
            last_reply: userSpokenText,
          }),
        });
        const data = await res.json();

        setQuestions(data.questions); // store questions
        // The AI's next question
        setCallLog((prev) => [...prev, `Support: ${data.questions[0]}`]);
        setStage(2); // move to next stage
        break;
      }
      case 2: {
        // The user is answering follow-up questions
        // keep track of Q/A
        const currentQIndex = backNForth.filter(
          (m) => m.role === "assistant"
        ).length; // how many Qs we've asked so far

        // Save the Q & the user's A
        // we store them in backNForth
        const newHistory = [
          ...backNForth,
          { role: "assistant", content: questions[currentQIndex] },
          { role: "user", content: userSpokenText },
        ];
        setBackNForth(newHistory);

        // Check if that was the last question
        if (currentQIndex + 1 === questions.length) {
          // We do the summarization request
          setCallLog((prev) => [...prev, "Support: Please hold..."]);
          setLoading(true);

          const res2 = await fetch("/api/v1/query", {
            method: "POST",
            body: JSON.stringify({
              problem_description,
              stage: 2,
              history: newHistory,
            }),
          });
          const data2 = await res2.json();
          setLoading(false);
          setCallLog((prev) => [
            ...prev,
            "AI: Help has been dispatched and is on their way.",
            `Summary: ${JSON.stringify(data2.triage)}`,
          ]);
        } else {
          // Otherwise, ask the next question
          setCallLog((prev) => [
            ...prev,
            `Support: ${questions[currentQIndex + 1]}`,
          ]);
        }
        break;
      }
      default:
        break;
    }
  };

  // If browser not supported, show a message
  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="min-h-screen bg-slate-700 text-white">
        <h1>Your browser doesn't support Speech Recognition.</h1>
      </div>
    );
  }

  // ==================== Start / End Call logic =====================
  const handleStartCall = () => {
    setIsCall(true);

    // Clear any old logs
    setCallLog([]);
    setStage(0);
    setBackNForth([]);

    // The AI greeting
    setCallLog(["Support: Please let me know what you are dealing with?"]);
    // If not muted, start listening
    if (!isMute) {
      SpeechRecognition.startListening({
        continuous: true,
        interimResults: true,
      });
    }
  };

  const handleEndCall = () => {
    setIsCall(false);
    // Stop listening
    SpeechRecognition.stopListening();
    // Maybe reset stage or do final cleanup
  };

  // ==================== Mute logic =====================
  // "Mute" means we want to STOP speech recognition. "Unmute" means START again
  const handleToggleMute = () => {
    setIsMute((prev) => {
      const nextMuteValue = !prev;
      if (nextMuteValue) {
        // we are muting now -> stop listening
        SpeechRecognition.stopListening();
      } else if (isCall) {
        // if call is active, unmute -> start listening
        SpeechRecognition.startListening({
          continuous: true,
          interimResults: true,
        });
      }
      return nextMuteValue;
    });
  };

  // ==================== The rendered UI (unchanged visually) =====================
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
          Introducing our Mental Health Therapist, allowing us to stop the high
          levels of
        </div>
        <div className="font-poppins">
          depression and PTSD associated with the job, and help with
          under-staffed centers.
        </div>

        {/* Call log + partial speech */}
        <div className="flex flex-col bg-gray-100 text-black h-[350px] w-2/3 p-4 mt-2 font-poppins overflow-auto">
          {callLog.map((line, index) => (
            <div key={index}>{line}</div>
          ))}

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
          {loading && <div>Dispatching help... (Loading spinner, maybe)</div>}
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