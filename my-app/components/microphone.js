"use client";

// Import necessary modules and components
import { useEffect, useState, useRef } from "react";
import Image from "next/image";

// Export the MicrophoneComponent function component
export default function MicrophoneComponent({
  setGptReply,
  setMicrophoneDoneRecording,
  problem_description,
  setProblemDescription,
  questions,
  setQuestions,
  backNForth,
  setBackNForth,
  setLoading,
  setTriage,
}) {
  // State variables to manage recording status, completion, and transcript
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [stage, setStage] = useState(0);
  const [qNo, setQNo] = useState(0);
  const [combinedUserAnswers, setCombinedUserAnswers] = useState("");
  const recognitionRef = useRef();

  /*
   * NEW STATE: userAnswers
   * ---------------------------------------------------
   * We need an array (or string) to hold 5 user inputs
   * from repeated case 1 loops. We'll push each "transcript"
   * to userAnswers every time case 1 runs.
   */
  const [userAnswers, setUserAnswers] = useState([]);

  // Function to start recording
  const startRecording = () => {
    recognitionRef.current = new window.webkitSpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event) => {
      let trans = "";
      for (const result of event.results) {
        trans += result[0].transcript;
      }
      trans = trans.charAt(0).toUpperCase() + trans.slice(1);

      setTranscript(trans);
    };

    recognitionRef.current.start();
    setIsRecording(true);
    setMicrophoneDoneRecording(false);
    setTranscript("");
  };

  // Cleanup effect when the component unmounts
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Function to stop recording
  const stopRecording = async () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsRecording(false);

    switch (stage) {
      /*
       * ================ CASE 0: (no change) =================
       * The user is describing their problem; we store it
       * as "problemDescription" & call the server with stage=0.
       */
      case 0: {
        setProblemDescription(transcript);
        console.log(`Caller description: ${transcript}`);

        const res = await fetch("/api/v1/query", {
          method: "POST",
          body: JSON.stringify({
            problem_description: transcript,
            stage: 0,
          }),
        }).then((data) => data.json());

        console.log(`Operator greeting: ${res.msg}`);
        setGptReply(res.msg);
        setMicrophoneDoneRecording(true);
        setStage(stage + 1); // Move on to case 1 next time
        break;
      }

      /*
       * ================ CASE 1: repeat 5 times =================
       * We want to:
       * 1) Push the transcript into userAnswers
       * 2) Append transcript to backNForth so we have a log
       * 3) POST to stage=1, but also pass history (the entire backNForth)
       * 4) If we've done it 5 times, move on to case 2
       */
      case 1: {
        console.log(`Caller name/info: ${transcript}`);

        // 1) Append transcript to userAnswers
        //    (like "userAnswers.push(transcript)" but in React style)
        setUserAnswers((prev) => [...prev, transcript]);

        // 2) Append the user's response to backNForth
        setBackNForth((prev) =>
          prev.concat([
            // You can also include an "assistant" message if needed
            // but for now we just record the user's utterance
            { role: "user", content: transcript },
          ])
        );

        // 3) Let user know we're making a request
        setGptReply("One moment.");
        setMicrophoneDoneRecording(true);
        setLoading(true);

        // 4) Send it to the server (stage=1).
        //    We'll also pass along the entire backNForth so GPT can use context.
        const res1 = await fetch("/api/v1/query", {
          method: "POST",
          body: JSON.stringify({
            problem_description,
            stage: 1,
            last_reply: transcript,
            history: backNForth.concat([{ role: "user", content: transcript }]),
          }),
        }).then((data) => data.json());

        setLoading(false);

        // For demonstration, let's assume the server returns { msg: "..."}
        // or { questions: ["..."] }. We can set those as next GPT reply.
        if (res1.msg) {
          setGptReply(res1.msg);
        } else if (res1.questions) {
          // If it returns questions, show the first question
          setQuestions(res1.questions);
          setGptReply(res1.questions[0]);
        } else {
          // fallback
          setGptReply("Received data, but not sure how to display it!");
        }

        // 5) Decide if we continue in stage 1 or move to stage 2
        //    after 5 loops
        if (userAnswers.length + 1 < 5) {
          // We still need more user answers → stay in stage 1
          console.log("Still collecting info. Remaining in case 1.");
        } else {
          // We got 5 answers → advance to stage 2
          console.log("We have 5 user answers, moving to case 2...");
          setStage(2);
        }

        break;
      }

      /*
       * ================ CASE 2: Final summary =================
       * 1) We take userAnswers (the 5 user responses) and combine them
       *    with problemDescription at the front
       * 2) We also pass the entire backNForth to the server
       * 3) The server does vector search, GPT summary, returns { summary: ... }
       * 4) We store or display that summary
       */
      case 2: {
        console.log(`Caller answer q${qNo}: ${transcript}`);
        setBackNForth((prev) =>
          prev.concat([
            { role: "assistant", content: questions[qNo] || "Last question" },
            { role: "user", content: transcript },
          ])
        );

        setQNo((prev) => prev + 1);

        // Create a single string from userAnswers
        const combinedUserAnswers = [problem_description, ...userAnswers].join(
          " "
        );

        // We'll only do the final fetch once we pass the final question,
        // but your logic could differ. This is just an example:
        if (qNo + 1 === questions.length) {
          setGptReply("Please hold");
          console.log("Support: Please hold");
          setLoading(true);
          setMicrophoneDoneRecording(true);

          /*
           * SENDING "userAnswers" (the 5 answers) + "problem_description"
           * in a single string "combinedUserAnswers" plus the entire "backNForth"
           */
          const res2 = await fetch("/api/v1/query", {
            method: "POST",
            body: JSON.stringify({
              problem_description, // optional if you still want to pass it
              userAnswers: combinedUserAnswers,
              stage: 2,
              history: backNForth.concat([
                {
                  role: "assistant",
                  content: questions[qNo] || "Last question",
                },
                { role: "user", content: transcript },
              ]),
            }),
          }).then((data) => data.json());
          setLoading(false);

          /*
           * The server will return { summary: "..."}.
           * We'll store it similarly to how you stored triage before,
           * except we rename setTriage to setSummary if you want.
           * For demonstration, I'll reuse setTriage but you can rename it.
           */
          if (res2.summary) {
            setTriage(res2.summary);
            setGptReply(
              "Thank you for sharing. Here is a brief summary of your situation and some supportive steps."
            );
          } else {
            // fallback
            setGptReply("No summary was returned.");
          }

          break;
        }

        // If there are more questions left, ask them:
        setGptReply(questions[qNo + 1]);
        console.log(`Operator q${qNo + 1}: ${questions[qNo + 1]}`);
        setMicrophoneDoneRecording(true);
        break;
      }

      default:
        break;
    }
  };

  // Toggle recording state and manage recording actions
  const handleToggleRecording = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  // Render the microphone component with appropriate UI based on recording state
  return (
    <div className="flex items-center justify-center h-screen w-full">
      <div className="w-full">
        {(isRecording || transcript) && (
          <div className="w-full">
            <div>{isRecording && <p>Recording...</p>}</div>
            <div>
              {transcript && (
                <div className="border rounded-md p-2 h-fullm mt-4">
                  <p className="mb-0">{transcript}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}