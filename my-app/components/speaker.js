"use client";

import React, { useEffect, useRef, useState } from "react";

export default function SpeakerComponent({ text_in, isDone }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (isDone) {
      const utterance = new window.SpeechSynthesisUtterance(text_in);
      window.speechSynthesis.speak(utterance);
    }
  }, [text_in, isDone]);
  return <></>;
}