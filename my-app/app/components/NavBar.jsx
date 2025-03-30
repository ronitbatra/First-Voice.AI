"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle scroll effect for navbar transparency
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [scrolled]);

  // Smooth scroll to element function
  const scrollToElement = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setMobileMenuOpen(false); // Close menu after clicking
    }
  };

  // Define pulse animation
  const pulseAnimation = {
    scale: [1, 1.05, 1],
    boxShadow: [
      "0 4px 6px rgba(0, 0, 0, 0.1)",
      "0 10px 15px rgba(37, 99, 235, 0.2)",
      "0 4px 6px rgba(0, 0, 0, 0.1)",
    ],
  };

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300 ${
        scrolled
          ? "bg-[#1a2a4d]/80 backdrop-blur-md shadow-lg"
          : "bg-transparent"
      }`}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Global styles for gradient animations */}
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

        @keyframes buttonGradient {
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

        .animated-gradient-button {
          background: linear-gradient(
            -45deg,
            #9333ea,
            #3b82f6,
            #10b981,
            #9333ea
          );
          background-size: 300% 300%;
          animation: buttonGradient 5s ease infinite;
        }

        .animated-gradient-button:hover {
          background-size: 400% 400%;
          animation: buttonGradient 3s ease infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 relative mr-3 overflow-hidden rounded-full flex items-center justify-center">
            <Image
              src="/logos/logo.png"
              alt="FirstVoice AI Logo"
              width={64}
              height={64}
              className="object-cover"
              style={{ objectPosition: "center" }}
              priority
            />
          </div>
          <div
            className="text-xl font-bold relative -ml-5"
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
            FirstVoice AI
          </div>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center space-x-8">
          <motion.button
            onClick={() => scrollToElement("tryit")}
            className="animated-gradient-button py-2 px-5 text-white rounded-lg shadow-md"
            whileHover={{
              scale: 1.05,
              boxShadow: "0 5px 15px rgba(0, 0, 0, 0.2)",
            }}
            whileTap={{ scale: 0.95 }}
            animate={pulseAnimation}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          >
            Try It
          </motion.button>
          <button
            onClick={() => scrollToElement("mission")}
            className="text-white hover:text-blue-300 transition-colors"
          >
            Our Mission
          </button>
          <button
            onClick={() => scrollToElement("ourTeam")}
            className="text-white hover:text-blue-300 transition-colors"
          >
            About Us
          </button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            className="text-white p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden absolute top-full left-0 right-0 bg-[#1a2a4d]/95 backdrop-blur-md"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col items-center py-4 space-y-4">
              <motion.button
                onClick={() => scrollToElement("tryit")}
                className="animated-gradient-button py-2 px-5 text-white rounded-lg shadow-md w-4/5 mx-auto"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={pulseAnimation}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
              >
                Try It
              </motion.button>
              <button
                onClick={() => scrollToElement("mission")}
                className="text-white hover:text-blue-300 transition-colors w-full text-center py-2"
              >
                Our Mission
              </button>
              <button
                onClick={() => scrollToElement("ourTeam")}
                className="text-white hover:text-blue-300 transition-colors w-full text-center py-2"
              >
                About Us
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
