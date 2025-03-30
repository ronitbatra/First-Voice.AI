"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Footer.module.css";
import { motion } from "framer-motion";

// Team member data structure with real team information
const teamMembers = [
  {
    name: "Ronit Batra",
    role: "University of Virginia",
    image: "/team/Ronit.png",
    linkedin: "https://www.linkedin.com/in/ronit-batra",
    github: "https://github.com/ronitbatra",
  },
  {
    name: "Samuel Park",
    role: "University of Virginia",
    image: "/team/Sam.PNG",
    linkedin: "https://www.linkedin.com/in/samuelpark316",
    github: "https://github.com/samuelpark316",
  },
  {
    name: "Sagun Venuganti",
    role: "University of Virginia",
    image: "/team/Sagun.png",
    linkedin: "https://www.linkedin.com/in/sagun-venuganti",
    github: "https://github.com/svenuganti",
  },
  {
    name: "Phlobater Habshy",
    role: "Virginia Tech",
    image: "/team/phlo2.jpg",
    linkedin: "https://www.linkedin.com/in/phlobater-habshy-371087312",
    github: "https://github.com/phlohabshy",
  },
];

// Event information
const eventInfo = {
  name: "HooHacks 2025",
  location: "UVA",
  logos: {
    uva: "/logos/UVA.jpg",
    hoohacks: "/logos/HooHacks.jpg",
  },
  links: {
    uva: "https://www.virginia.edu/",
    hoohacks: "https://hoohacks.io/",
  },
};

export default function Footer() {
  const [isVisible, setIsVisible] = useState(false);
  const footerRef = useRef(null);

  // Set up Intersection Observer to detect when footer is in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Add a small delay to make the animation more natural
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true);
          }, 300);
        }
      },
      {
        root: null, // viewport
        rootMargin: "0px",
        threshold: 0.1, // trigger when 10% of the footer is visible
      }
    );

    if (footerRef.current) {
      observer.observe(footerRef.current);
    }

    return () => {
      if (footerRef.current) {
        observer.unobserve(footerRef.current);
      }
    };
  }, []);

  // Animation variants for the main footer
  const footerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 1.2,
        ease: "easeOut",
      },
    },
  };

  // Animation variants for team members with staggered effect
  const teamContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
        duration: 0.5,
      },
    },
  };

  const teamMemberVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.7,
        ease: "easeOut",
      },
    },
  };

  return (
    <motion.footer
      className={styles.footer}
      ref={footerRef}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={footerVariants}
      style={{ marginTop: 0 }}
    >
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />
      <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-20 left-10 w-32 h-32 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* About Us heading */}
      <motion.h2
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="text-5xl font-bold text-center mb-12"
        style={{
          backgroundImage: "linear-gradient(-45deg, #9333ea, #3b82f6, #10b981)",
          backgroundSize: "200% 200%",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
          animation: "gradient 3s ease infinite",
        }}
      >
        About Us
      </motion.h2>

      <div className="w-full h-12"></div>

      <div className={styles.content}>
        {/* Event Section */}
        <div
          className={styles.teamSection}
          style={{ marginRight: "2rem", maxWidth: "280px" }}
        >
          <motion.h3
            initial={{ opacity: 0 }}
            animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            Event
          </motion.h3>
          <motion.div
            className={styles.eventContent}
            variants={teamContainerVariants}
            initial="hidden"
            animate={isVisible ? "visible" : "hidden"}
          >
            <motion.div
              className={styles.member}
              variants={teamMemberVariants}
              style={{ width: "100%", maxWidth: "240px" }}
            >
              <h4 className="text-xl font-bold mb-2">{eventInfo.name}</h4>
              <p className="mb-3">{eventInfo.location}</p>

              <div className="flex justify-center items-center gap-4 mt-2">
                {/* UVA Logo Circle */}
                <Link
                  href={eventInfo.links.uva}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <motion.div
                    className={styles.imageWrapper}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      background: "linear-gradient(45deg, #232D4B, #3B82F6)",
                      width: "60px",
                      height: "60px",
                    }}
                  >
                    <Image
                      src={eventInfo.logos.uva}
                      alt="UVA Logo"
                      width={20}
                      height={20}
                      className={styles.memberImage}
                    />
                  </motion.div>
                </Link>

                {/* HooHacks Logo Circle */}
                <Link
                  href={eventInfo.links.hoohacks}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <motion.div
                    className={styles.imageWrapper}
                    whileHover={{ scale: 1.1, rotate: -5 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      background: "linear-gradient(45deg, #FF7700, #FFC300)",
                      width: "60px",
                      height: "60px",
                    }}
                  >
                    <Image
                      src={eventInfo.logos.hoohacks}
                      alt="HooHacks Logo"
                      width={40}
                      height={40}
                      className={styles.memberImage}
                    />
                  </motion.div>
                </Link>
              </div>

              <p className="mt-4 text-xs text-gray-300">
                Built during HooHacks 2025 at UVA
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Team Section */}
        <div id="ourTeam" className={`${styles.teamSection} scroll-mt-24`}>
          <motion.h3
            initial={{ opacity: 0 }}
            animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            Our Team
          </motion.h3>
          <motion.div
            className={styles.teamMembers}
            variants={teamContainerVariants}
            initial="hidden"
            animate={isVisible ? "visible" : "hidden"}
          >
            {teamMembers.map((member, index) => (
              <motion.div
                key={index}
                className={styles.member}
                variants={teamMemberVariants}
              >
                <motion.div
                  className={styles.imageWrapper}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.3 }}
                >
                  {member.image &&
                  (member.image.endsWith(".jpg") ||
                    member.image.endsWith(".png") ||
                    member.image.endsWith(".PNG")) ? (
                    <Image
                      src={member.image}
                      alt={member.name}
                      width={80}
                      height={80}
                      className={`${styles.memberImage} ${
                        member.name === "Samuel Park" ? styles.samuelImage : ""
                      } ${
                        member.name === "Phlobater Habshy"
                          ? styles.phloImage
                          : ""
                      }`}
                      style={{
                        objectPosition:
                          member.name === "Samuel Park"
                            ? "center 10%"
                            : member.name === "Phlobater Habshy"
                            ? "center 50%"
                            : "center center",
                      }}
                    />
                  ) : (
                    <div className={styles.memberImagePlaceholder}>
                      {member.name.charAt(0)}
                    </div>
                  )}
                </motion.div>
                <h4>{member.name}</h4>
                <p>{member.role}</p>
                <div className={styles.socialLinks}>
                  <Link
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <motion.div
                      className={styles.socialIcon}
                      whileHover={{
                        scale: 1.2,
                        backgroundColor: "#0077B5",
                        y: -5,
                        boxShadow: "0 5px 15px rgba(0, 0, 0, 0.3)",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        width="24"
                        height="24"
                      >
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                    </motion.div>
                  </Link>
                  <Link
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <motion.div
                      className={styles.socialIcon}
                      whileHover={{
                        scale: 1.2,
                        backgroundColor: "#333",
                        y: -5,
                        boxShadow: "0 5px 15px rgba(0, 0, 0, 0.3)",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        width="24"
                        height="24"
                      >
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                    </motion.div>
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      <motion.div
        className={styles.copyright}
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 1.5 }}
      >
        <p>
          &copy; {new Date().getFullYear()} FirstVoice AI. All rights reserved.
        </p>
      </motion.div>
    </motion.footer>
  );
}
