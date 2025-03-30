"use client";

import Image from "next/image";
import Modal from "./components/Modal";
import NavBar from "./components/NavBar";
import { useState, useEffect, useRef } from "react";
import { motion, useInView, useAnimation } from "framer-motion";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabase } from "../lib/supabase";
import Geolocation from "./components/Geolocation";

// 1) NEW - import speech recognition
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
// import Speaker from "../components/speaker";
import Speaker from "../components/speaker";

export default function Home() {
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
  const conversationBoxInView = useInView(conversationBoxRef, { once: true, amount: 0.2 });
  const buttonsInView = useInView(buttonsRef, { once: true, amount: 0.3 });
  const missionTitleInView = useInView(missionTitleRef, { once: true, amount: 0.3 });
  const missionBoxInView = useInView(missionBoxRef, { once: true, amount: 0.3 });
  
  // Animation controls
  const headerControls = useAnimation();
  const subtitleControls = useAnimation();
  const tryItControls = useAnimation();
  const conversationBoxControls = useAnimation();
  const buttonsControls = useAnimation();
  const missionTitleControls = useAnimation();
  const missionBoxControls = useAnimation();
  
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
  const [showingPersonalHelpQuestion, setShowingPersonalHelpQuestion] = useState(false);
  const [personalHelpAsked, setPersonalHelpAsked] = useState(false);
  const [personalHelpResponse, setPersonalHelpResponse] = useState(null);

  // Add state for transcript visibility toggle
  const [showTranscript, setShowTranscript] = useState(true);
  
  // New state for PDF and text-to-speech
  const [pdfUrl, setPdfUrl] = useState(null);
  const [currentSpeechText, setCurrentSpeechText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSummaryText, setCurrentSummaryText] = useState("");
  
  // Add state for location data
  const [userLocation, setUserLocation] = useState(null);
  const [localMentalHealthServices, setLocalMentalHealthServices] = useState([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [shouldRequestLocation, setShouldRequestLocation] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Wrap long lines to maximum 76 characters per line for PDF formatting
  const wrapToMaxLength = (text, maxLength = 76) => {
    const lines = text.split("\n");
    return lines.map(line => {
      // Skip short lines or empty lines
      if (line.length <= maxLength) return line;
      
      const wrappedLines = [];
      let currentLine = "";
      
      // Split by spaces to avoid breaking words
      const words = line.split(" ");
      
      for (const word of words) {
        // If adding this word exceeds the max length, start a new line
        if (currentLine.length + word.length + 1 > maxLength) {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          // Add to current line with a space if not the first word
          currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
      }
      
      // Add the last line if there's anything left
      if (currentLine) {
        wrappedLines.push(currentLine);
      }
      
      return wrappedLines.join("\n");
    }).join("\n");
  };

  // ================ react-speech-recognition variables ==================
  const {
    interimTranscript,
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // Add cleanup for PDF URL when component unmounts
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);
  
  // Add simple location permission request on app load
  useEffect(() => {
    // Check if geolocation is supported
    if ("geolocation" in navigator) {
      // Ask for location permission when the app loads
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Success - store basic location data
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(locationData);
        },
        (error) => {
          // Error or permission denied
          console.error("Geolocation error:", error.message);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser");
    }
  }, []);
  
  // Control speech recognition when AI is speaking to prevent echo
  useEffect(() => {
    if (isCallActive) {
      if (isSpeaking) {
        // Stop speech recognition while TTS is speaking
        console.log("TTS speaking - stopping speech recognition");
        SpeechRecognition.abortListening();
        resetTranscript();
      } else if (!isMute) {
        // Resume speech recognition after a short delay when TTS stops
        console.log("TTS stopped - resuming speech recognition after delay");
        const resumeTimer = setTimeout(() => {
          SpeechRecognition.startListening({
            continuous: true,
            interimResults: true,
          });
        }, 300); // Short delay to ensure the audio fully stops
        
        return () => clearTimeout(resumeTimer);
      }
    }
  }, [isSpeaking, isMute, isCallActive, resetTranscript]);
  
  // Trigger animations when elements come into view
  useEffect(() => {
    if (headerInView) headerControls.start({ opacity: 1, y: 0 });
    if (subtitleInView) subtitleControls.start({ opacity: 1, y: 0 });
    if (tryItInView) tryItControls.start({ opacity: 1, y: 0 });
    if (conversationBoxInView) conversationBoxControls.start({ opacity: 1, y: 0 });
    if (buttonsInView) buttonsControls.start({ opacity: 1, y: 0 });
    if (missionTitleInView) missionTitleControls.start({ opacity: 1, y: 0 });
    if (missionBoxInView) missionBoxControls.start({ opacity: 1, y: 0 });
  }, [
    headerInView, headerControls, 
    subtitleInView, subtitleControls, 
    tryItInView, tryItControls,
    conversationBoxInView, conversationBoxControls,
    buttonsInView, buttonsControls,
    missionTitleInView, missionTitleControls,
    missionBoxInView, missionBoxControls
  ]);

  // Show partial text live as the user speaks - enhanced for animation visibility
  useEffect(() => {
    if (interimTranscript) {
    setPartialSpeech(interimTranscript);
      
      // If we're in Voice Only mode, ensure the listening animation is visible
      if (!showTranscript && !listening) {
        SpeechRecognition.startListening({
          continuous: true,
          interimResults: true,
        });
      }
    }
  }, [interimTranscript, listening, showTranscript]);

  // Once the user stops speaking → finalTranscript is set
  useEffect(() => {
    // Skip processing if we're currently speaking or just finished (within 500ms)
    if (isSpeaking) {
      console.log("Ignoring transcript while TTS is active:", finalTranscript);
      resetTranscript();
      return;
    }
    
    if (finalTranscript && finalTranscript.trim() !== "") {
      // Check if this is likely an echo of the AI's message
      if (isLikelyAIEcho(finalTranscript)) {
        console.log("Detected AI echo, ignoring:", finalTranscript);
        resetTranscript();
        return;
      }
      
      // Add final transcript to call log for UI display purposes only
      setCallLog((prev) => [...prev, { type: "user", text: finalTranscript }]);
      
      // Clear partial speech
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
  }, [finalTranscript, resetTranscript, stage, currentQuestion, showingPersonalHelpQuestion, isSpeaking]);

  // Function to detect if transcript is likely an echo of AI's recent messages
  const isLikelyAIEcho = (transcript) => {
    // Clean the transcript for comparison
    const cleanedTranscript = transcript.toLowerCase().trim();
    
    // Get the 5 most recent AI messages
    const recentAIMessages = callLog
      .filter(item => item.type === "support" || item.type === "ai")
      .slice(-5)
      .map(item => item.text.toLowerCase());
    
    // Check for significant overlap with any recent AI message
    for (const aiMessage of recentAIMessages) {
      // Skip very short AI messages as they might cause false positives
      if (aiMessage.length < 10) continue;
      
      // If the transcript is a significant portion of an AI message
      // or the AI message is a significant portion of the transcript
      if (aiMessage.includes(cleanedTranscript) && cleanedTranscript.length > 5) {
        return true;
      }
      
      // Check if transcript contains a significant fragment of the AI message
      const words = aiMessage.split(' ');
      if (words.length >= 3) {
        // Look for 3+ consecutive words from the AI message in the transcript
        for (let i = 0; i <= words.length - 3; i++) {
          const phrase = words.slice(i, i + 3).join(' ');
          if (cleanedTranscript.includes(phrase) && phrase.length > 10) {
            return true;
          }
        }
      }
    }
    
    return false;
  };

  // ==================== Evaluate if an answer is sufficient (local UI check) ====================
  const evaluateAnswerSufficiency = (userText, questionNumber) => {
    // Check for brevity
    const wordCount = userText
      .split(/\s+/)
      .filter((word) => word.trim().length > 0).length;

    // Check for generic/one-word responses
    const genericResponses = ["yes", "no", "ok", "okay", "sure", "fine", "good", "bad", "maybe"];
    const isGenericResponse = genericResponses.includes(userText.toLowerCase().trim());

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
    console.log(`Stage: ${stage}, Question: ${currentQuestion}, User said: ${userSpokenText}`);

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
        const closingMessage = "Thank you for using First Voice. If you'd like to start a new session, please click 'End Call' and then 'Start Call'.";
        setCallLog((prev) => [
          ...prev,
          {
            type: "support",
            text: closingMessage,
          },
        ]);
        // Set the closing message for text-to-speech
        setCurrentSpeechText(closingMessage);
      }
      return;
    }

    try {
      setLoading(true);

      // Evaluate answer locally before calling the API
      const localAnswerCheck = evaluateAnswerSufficiency(userSpokenText, currentQuestion);
      console.log(`Local answer check: ${localAnswerCheck ? "Sufficient" : "Insufficient"}`);

      // Important: Instead of updating based on current state, create a copy
      // of the conversation history that includes the current user input
      // This ensures the AI response is generated with the most current context
      const updatedHistory = [
        ...conversationHistory,
        { role: "user", content: userSpokenText }
      ];

      // Make the API request with updated history
      const res = await fetch("/api/v1/query", {
        method: "POST",
        body: JSON.stringify({
          problem_description: "Mental health support",
          stage: 1, // Using stage 1 for the structured conversation flow
          last_reply: userSpokenText,
          history: updatedHistory, // Use updated history including current message
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
      setConversationHistory((prev) => [...prev, { role: "assistant", content: data.msg }]);
      setCallLog((prev) => [...prev, { type: "support", text: data.msg }]);
      
      // Set the AI response for text-to-speech
      setCurrentSpeechText(data.msg);

      // If answer is insufficient according to the API
      if (data.answerSufficient === false) {
        setRepeatQuestionCount((prev) => prev + 1);

        // If repeated too many times, forcibly move to next question to avoid loops
        if (repeatQuestionCount >= 2 && currentQuestion < 6) {
          console.log("Forcing question advance after multiple insufficient answers...");
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

        // Make the summary request with the full updated conversation history
        handleFinalSummary([...updatedHistory, { role: "assistant", content: data.msg }]);
      }

      setLoading(false);
    } catch (error) {
      console.error("API error:", error);
      setLoading(false);
      const errorMessage = "Sorry, I'm having trouble connecting. Could you try again?";
      setCallLog((prev) => [
        ...prev,
        {
          type: "error",
          text: errorMessage,
        },
      ]);
      // Set the error message for text-to-speech
      setCurrentSpeechText(errorMessage);
    }
  };

  // ==================== Helper function for final summary processing ====================
  const handleFinalSummary = async (history) => {
    // Show "thinking" messages
    setCallLog((prev) => [
      ...prev,
      { type: "support", text: "Thank you for sharing. Let me analyze this information..." },
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

      // Format the summary text with proper structure
      let triagePoints = "";
      if (typeof data2.triage === "string") {
        triagePoints = data2.triage;
      } else {
        // If triage is an object, convert it to string
        triagePoints = JSON.stringify(data2.triage);
      }

      // Process triage points to add line breaks after periods and ensure bullet points
      const processedTriagePoints = triagePoints
        .split("\n")
        .map(point => {
          // Split the point text by periods, but keep the periods
          return point.split(/(\.)/).map((segment, index, array) => {
            // If this is a period and not the last item, add a newline after it
            if (segment === "." && index < array.length - 1) {
              return segment + "\n";
            }
            return segment;
          }).join("");
        })
        .join("\n• ");

      const formattedTriagePoints = wrapToMaxLength(`${processedTriagePoints}`);

      const summaryText = `Key Points from Our Conversation:
${formattedTriagePoints}

Recommendations:
• Consider exploring coping strategies together
• Take time to process your feelings
• Remember that support is available when needed

Next Steps:
• Review these points at your own pace
• Reach out if you need additional support
• Consider connecting with mental health resources in your area`;

      // Store the summary for later PDF generation
      setCurrentSummaryText(summaryText);

      // Add the summary response to conversation history
      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content: `Summary: ${summaryText}` },
      ]);

      // Possibly include info about location-based resources
      let providerInfo = "";
      if (data2.openToHelp && data2.location && data2.location !== "their area") {
        providerInfo = `\n\nBased on your location (${data2.location}), you may want to explore mental health providers in your area. Would you like me to help you find local resources?`;
      }

      setLoading(false);

      // Create a combined message with intro and summary
      const fullSummaryMessage = `Based on our conversation, here's my assessment: ${summaryText}`;

      // Display final summary to user - simplified display
      setCallLog((prev) => {
        // Filter out any "analyzing" or "please hold" messages to avoid redundancy
        const filteredLog = prev.filter(entry => 
          !entry.text.includes("Let me analyze this information") && 
          !entry.text.includes("Please hold"));
        
        // Add the full summary as a single entry
        return [
          ...filteredLog,
          { type: "summary", text: fullSummaryMessage + providerInfo }
        ];
      });
      
      // Wait a bit before showing the personal help question
      setTimeout(() => {
        if (isCallActive) { // Only if still in a call
          generatePersonalHelpQuestion();
        }
      }, 2000);
    } catch (error) {
      console.error("Final summary API error:", error);
      setLoading(false);
      const errorMessage = "I'm having trouble processing your information. Our team will reach out to assist you.";
      setCallLog((prev) => [
        ...prev,
        {
          type: "error",
          text: errorMessage,
        },
      ]);
      // Set error message for TTS
      setCurrentSpeechText(errorMessage);
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
      const personalHelpQuestion = data.personalHelpQuestion || 
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
      
      // Set the question for text-to-speech
      setCurrentSpeechText(personalHelpQuestion);
      
      setPersonalHelpAsked(true);
      setShowingPersonalHelpQuestion(true);
      setLoading(false);
    } catch (error) {
      console.error("Personal help question error:", error);
      setLoading(false);
      
      // Fall back to a default question
      const defaultQuestion = "Would you like me to help you find mental health resources in your area?";
      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content: defaultQuestion },
      ]);
      setCallLog((prev) => [
        ...prev,
        { type: "support", text: defaultQuestion },
      ]);
      
      // Set the default question for text-to-speech
      setCurrentSpeechText(defaultQuestion);
      
      setPersonalHelpAsked(true);
      setShowingPersonalHelpQuestion(true);
    }
  };
  
  // Handler for location updates from the Geolocation component
  const handleLocationUpdate = (locationData) => {
    setUserLocation(locationData);
    if (locationData) {
      // Fetch mental health services based on location
      fetchLocalMentalHealthServices(locationData);
    } else {
      // If location access failed, still generate PDF but without local services
      setIsLoadingServices(false);
      generatePDFWithAvailableData();
    }
  };

  // Function to fetch mental health services using OpenAI web search
  const fetchLocalMentalHealthServices = async (location) => {
    try {
      setIsLoadingServices(true);
      
      const response = await fetch("/api/v1/searchServices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLocalMentalHealthServices(data.services || []);
    } else {
        console.error("Failed to fetch mental health services");
      }
    } catch (error) {
      console.error("Error fetching mental health services:", error);
    } finally {
      setIsLoadingServices(false);
      // Generate PDF after services are fetched (or failed to fetch)
      generatePDFWithAvailableData();
    }
  };

  // Function to generate PDF with available data (regardless of location data success)
  const generatePDFWithAvailableData = () => {
    if (currentSummaryText && !isGeneratingPDF) {
      setIsGeneratingPDF(true);
      generateAndStorePDF(currentSummaryText)
        .finally(() => {
          setIsGeneratingPDF(false);
        });
    }
  };
  
  // Handle user's response to the personal help question
  const handlePersonalHelpResponse = async (userResponse) => {
    // Check if the user's response is affirmative using an expanded list of keywords
    const affirmativeResponse = checkIfAffirmative(userResponse);
    
    setStage('completed');
    setIsCallActive(false);
    // Fix: replace stopListening() with SpeechRecognition.stopListening()
    SpeechRecognition.stopListening();
    
    // Extract the summary text from conversation history
    const summaryEntries = conversationHistory.filter(entry => 
      entry.role === 'assistant' && 
      entry.content.includes('Key Points from Our Conversation:')
    );
    
    let summaryText = '';
    if (summaryEntries.length > 0) {
      summaryText = summaryEntries[0].content;
    } else {
      // Fallback if no summary found
      summaryText = "Summary not available";
    }
    
    // Extract user context for provider recommendations
    const userContext = extractUserContext(conversationHistory);
    
    // Set the summary text for PDF generation
    setCurrentSummaryText(summaryText);
    
    // If the user's response was affirmative, proceed with generating the PDF
    if (affirmativeResponse) {
      // Update the call log with a loading message
      const loadingMessage = "I'm personalizing your recommendations based on our conversation...";
      setCallLog(prevLog => [
        ...prevLog,
        { role: 'assistant', content: loadingMessage }
      ]);
      
      // Set loading state
      setLoading(true);
      
      try {
        // Call the API for personalized final comments and doctor recommendations
        const response = await fetch("/api/v1/doctorRecommendations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: summaryText,
            userContext: userContext
          }),
        });
        
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }
        
        // Parse the API response
        const data = await response.json();
        
        // Save the personalized comments and recommendations for the PDF
        const finalComments = data.finalComments;
        const doctorRecommendations = data.doctorRecommendations;
        
        // Clear the loading message
        setLoading(false);
        
        // Update the call log with a confirmation message (without the resources)
        const confirmationMessage = "Thank you for your response. I've included personalized recommendations and resources in your PDF summary. If you need immediate assistance, please reach out to a mental health professional or crisis service.";
        
        // Update the call log with a confirmation message (used for display only)
        setCallLog(prevLog => [
          ...prevLog.filter(item => item.content !== loadingMessage), // Remove loading message
          { role: 'assistant', content: confirmationMessage }
        ]);
        
        // Add to conversation history (this doesn't get read aloud)
        setConversationHistory(prevHistory => [
          ...prevHistory,
          { role: 'assistant', content: confirmationMessage }
        ]);
        
        // Generate the PDF with the summary text, user context, and personalized recommendations
        generateAndStorePDF(summaryText, userContext, finalComments, doctorRecommendations);
        
      } catch (error) {
        console.error("Error fetching personalized recommendations:", error);
        setLoading(false);
        
        // Update the call log with an error message
        const errorMessage = "I wasn't able to personalize your recommendations, but I've included general resources in your PDF summary.";
        setCallLog(prevLog => [
          ...prevLog.filter(item => item.content !== loadingMessage), // Remove loading message
          { role: 'assistant', content: errorMessage }
        ]);
        
        // Generate PDF without personalized recommendations
        generateAndStorePDF(summaryText, userContext);
      }
    } else {
      // If the user's response was negative, acknowledge it without generating PDF
      const declineMessage = "I understand. Thank you for your time. If you change your mind or need support in the future, feel free to start a new conversation.";
      setCallLog(prevLog => [
        ...prevLog,
        { role: 'assistant', content: declineMessage }
      ]);
      
      // Add to conversation history
      setConversationHistory(prevHistory => [
        ...prevHistory,
        { role: 'assistant', content: declineMessage }
      ]);
      
      // Set the decline message for text-to-speech
      setCurrentSpeechText(declineMessage);
    }
  };

  // Function to check if a response is affirmative
  const checkIfAffirmative = (response) => {
    if (!response) return false;
    
    const lowerReply = response.toLowerCase().trim();
    
    // Expanded list of affirmative words and phrases
    const affirmativeWords = [
      "yes", "yeah", "yea", "yep", "sure", "ok", "okay", 
      "of course", "definitely", "absolutely", "love to", 
      "would love", "certainly", "please", "i would", 
      "why not", "sounds good", "good idea", "open", "willing"
    ];
    
    // Check if any affirmative words are included in the response
    return affirmativeWords.some(word => lowerReply.includes(word)) || 
           !lowerReply.includes("no");
  }

  // Function to extract relevant context from the conversation
  const extractUserContext = (conversation) => {
    // Initialize context object
    const context = {
      concerns: [],
      symptoms: [],
      preferences: [],
      demographic: {
        age: null,
        gender: null,
        location: null
      }
    };
    
    // Keywords to look for in the conversation
    const concernKeywords = {
      'anxiety': ['anxiety', 'anxious', 'worry', 'panic', 'stress', 'nervous'],
      'depression': ['depression', 'depressed', 'sad', 'hopeless', 'unmotivated', 'low mood', 'down'],
      'trauma': ['trauma', 'ptsd', 'traumatic', 'abuse', 'assault'],
      'grief': ['grief', 'loss', 'died', 'death', 'passed away', 'bereavement'],
      'substance use': ['alcohol', 'drug', 'substance', 'addiction', 'drinking'],
      'ocd': ['ocd', 'obsessive', 'compulsive', 'intrusive thoughts', 'rituals'],
      'bipolar': ['bipolar', 'mania', 'manic', 'mood swings'],
      'eating disorder': ['eating', 'anorexia', 'bulimia', 'binge', 'food'],
      'insomnia': ['insomnia', 'sleep', 'trouble sleeping', 'nightmares', 'can\'t sleep'],
      'relationship': ['relationship', 'marriage', 'partner', 'divorce', 'family', 'parents'],
      'school': ['school', 'college', 'university', 'academic', 'grades', 'exam']
    };
    
    const symptomKeywords = {
      'fatigue': ['tired', 'fatigue', 'exhausted', 'no energy', 'lethargy'],
      'concentration': ['focus', 'concentrate', 'attention', 'distracted'],
      'appetite': ['appetite', 'eating', 'weight', 'hungry', 'food'],
      'pain': ['pain', 'ache', 'headache', 'migraine', 'hurt'],
      'panic attacks': ['panic attack', 'heart racing', 'hyperventilate', 'can\'t breathe'],
      'social isolation': ['lonely', 'isolated', 'alone', 'withdrawal', 'no friends'],
      'self-harm': ['self-harm', 'cutting', 'hurt myself'],
      'suicidal': ['suicidal', 'kill myself', 'end it all', 'no point in living']
    };
    
    const preferenceKeywords = {
      'therapy': ['therapy', 'therapist', 'counseling', 'talk therapy', 'psychotherapy'],
      'medication': ['medication', 'meds', 'prescription', 'drug', 'antidepressant'],
      'cbt': ['cbt', 'cognitive', 'behavioral', 'behaviour'],
      'group': ['group therapy', 'support group', 'group session'],
      'female provider': ['female', 'woman', 'not a man'],
      'male provider': ['male', 'man', 'not a woman'],
      'virtual': ['online', 'virtual', 'zoom', 'telehealth', 'remote'],
      'in-person': ['face to face', 'in person', 'in-person', 'office']
    };
    
    // Extract user name and location if available
    for (const message of conversation) {
      if (message.role === 'user') {
        const content = message.content.toLowerCase();
        
        // Check for name information
        const nameMatch = content.match(/my name is (\w+)/i) || 
                         content.match(/i(?:')?m (\w+)/i) ||
                         content.match(/(\w+) is my name/i);
        
        if (nameMatch && nameMatch[1]) {
          context.name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
        }
        
        // Check for location information
        const locationMatch = content.match(/from (\w+)/i) || 
                             content.match(/live in (\w+)/i) ||
                             content.match(/in (\w+) city/i);
                             
        if (locationMatch && locationMatch[1]) {
          context.demographic.location = locationMatch[1];
        }
        
        // Check for age information
        const ageMatch = content.match(/(\d+) years old/i) || 
                        content.match(/(\d+) year old/i) ||
                        content.match(/i(?:')?m (\d+)/i) ||
                        content.match(/age (?:is|of) (\d+)/i);
                        
        if (ageMatch && ageMatch[1]) {
          context.demographic.age = parseInt(ageMatch[1], 10);
        }
        
        // Check for gender information
        if (content.includes('male') || content.includes('man') || content.includes('guy') || 
            content.includes('boy') || content.includes('he/him')) {
          context.demographic.gender = 'male';
        } else if (content.includes('female') || content.includes('woman') || content.includes('girl') || 
                   content.includes('lady') || content.includes('she/her')) {
          context.demographic.gender = 'female';
        } else if (content.includes('non-binary') || content.includes('enby') || 
                   content.includes('they/them') || content.includes('genderqueer')) {
          context.demographic.gender = 'non-binary';
        }
        
        // Check for concerns
        for (const [concern, keywords] of Object.entries(concernKeywords)) {
          for (const keyword of keywords) {
            if (content.includes(keyword)) {
              if (!context.concerns.includes(concern)) {
                context.concerns.push(concern);
              }
              break;
            }
          }
        }
        
        // Check for symptoms
        for (const [symptom, keywords] of Object.entries(symptomKeywords)) {
          for (const keyword of keywords) {
            if (content.includes(keyword)) {
              if (!context.symptoms.includes(symptom)) {
                context.symptoms.push(symptom);
              }
              break;
            }
          }
        }
        
        // Check for preferences
        for (const [preference, keywords] of Object.entries(preferenceKeywords)) {
          for (const keyword of keywords) {
            if (content.includes(keyword)) {
              if (!context.preferences.includes(preference)) {
                context.preferences.push(preference);
              }
              break;
            }
          }
        }
      }
    }
    
    return context;
  };

  // Generate and store PDF with conversation summary
  const generateAndStorePDF = async (text, userContext = null, finalComments = null, doctorRecommendations = null) => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([550, 750]);
      const { height, width } = page.getSize();
      
      // Load fonts
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      
      // Add the title in bold, large text
      page.drawText('Summary Of Pre-Screening', {
        x: 50,
        y: height - 50,
        size: 18,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      // Add a line under the title
      page.drawLine({
        start: { x: 50, y: height - 60 },
        end: { x: width - 50, y: height - 60 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      
      // Process the text content with special formatting for section headings
      const textLines = text.split('\n');
      let yPosition = height - 90; // Start below the title and line
      
      textLines.forEach(line => {
        if (yPosition < 50) {
          // Add a new page if we're running out of space
          const newPage = pdfDoc.addPage([550, 750]);
          yPosition = newPage.getSize().height - 50;
        }
        
        // Check if this line is a section heading that should be bolded
        const isBoldHeading = 
          line.includes('Key Points from Our Conversation:') || 
          line.includes('Recommendations:') ||
          line.includes('Next Steps:');
        
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: isBoldHeading ? 14 : 12, // Slightly larger for headings
          font: isBoldHeading ? boldFont : regularFont,
          color: rgb(0, 0, 0),
        });
        
        // Add more space after headings
        yPosition -= isBoldHeading ? 25 : 20;
      });
      
      // Add AI-generated personalized doctor recommendations if available
      if (doctorRecommendations && doctorRecommendations.length > 0) {
        let recommendationsPage = pdfDoc.addPage([550, 750]);
        const { height: recHeight, width: recWidth } = recommendationsPage.getSize();
        let recYPosition = recHeight - 50;
        
        // Add the title for doctor recommendations
        recommendationsPage.drawText('Personalized Healthcare Provider Recommendations', {
          x: 50,
          y: recYPosition,
          size: 18,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        
        recYPosition -= 20;
        
        // Add a line under the title
        recommendationsPage.drawLine({
          start: { x: 50, y: recYPosition },
          end: { x: recWidth - 50, y: recYPosition },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
        
        recYPosition -= 40;
        
        // Introduction text
        const introText = "Based on the information shared during your conversation, the following healthcare providers may be appropriate for your needs:";
        
        recommendationsPage.drawText(introText, {
          x: 50,
          y: recYPosition,
          size: 12,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
        
        recYPosition -= 30;
        
        // Add each recommended provider
        for (const rec of doctorRecommendations) {
          if (recYPosition < 150) {
            // Add a new page if we're running out of space
            const newRecPage = pdfDoc.addPage([550, 750]);
            recYPosition = newRecPage.getSize().height - 50;
            // Update the recommendationsPage reference to the new page
            recommendationsPage = newRecPage;
          }
          
          // Provider type
          recommendationsPage.drawText(rec.providerType, {
            x: 50,
            y: recYPosition,
            size: 14,
            font: boldFont,
            color: rgb(0, 0, 0),
          });
          
          recYPosition -= 25;
          
          // Rationale
          recommendationsPage.drawText("Why recommended:", {
            x: 50,
            y: recYPosition,
            size: 12,
            font: italicFont,
            color: rgb(0, 0, 0),
          });
          
          recYPosition -= 20;
          
          const rationaleLines = wrapToMaxLength(rec.rationale, 76).split('\n');
          for (const line of rationaleLines) {
            recommendationsPage.drawText(line, {
              x: 60,
              y: recYPosition,
              size: 11,
              font: regularFont,
              color: rgb(0, 0, 0),
            });
            
            recYPosition -= 15;
          }
          
          recYPosition -= 5;
          
          // Expectations
          recommendationsPage.drawText("What to expect:", {
            x: 50,
            y: recYPosition,
            size: 12,
            font: italicFont,
            color: rgb(0, 0, 0),
          });
          
          recYPosition -= 20;
          
          const expectationsLines = wrapToMaxLength(rec.expectations, 76).split('\n');
          for (const line of expectationsLines) {
            recommendationsPage.drawText(line, {
              x: 60,
              y: recYPosition,
              size: 11,
              font: regularFont,
              color: rgb(0, 0, 0),
            });
            
            recYPosition -= 15;
          }
          
          recYPosition -= 5;
          
          // Credentials
          recommendationsPage.drawText("Credentials to look for:", {
            x: 50,
            y: recYPosition,
            size: 12,
            font: italicFont,
            color: rgb(0, 0, 0),
          });
          
          recYPosition -= 20;
          
          const credentialsLines = wrapToMaxLength(rec.credentials, 76).split('\n');
          for (const line of credentialsLines) {
            recommendationsPage.drawText(line, {
              x: 60,
              y: recYPosition,
              size: 11,
              font: regularFont,
              color: rgb(0, 0, 0),
            });
            
            recYPosition -= 15;
          }
          
          recYPosition -= 30; // Add space between providers
        }
        
        // Disclaimer
        recYPosition = Math.max(recYPosition, 70);
        
        const disclaimerText = "Note: These recommendations are based on the information provided during your conversation. Always consult with healthcare professionals for personalized advice.";
        const disclaimerLines = wrapToMaxLength(disclaimerText, 76).split('\n');
        
        for (const line of disclaimerLines) {
          recommendationsPage.drawText(line, {
            x: 50,
            y: recYPosition,
            size: 10,
            font: italicFont,
            color: rgb(0, 0, 0),
            opacity: 0.8,
          });
          
          recYPosition -= 14;
        }
      }
      
      // If user context exists, add recommended providers section (general types)
      if (userContext && (userContext.concerns.length > 0 || userContext.symptoms.length > 0) && !doctorRecommendations) {
        const recommendedProvidersPage = pdfDoc.addPage([550, 750]);
        const { height: recHeight, width: recWidth } = recommendedProvidersPage.getSize();
        let recYPosition = recHeight - 50;
        
        // Add the title for recommended providers
        recommendedProvidersPage.drawText('Recommended Provider Types', {
          x: 50,
          y: recYPosition,
          size: 18,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        
        recYPosition -= 20;
        
        // Add a line under the title
        recommendedProvidersPage.drawLine({
          start: { x: 50, y: recYPosition },
          end: { x: recWidth - 50, y: recYPosition },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
        
        recYPosition -= 30;
        
        // Create personalized recommendations based on user context
        const recommendations = generateRecommendations(userContext);
        
        // Add introduction text with personalization if available
        let introText = "Based on your conversation, here are provider types that may be appropriate for your needs:";
        if (userContext.name) {
          introText = `${userContext.name}, based on your conversation, here are provider types that may be appropriate for your needs:`;
        }
        
        recommendedProvidersPage.drawText(introText, {
          x: 50,
          y: recYPosition,
          size: 12,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
        
        recYPosition -= 30;
        
        // Add each recommended provider type
        for (const rec of recommendations) {
          // Check if we need a new page
          if (recYPosition < 100) {
            const newPage = pdfDoc.addPage([550, 750]);
            recYPosition = newPage.getSize().height - 50;
          }
          
          // Add provider type title
          recommendedProvidersPage.drawText(rec.title, {
            x: 50,
            y: recYPosition,
            size: 14,
            font: boldFont,
            color: rgb(0, 0, 0),
          });
          
          recYPosition -= 20;
          
          // Add description
          const descriptionLines = wrapToMaxLength(rec.description, 76).split('\n');
          for (const line of descriptionLines) {
            recommendedProvidersPage.drawText(line, {
              x: 60,
              y: recYPosition,
              size: 11,
              font: regularFont,
              color: rgb(0, 0, 0),
            });
            
            recYPosition -= 16;
          }
          
          // Add when to consider this provider type
          if (rec.whenToConsider) {
            recYPosition -= 5;
            recommendedProvidersPage.drawText('When to consider:', {
              x: 60,
              y: recYPosition,
              size: 11,
              font: boldFont,
              color: rgb(0, 0, 0),
            });
            
            recYPosition -= 16;
            
            const considerationLines = wrapToMaxLength(rec.whenToConsider, 74).split('\n');
            for (const line of considerationLines) {
              recommendedProvidersPage.drawText(line, {
                x: 70,
                y: recYPosition,
                size: 11,
                font: regularFont,
                color: rgb(0, 0, 0),
              });
              
              recYPosition -= 16;
            }
          }
          
          recYPosition -= 15;
        }
        
        // Add notes at the bottom
        recYPosition = Math.max(recYPosition, 70); // Ensure we're not too low on the page
        
        const noteText = wrapToMaxLength("Note: These recommendations are based on common approaches to care. Your specific needs may vary. Always consult with a healthcare professional to determine the most appropriate treatment plan for your individual situation.", 76);
        
        const noteLines = noteText.split('\n');
        for (const line of noteLines) {
          recommendedProvidersPage.drawText(line, {
            x: 50,
            y: recYPosition,
            size: 10,
            font: regularFont,
            color: rgb(0, 0, 0),
            opacity: 0.8,
          });
          
          recYPosition -= 14;
        }
      }
      
      // Always add a page with general mental health resources
      const resourcesPage = pdfDoc.addPage([550, 750]);
      const { height: resHeight, width: resWidth } = resourcesPage.getSize();
      let resourcesYPosition = resHeight - 50;
      
      // Add the title for resources
      resourcesPage.drawText('Mental Health Resources', {
        x: 50,
        y: resourcesYPosition,
        size: 18,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      resourcesYPosition -= 20;
      
      // Add a line under the title
      resourcesPage.drawLine({
        start: { x: 50, y: resourcesYPosition },
        end: { x: resWidth - 50, y: resourcesYPosition },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      
      resourcesYPosition -= 30;
      
      // Add standard resources text
      const resourcesText = 
`Here are some mental health resources that might help:

• National Mental Health Hotline: 988 - Available 24/7 for crisis support
• Crisis Text Line: Text HOME to 741741 for immediate text-based support
• BetterHelp: Online therapy platform with licensed professionals (betterhelp.com)
• Psychology Today: Directory to find therapists in your area (psychologytoday.com/us/therapists)
• SAMHSA's National Helpline: 1-800-662-4357 - Treatment referral service
• National Alliance on Mental Illness (NAMI): Support groups and education (nami.org)
• Mental Health America: Resources and support at mhanational.org`;
      
      // Apply line wrapping to resources text
      const wrappedResourcesText = wrapToMaxLength(resourcesText);
      
      // Split into lines for proper formatting
      const resourceLines = wrappedResourcesText.split('\n');
      
      for (const line of resourceLines) {
        if (resourcesYPosition < 50) {
          // Add a new page if we're running out of space
          const newPage = pdfDoc.addPage([550, 750]);
          resourcesYPosition = newPage.getSize().height - 50;
        }
        
        // Check if this is a bullet point line that needs different formatting
        const isBulletPoint = line.trim().startsWith('•');
        
        resourcesPage.drawText(line, {
          x: 50,
          y: resourcesYPosition,
          size: isBulletPoint ? 12 : (line.trim() === '' ? 10 : 12),
          font: line.includes('Here are some mental health resources') ? boldFont : regularFont,
          color: rgb(0, 0, 0),
        });
        
        // Add appropriate spacing between lines
        resourcesYPosition -= line.trim() === '' ? 10 : 20;
      }
      
      // Add Final Comments section after resources list
      resourcesYPosition -= 20; // Add extra space before new section
      
      // Add the title for final comments
      resourcesPage.drawText('Final Comments', {
        x: 50,
        y: resourcesYPosition,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      resourcesYPosition -= 20;
      
      // Add a line under the title
      resourcesPage.drawLine({
        start: { x: 50, y: resourcesYPosition },
        end: { x: resWidth - 50, y: resourcesYPosition },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      
      resourcesYPosition -= 30;
      
      // Add personalized final comments if available, otherwise use default
      const finalMessage = finalComments || "Remember that reaching out is a sign of strength. Support is always available when you need it.";
      const wrappedFinalMessage = wrapToMaxLength(finalMessage);
      const finalMessageLines = wrappedFinalMessage.split('\n');
      
      for (const line of finalMessageLines) {
        resourcesPage.drawText(line, {
          x: 50,
          y: resourcesYPosition,
          size: 12,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
        
        resourcesYPosition -= 20;
      }
      
      // Add local mental health services if available
      if (localMentalHealthServices && localMentalHealthServices.length > 0 && userLocation) {
        // Use a new page for local resources if needed
        if (resourcesYPosition < 200) {
          const localServicesPage = pdfDoc.addPage([550, 750]);
          resourcesYPosition = localServicesPage.getSize().height - 50;
        } else {
          resourcesYPosition -= 30; // Add extra space before local resources section
        }
        
        // Add the title for local services
        resourcesPage.drawText('Local Mental Health Services', {
          x: 50,
          y: resourcesYPosition,
          size: 16,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        
        resourcesYPosition -= 20;
        
        // Add a line under the title
        resourcesPage.drawLine({
          start: { x: 50, y: resourcesYPosition },
          end: { x: resWidth - 50, y: resourcesYPosition },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
        
        resourcesYPosition -= 30;
        
        // Add intro text
        const introText = `Based on your location (approximately ${userLocation.latitude.toFixed(2)}, ${userLocation.longitude.toFixed(2)}), we've found the following mental health services near you:`;
        
        resourcesPage.drawText(introText, {
          x: 50,
          y: resourcesYPosition,
          size: 12,
          font: regularFont,
          color: rgb(0, 0, 0),
          lineHeight: 14,
          maxWidth: resWidth - 100,
        });
        
        resourcesYPosition -= 40;
        
        // List each service
        for (const service of localMentalHealthServices) {
          // Check if we need a new page
          if (resourcesYPosition < 100) {
            const newPage = pdfDoc.addPage([550, 750]);
            resourcesYPosition = newPage.getSize().height - 50;
          }
          
          // Add service name
          resourcesPage.drawText(service.name || "Mental Health Service", {
            x: 50,
            y: resourcesYPosition,
            size: 14,
            font: boldFont,
            color: rgb(0, 0, 0),
          });
          
          resourcesYPosition -= 20;
          
          // Add address if available
          if (service.address) {
            resourcesPage.drawText(service.address, {
              x: 60,
              y: resourcesYPosition,
              size: 12,
              font: regularFont,
              color: rgb(0, 0, 0),
            });
            
            resourcesYPosition -= 20;
          }
          
          // Add phone if available
          if (service.phone) {
            resourcesPage.drawText(`Phone: ${service.phone}`, {
              x: 60,
              y: resourcesYPosition,
              size: 12,
              font: regularFont,
              color: rgb(0, 0, 0),
            });
            
            resourcesYPosition -= 20;
          }
          
          // Add description if available
          if (service.description) {
            const descriptionLines = service.description.match(/.{1,70}/g) || [service.description];
            for (const line of descriptionLines) {
              resourcesPage.drawText(line, {
                x: 60,
                y: resourcesYPosition,
                size: 10,
                font: regularFont,
                color: rgb(0, 0, 0),
              });
              
              resourcesYPosition -= 15;
            }
          }
          
          resourcesYPosition -= 20; // Extra space between services
        }
        
        // Add a note at the bottom
        resourcesYPosition = Math.max(resourcesYPosition, 50); // Ensure we're not too low on the page
        
        resourcesPage.drawText("Note: Please verify service details before visiting. Hours and availability may vary.", {
          x: 50,
          y: resourcesYPosition,
          size: 10,
          font: regularFont,
          color: rgb(0, 0, 0),
          opacity: 0.7,
        });
      }
      
      // Save the PDF as bytes
      const pdfBytes = await pdfDoc.save();
      
      // Convert to base64 for storage and download
      const base64String = Buffer.from(pdfBytes).toString('base64');
      
      // Try to store in Supabase if available - only store the text content, not the full PDF
      try {
        if (supabase) {
          // Create a simpler text content object to store instead of the full PDF
          
          
          // Store just the text content as JSON
          const { data, error } = await supabase
            .from("PDF Summary") // Using a table instead of storage bucket
            .insert([{
              pdf:base64String,
            },
          ]);
          
          if (error) {
            console.error('Supabase storage error:', error);
          }
        }
      } catch (storageError) {
        console.error('Error storing text in Supabase:', storageError);
      }
      
      // Set the PDF URL for download regardless of storage success
      downloadPDF(base64String);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  // Function to generate provider recommendations based on user context
  const generateRecommendations = (context) => {
    const recommendations = [];
    
    // Default recommendations that everyone gets
    recommendations.push({
      title: "Primary Care Physician (PCP)",
      description: "A family doctor who can provide initial evaluation, basic mental health care, and referrals to specialists.",
      whenToConsider: "Consider as a first step, especially if you're unsure where to start or have related physical health concerns."
    });
    
    // Check for severe symptoms that require immediate attention
    if (context.symptoms.includes('suicidal') || context.symptoms.includes('self-harm')) {
      recommendations.unshift({
        title: "Emergency Services / Crisis Care",
        description: "Immediate care for urgent mental health crises. This includes emergency departments, crisis response teams, and psychiatric emergency services.",
        whenToConsider: "Seek immediately if you're experiencing thoughts of harming yourself or others, or are in a mental health crisis."
      });
    }
    
    // Check for concerns that typically benefit from therapy
    const therapyIndications = ['anxiety', 'depression', 'grief', 'trauma', 'relationship', 'stress'];
    if (context.concerns.some(concern => therapyIndications.includes(concern))) {
      recommendations.push({
        title: "Licensed Therapist or Counselor",
        description: "Mental health professionals who provide talk therapy. They help with a wide range of concerns through evidence-based approaches like cognitive-behavioral therapy (CBT), dialectical behavior therapy (DBT), or other modalities.",
        whenToConsider: "Ideal for addressing anxiety, depression, grief, relationship issues, stress management, and processing life changes or past experiences."
      });
    }
    
    // Check for conditions that often benefit from psychiatry
    const psychiatryIndications = ['depression', 'anxiety', 'bipolar', 'ocd', 'ptsd', 'insomnia'];
    if (context.concerns.some(concern => psychiatryIndications.includes(concern)) || 
        context.preferences.includes('medication')) {
      recommendations.push({
        title: "Psychiatrist",
        description: "Medical doctors specializing in mental health who can diagnose conditions and prescribe medication. They focus on the biological aspects of mental health and medication management.",
        whenToConsider: "Consider when symptoms are severe, significantly impact daily functioning, or haven't improved with therapy alone. Particularly helpful for conditions like depression, anxiety disorders, bipolar disorder, ADHD, or psychotic disorders."
      });
    }
    
    // Trauma-specific providers
    if (context.concerns.includes('trauma') || context.concerns.includes('ptsd')) {
      recommendations.push({
        title: "Trauma-Informed Therapist",
        description: "Specialists trained in addressing trauma through approaches like EMDR (Eye Movement Desensitization and Reprocessing), trauma-focused CBT, or somatic experiencing.",
        whenToConsider: "Particularly helpful if you've experienced traumatic events and are dealing with symptoms like flashbacks, nightmares, hypervigilance, or avoidance behaviors."
      });
    }
    
    // Substance use specialists
    if (context.concerns.includes('substance use') || context.concerns.includes('addiction')) {
      recommendations.push({
        title: "Addiction Specialist/Substance Use Counselor",
        description: "Professionals focused on helping people recover from substance use disorders and addictive behaviors through counseling, support groups, and recovery planning.",
        whenToConsider: "Consider if you're struggling with alcohol, drugs, or other addictive behaviors that are affecting your life, relationships, or health."
      });
    }
    
    // Group therapy options
    if (context.symptoms.includes('social isolation') || context.preferences.includes('group')) {
      recommendations.push({
        title: "Support Groups / Group Therapy",
        description: "Facilitated groups where people with similar experiences share support and coping strategies. These can be peer-led or professionally moderated.",
        whenToConsider: "Particularly helpful for building community, reducing isolation, and connecting with others who understand your experiences. Often valuable as a supplement to individual therapy."
      });
    }
    
    // CBT specialist
    if (context.preferences.includes('cbt') || 
        context.concerns.includes('anxiety') || 
        context.concerns.includes('ocd')) {
      recommendations.push({
        title: "Cognitive-Behavioral Therapist (CBT Specialist)",
        description: "Therapists specifically trained in cognitive-behavioral therapy, which focuses on identifying and changing unhelpful thought patterns and behaviors.",
        whenToConsider: "Particularly effective for anxiety disorders, OCD, phobias, and depression. CBT is a structured, goal-oriented approach that typically involves developing specific skills and completing between-session exercises."
      });
    }
    
    // Consider child/adolescent specialists
    if (context.demographic.age && context.demographic.age < 18) {
      recommendations.push({
        title: "Child/Adolescent Specialist",
        description: "Mental health professionals with specific training in working with children and teenagers. This might include child psychologists, adolescent psychiatrists, or family therapists.",
        whenToConsider: "Essential for young people, as they require age-appropriate approaches. These specialists understand developmental stages and how mental health concerns uniquely affect young people."
      });
    }
    
    // Gender-specific providers if indicated by preferences
    if (context.preferences.includes('female provider') || context.preferences.includes('male provider')) {
      const genderPref = context.preferences.includes('female provider') ? 'female' : 'male';
      recommendations.push({
        title: `${genderPref.charAt(0).toUpperCase() + genderPref.slice(1)} Mental Health Provider`,
        description: `Many people feel more comfortable discussing certain issues with a ${genderPref} provider. Most provider directories allow you to filter by gender.`,
        whenToConsider: `Consider if you have a strong preference for working with a ${genderPref} provider, particularly if discussing sensitive topics or if past experiences make this important for your comfort.`
      });
    }
    
    return recommendations;
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
    setPdfUrl(null);
    setCurrentSpeechText("");

    // Start directly with the name/location question (second question)
    const firstQuestion = "Hi there! I'm FirstVoice, your supportive companion. I'm here to talk about anything that's on your mind. What's your first name? ";

    // Add the question as the first message
    setCallLog([{ type: "support", text: firstQuestion }]);
    setConversationHistory([{ role: "assistant", content: firstQuestion }]);
    
    // Set the question for text-to-speech
    setCurrentSpeechText(firstQuestion);

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

  // Function to convert base64 to PDF and set the download URL
  const downloadPDF = (base64String) => {
    // Convert base64 to blob
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });

    // Create URL for the blob and update state
    const url = window.URL.createObjectURL(blob);
    setPdfUrl(url);
  };

  // ==================== Render UI ====================
  return (
    <main className="pb-0">
      {/* Add the Speaker component */}
      <Speaker 
        text={currentSpeechText} 
        isMute={isMute} 
        onPlaybackStart={() => setIsSpeaking(true)}
        onPlaybackEnd={() => {
          setIsSpeaking(false);
          setCurrentSpeechText("");
        }}
      />
      
      {/* Geolocation component - no UI */}
      {shouldRequestLocation && (
        <Geolocation onLocationUpdate={handleLocationUpdate} />
      )}
      
      {/* PDF Download Button - shown whenever PDF is available */}
      {pdfUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed bottom-8 right-8 z-50"
        >
          <motion.a
            href={pdfUrl}
            download="mental-health-summary.pdf"
            className="bg-gradient-to-r from-orange-600 to-orange-500 py-3 px-6 text-white rounded-lg hover:from-orange-500 hover:to-orange-400 shadow-lg flex items-center"
            whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 2C5.9 2 5 2.9 5 4V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V8L13 2H7ZM7 4H12V9H17V20H7V4ZM9 12C9 12.55 9.45 13 10 13H14C14.55 13 15 12.55 15 12C15 11.45 14.55 11 14 11H10C9.45 11 9 11.45 9 12ZM9 16C9 16.55 9.45 17 10 17H14C14.55 17 15 16.55 15 16C15 15.45 14.55 15 14 15H10C9.45 15 9 15.45 9 16Z"/>
            </svg>
            Download PDF Summary
          </motion.a>
        </motion.div>
      )}
      
      {/* Show a loading indicator when fetching services or generating PDF */}
      {(isLoadingServices || isGeneratingPDF) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed bottom-8 left-8 z-50 bg-blue-600 text-white py-2 px-4 rounded-lg shadow-lg"
        >
          <div className="flex items-center">
            <svg className="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {isGeneratingPDF ? "Generating PDF..." : "Finding local resources..."}
        </div>
        </motion.div>
      )}
      
      {/* Global styles for all animations */}
      <style jsx global>{`
        @keyframes gradient {
          0% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
        
        /* Audio wave animation styles */
        @keyframes wave {
          0% { height: 10px; }
          50% { height: 80px; }
          100% { height: 10px; }
        }
        
        @keyframes userWave {
          0% { height: 10px; }
          50% { height: 80px; transform: scaleY(1); }
          100% { height: 10px; }
        }
        
        @keyframes aiWave {
          0% { height: 10px; transform: scaleY(0.8); }
          25% { height: 40px; transform: scaleY(1); }
          50% { height: 60px; transform: scaleY(1.1); }
          75% { height: 40px; transform: scaleY(1); }
          100% { height: 10px; transform: scaleY(0.8); }
        }
        
        @keyframes processingWave {
          0% { height: 5px; width: 8px; }
          50% { height: 15px; width: 10px; }
          100% { height: 5px; width: 8px; }
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
          transition: background 0.3s ease;
        }
        
        /* Enhanced background animations */
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-15px) rotate(2deg); }
          50% { transform: translateY(-30px) rotate(5deg); }
          75% { transform: translateY(-15px) rotate(2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        
        @keyframes pulse {
          0% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
          100% { opacity: 0.5; transform: scale(1); }
        }
        
        @keyframes moveAround {
          0% { transform: translate(0, 0); }
          25% { transform: translate(20px, -20px); }
          50% { transform: translate(40px, 0); }
          75% { transform: translate(20px, 20px); }
          100% { transform: translate(0, 0); }
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
        <div className="absolute top-10 right-[10%] w-[600px] h-[600px] rounded-full bg-purple-500/20 blur-3xl"
          style={{animation: 'pulse 8s ease-in-out infinite, moveAround 30s ease-in-out infinite'}}></div>
        <div className="absolute bottom-20 left-[5%] w-[500px] h-[500px] rounded-full bg-blue-500/20 blur-3xl" 
          style={{animation: 'pulse 10s ease-in-out infinite, moveAround 40s ease-in-out infinite alternate'}}></div>
        <div className="absolute top-[40%] left-[20%] w-[400px] h-[400px] rounded-full bg-cyan-500/15 blur-3xl"
          style={{animation: 'pulse 12s ease-in-out infinite, moveAround 35s ease-in-out infinite 2s'}}></div>
        <div className="absolute bottom-[30%] right-[15%] w-[350px] h-[350px] rounded-full bg-indigo-500/20 blur-3xl"
          style={{animation: 'pulse 9s ease-in-out infinite, moveAround 38s ease-in-out infinite alternate-reverse'}}></div>
          
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-white/[0.03] bg-[length:40px_40px]"></div>
        
        {/* Additional decorative elements - enhanced */}
        <div className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full border-2 border-blue-500/30"
          style={{animation: 'float 10s ease-in-out infinite'}}></div>
        <div className="absolute bottom-1/3 right-1/3 w-24 h-24 rounded-full border-2 border-purple-500/30"
          style={{animation: 'float 13s ease-in-out infinite', animationDelay: '2s'}}></div>
        <div className="absolute top-2/3 left-1/3 w-40 h-40 rounded-full border-2 border-cyan-500/30"
          style={{animation: 'float 15s ease-in-out infinite', animationDelay: '1s'}}></div>
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
              backgroundImage: "linear-gradient(-45deg, #9333ea, #3b82f6, #10b981)",
              backgroundSize: "200% 200%",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              animation: "gradient 3s ease infinite"
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
              background: "linear-gradient(45deg, rgba(147, 51, 234, 0.2), rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.2))",
              boxShadow: "0 0 30px rgba(147, 51, 234, 0.3)" 
            }}
          >
            <Image 
              src="/logos/logo.png" 
              alt="FirstVoice AI Logo"
              width={160}
              height={160}
              className="object-contain -ml-12 -mt-12 "
              style={{ 
                objectPosition: 'center',
                position: 'absolute',
                inset: '0',
                margin: 'auto'
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
            By connecting people with appropriate mental health resources through empathetic conversation, our AI-driven platform provides a safe space for individuals to express their concerns and receive personalized guidance toward professional mental health services and support networks.
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
              backgroundImage: "linear-gradient(-45deg, #9333ea, #3b82f6, #10b981)",
              backgroundSize: "200% 200%",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              animation: "gradient 3s ease infinite"
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
                <div className="text-xs text-center mt-2 text-white">{getQuestionLabel()}</div>
          </div>
        )}
           <div className="w-full h-12"></div>
            
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
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
                  boxShadow: "0 0 25px rgba(52, 152, 219, 0.15)"
                }}
              >
          {callLog.map((item, index) => {
            let messageClass = "";
            let prefix = "";

            if (item.type === "user") {
                    messageClass = "text-blue-200 font-medium bg-blue-900/30 p-3 rounded-lg my-2";
              prefix = "User: ";
            } else if (item.type === "support") {
                    messageClass = "text-green-200 bg-green-900/30 p-3 rounded-lg my-2";
              prefix = "Support: ";
            } else if (item.type === "ai") {
                    messageClass = "text-purple-200 font-bold bg-purple-900/30 p-3 rounded-lg my-2";
              prefix = "AI: ";
            } else if (item.type === "summary") {
                    messageClass = "text-white bg-gradient-to-r from-blue-900/50 to-indigo-900/50 p-4 my-3 rounded-lg shadow-inner";
              prefix = "Summary: ";
            } else if (item.type === "error") {
                    messageClass = "text-red-200 font-bold bg-red-900/30 p-3 rounded-lg my-2";
              prefix = "System: ";
            }

            return (
                    <div 
                      key={index} 
                      className={`${messageClass} relative`}
                    >
                {prefix}
                {item.text}
              </div>
            );
          })}

                {/* Speech display with better spacing */}
          {partialSpeech && (
                  <div 
                    className="text-blue-200 italic bg-blue-800/20 p-3 rounded-lg my-2 relative"
                  >
                    User (speaking): {partialSpeech}
                  </div>
                )}

                {/* Status display with better spacing */}
                <div 
                  className="mt-4 text-sm text-white/70 bg-black/10 p-3 rounded-lg relative"
                >
                  {isCallActive
              ? `Call in progress... Listening: ${listening ? "Yes" : "No"}`
              : "No active call. Start one!"}
            <br />
            {isMute ? "Muted (no audio captured)" : "Unmuted (audio capturing)"}
          </div>

                {/* Loading indicator with better spacing */}
                {loading && (
                  <div 
                    className="text-blue-200 font-bold animate-pulse bg-blue-900/30 p-3 rounded-lg my-2 relative"
                  >
                    Processing...
        </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center h-[380px] w-3/4 max-w-4xl p-7 mt-6 mb-12 font-poppins mx-auto">
                <div className="text-center mb-8 text-white">
                  {isCallActive ? 
                    (isSpeaking ? 
                      <div className="text-xl font-semibold text-green-300">AI Speaking...</div> :
                     (listening ? 
                      <div className="text-xl font-semibold text-blue-300">Listening to you...</div> : 
                      <div className="text-xl font-semibold text-purple-300">Processing...</div>)
                    ) : 
                    <div className="text-xl font-semibold">Start a call to begin</div>
                  }
      </div>

                {isCallActive && (
                  <div className="audio-wave">
                    {[...Array(16)].map((_, i) => (
                      <motion.div
                        key={i}
                        className={`wave-bar ${
                          isSpeaking ? "bg-gradient-to-t from-green-500 to-green-300" :
                          (listening ? "bg-gradient-to-t from-blue-500 to-blue-300" : "bg-gradient-to-t from-purple-500 to-purple-300")
                        }`}
                        animate={{ 
                          height: listening ? [10, Math.random() * 70 + 10, 10] : 
                                  isSpeaking ? [10, 60, 10] :
                                  [5, 15, 5] // Processing - subtle movement
                        }}
                        transition={{ 
                          duration: listening ? 1.2 : (isSpeaking ? 0.8 : 2),
                          repeat: Infinity, 
                          delay: i * (listening ? 0.05 : (isSpeaking ? 0.07 : 0.1)),
                          ease: listening ? "easeInOut" : (isSpeaking ? "easeOut" : "linear")
                        }}
                        style={{
                          animationName: listening ? "userWave" : (isSpeaking ? "aiWave" : "processingWave"),
                          animationDuration: listening ? "1.2s" : (isSpeaking ? "0.8s" : "2s"),
                          animationIterationCount: "infinite",
                          animationDelay: `${i * (listening ? 0.05 : (isSpeaking ? 0.07 : 0.1))}s`,
                          animationTimingFunction: listening ? "ease-in-out" : (isSpeaking ? "ease-out" : "linear")
                        }}
                      />
                    ))}
                  </div>
                )}
                
                {/* Last speaker indicator with improved visibility */}
                {isCallActive && callLog.length > 0 && (
                  <div className="mt-10 text-center">
                    <div className="text-sm mb-2 text-white/80">Last speaker:</div>
                    <div className={`text-lg font-medium rounded-full px-4 py-1 inline-block ${
                      callLog[callLog.length - 1].type === "user" 
                        ? "bg-blue-900/30 text-blue-200" 
                        : "bg-green-900/30 text-green-200"
                    }`}>
                      {callLog[callLog.length - 1].type === "user" ? "You" : "AI Assistant"}
                    </div>
                  </div>
                )}
                
                {/* Status info at bottom with improved clarity */}
                <div className="mt-8 text-center text-sm">
                  {isCallActive
                    ? (isSpeaking 
                        ? <span className="text-green-300 font-medium">AI is speaking</span>
                        : (listening 
                            ? <span className="text-blue-300 font-medium">Listening for your voice</span>
                            : <span className="text-purple-300 font-medium">Processing your response</span>))
                    : <span className="text-white/60">Click 'Start Call' to begin</span>}
                  <br />
                  {isMute && <span className="text-red-300 mt-2 inline-block">Audio currently muted</span>}
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
              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)" }}
              whileTap={{ scale: 0.95 }}
            >
              {isCallActive ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
          End Call
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  Start Call
                </>
              )}
        </motion.button>
            
        <motion.button
          onClick={handleToggleMute}
              className="bg-gradient-to-r from-blue-600 to-blue-500 py-3 px-6 text-white rounded-lg hover:from-blue-500 hover:to-blue-400 shadow-lg relative flex items-center"
              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)" }}
              whileTap={{ scale: 0.95 }}
            >
              {isMute ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Unmute
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                  </svg>
                  Mute
                </>
              )}
        </motion.button>
            
        <motion.button
          onClick={() => setModal1Open(true)}
              className="bg-gradient-to-r from-indigo-600 to-indigo-500 py-3 px-6 text-white rounded-lg hover:from-indigo-500 hover:to-indigo-400 shadow-lg relative flex items-center"
              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)" }}
              whileTap={{ scale: 0.95 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
          Settings
        </motion.button>

        <Modal isOpen={isModal1Open} onClose={() => setModal1Open(false)}>
          <h2 className="text-xl font-bold p-4">Settings</h2>
          <div> Set your Language </div>
        </Modal>
          </motion.div>
          <div className="w-full h-8"></div>
          {/* PDF Download Button - Now using floating button instead 
          {pdfUrl && stage === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex justify-center mt-4 mb-16"
            >
              <motion.a
                href={pdfUrl}
                download="conversation-summary.pdf"
                className="bg-gradient-to-r from-orange-600 to-orange-500 py-3 px-6 text-white rounded-lg hover:from-orange-500 hover:to-orange-400 shadow-lg flex items-center"
                whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 2C5.9 2 5 2.9 5 4V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V8L13 2H7ZM7 4H12V9H17V20H7V4ZM9 12C9 12.55 9.45 13 10 13H14C14.55 13 15 12.55 15 12C15 11.45 14.55 11 14 11H10C9.45 11 9 11.45 9 12ZM9 16C9 16.55 9.45 17 10 17H14C14.55 17 15 16.55 15 16C15 15.45 14.55 15 14 15H10C9.45 15 9 15.45 9 16Z"/>
                </svg>
                Download Pre Screening Summary as a PDF
              </motion.a>
            </motion.div>
          )} */}

          <div className="w-full h-24"></div>
          
          {/* Mission Title */}
          <motion.h2 
            ref={missionTitleRef}
            id="mission"
            initial={{ opacity: 0, y: 30 }}
            animate={missionTitleControls}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-5xl font-bold mb-12 font-poppins drop-shadow-md relative text-center scroll-mt-24" 
            style={{
              backgroundImage: "linear-gradient(-45deg, #9333ea, #3b82f6, #10b981)",
              backgroundSize: "200% 200%",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              animation: "gradient 3s ease infinite"
            }}
          >
            Our Mission
          </motion.h2>
      </div>

        {/* Mission section with scroll reveal */}
        <div 
          className="w-full py-12 relative" 
          style={{ background: 'linear-gradient(180deg, rgba(30,58,138,0) 0%, rgba(30,58,138,0.05) 100%)' }}
        >
          {/* Mission box with scroll reveal */}
          <div className="flex justify-center mb-16">
            <motion.div 
              ref={missionBoxRef}
              initial={{ opacity: 0, y: 30 }}
              animate={missionBoxControls}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="bg-white/20 backdrop-filter backdrop-blur-md rounded-xl p-10 shadow-lg max-w-3xl w-full mx-auto relative"
              style={{ 
                boxShadow: "0 0 25px rgba(52, 152, 219, 0.15)"
              }}
            >
              <p className="text-white/90 leading-relaxed text-lg mb-5 tracking-wide px-2">
                We aim to be a compassionate mental health support assistant that provides a safe space for emotional support and connects people with appropriate mental health resources through understanding conversations.
              </p>
              <p className="text-white/80 leading-relaxed text-base tracking-wide px-2">
                We believe that everyone deserves access to mental health support in moments of need. Our AI-powered platform serves as a bridge between those seeking help and the professional resources available to them.
              </p>
            </motion.div>
    </div>
        </div>
      </div>
    </main>
  );
}