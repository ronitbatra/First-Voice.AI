"use client";

import React from "react";
import { motion } from "framer-motion";

const dropIn = {
  hidden: {
    y: "-100vh",
    opacity: 0,
  },
  visible: {
    y: "0",
    opacity: 1,
    transition: {
      duration: 0.1,
      type: "spring",
      damping: 25,
    },
  },
  exit: {
    y: "100vh",
    opacity: 0,
  },
};

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        variants={dropIn}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div
          className="w-[400px] h-[300px] bg-gray-50 p-6 rounded-lg shadow-lg overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="font-poppins mt-4 bg-red-500 text-white px-2 rounded border-red-500"
            onClick={onClose}
          >
            x
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default Modal;
