"use client";

import Image from "next/image";
import Modal from "../components/Modal";
import { useState } from "react";
import { motion } from "framer-motion";

export default function Home() {
  const [language, setLanguage] = useState("English");
  const [isMute, setIsMute] = useState(false);
  const [isCall, setIsCall] = useState(false);
  const [isModal1Open, setModal1Open] = useState(false);

  const handleStartCall = () => {
    setIsCall(true);
    // Start speech recognition logic here
    // e.g., recognition.start()
  };

  const handleEndCall = () => {
    setIsCall(false);
    // Stop speech recognition logic
    // e.g., recognition.stop()
  };

  const handleToggleMute = () => {
    setIsMute((prev) => !prev);
    // If using speech recognition directly, consider stopping the mic
    // or toggling a "mute" setting in your code.
  };

  const handleOpenSettings = () => {
    // TODO: open a modal or route to a settings page
    console.log("Settings opened!");
  };

  return (
    <div className="min-h-screen bg-slate-700">
      <div className="flex flex-col items-center">
        <header className="font-bold text-4xl mt-24">First Voice AI</header>
        <p className="text-sm text-center mt-4">
          <a
            href="https://www.linkedin.com/in/"
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
            href="https://www.linkedin.com/in/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold"
          >
            Sagun Venuganti
          </a>
          , University of Virginia <br />
          <a target="_blank" rel="noopener noreferrer" className="font-bold">
            Phlo Habshy
          </a>
          , Virgina Tech
        </p>
        <div className="mt-4">
          Introducing our Mental Health Therapist, allowing us to stop the high
          levels of
        </div>
        <div>
          depression and PTSD associated with the job, and help with
          under-staffed centers.
        </div>

        {/* Call log */}
        <div className="flex flex-col bg-gray-100 text-black h-[250px] w-2/3 p-4 mt-2">
          {isCall ? "Chat in progress..." : "No active call. Start one!"}
          <br />
          {isMute ? "Muted (no audio captured)" : "Unmuted (audio capturing)"}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-row justify-center mt-4">
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
          Mute
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
