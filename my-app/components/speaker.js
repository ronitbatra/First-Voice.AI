"use client";

import { useEffect, useState, useRef } from "react";

const Speaker = ({ text, isMute, onPlaybackStart, onPlaybackEnd }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioQueue, setAudioQueue] = useState([]);
  const audioRef = useRef(null);
  const currentAudioUrlRef = useRef(null);
  const [isBrowser, setIsBrowser] = useState(false);

  // Check if we're in a browser environment
  useEffect(() => {
    setIsBrowser(typeof window !== 'undefined');
  }, []);

  // Voice ID for Emily voice in Eleven Labs
  const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Emily voice ID
  const MODEL_ID = "eleven_turbo_v2"; // Eleven Flash 2.5 model

  // Eleven Labs API key
  const ELEVEN_LABS_API_KEY = process.env.NEXT_PUBLIC_ELEVEN_LABS_API_KEY || "your_api_key_here";

  useEffect(() => {
    // If new text arrives and not muted, convert to speech
    if (text && text.trim() !== "" && !isMute && isBrowser) {
      setAudioQueue(prevQueue => [...prevQueue, text]);
    }
  }, [text, isMute, isBrowser]);

  // Process the audio queue
  useEffect(() => {
    // Skip if not in browser
    if (!isBrowser) return;

    const processQueue = async () => {
      // If we're already playing audio or the queue is empty, don't do anything
      if (isPlaying || audioQueue.length === 0) {
        return;
      }

      // Take the first text from the queue
      const nextText = audioQueue[0];
      setAudioQueue(prevQueue => prevQueue.slice(1));

      // Skip if text is empty or we're muted
      if (!nextText || nextText.trim() === "" || isMute) {
        return;
      }

      try {
        setIsPlaying(true);
        if (onPlaybackStart) onPlaybackStart();

        // Convert text to speech using Eleven Labs API
        const audioUrl = await convertTextToSpeech(nextText);
        
        if (audioUrl) {
          currentAudioUrlRef.current = audioUrl;
          playAudio(audioUrl);
        } else {
          // Handle error in text-to-speech conversion
          console.error("Failed to convert text to speech");
          setIsPlaying(false);
          if (onPlaybackEnd) onPlaybackEnd();
        }
      } catch (error) {
        console.error("Error in text-to-speech process:", error);
        setIsPlaying(false);
        if (onPlaybackEnd) onPlaybackEnd();
      }
    };

    processQueue();
  }, [audioQueue, isPlaying, isMute, onPlaybackStart, onPlaybackEnd, isBrowser]);

  // Clean up audio URLs when component unmounts
  useEffect(() => {
    return () => {
      if (isBrowser && currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
    };
  }, [isBrowser]);

  // Function to convert text to speech using Eleven Labs API
  const convertTextToSpeech = async (text) => {
    if (!ELEVEN_LABS_API_KEY) {
      console.error("Eleven Labs API key is not provided");
      return null;
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": ELEVEN_LABS_API_KEY,
          },
          body: JSON.stringify({
            text: text,
            model_id: MODEL_ID,
            voice_settings: {
              stability: 0.7,         // Increased for clearer speech
              similarity_boost: 0.7,  // Increased for more consistent voice
              style: 0.5,             // Balanced style
              use_speaker_boost: true // Enable speaker boost
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Eleven Labs API error: ${response.status} - ${errorData}`);
      }

      // Get audio as blob
      const audioBlob = await response.blob();
      // Create URL for the audio blob
      const audioUrl = URL.createObjectURL(audioBlob);
      return audioUrl;
    } catch (error) {
      console.error("Error calling Eleven Labs API:", error);
      return null;
    }
  };

  // Function to play audio
  const playAudio = (audioUrl) => {
    if (!audioRef.current) return;

    // Set audio properties for optimal playback
    audioRef.current.src = audioUrl;
    audioRef.current.volume = 0.8; // Slightly lower volume to reduce mic pickup
    
    audioRef.current.play().catch((error) => {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
      if (onPlaybackEnd) onPlaybackEnd();
    });
  };

  // Handle audio playback end
  const handleAudioEnded = () => {
    setIsPlaying(false);
    if (onPlaybackEnd) onPlaybackEnd();
    
    // Clean up current audio URL
    if (isBrowser && currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
  };

  // If not in browser, return empty div
  if (!isBrowser) return <div className="hidden"></div>;

  return (
    <div className="hidden">
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={() => {
          console.error("Audio playback error");
          setIsPlaying(false);
          if (onPlaybackEnd) onPlaybackEnd();
        }}
      />
    </div>
  );
};

export default Speaker;