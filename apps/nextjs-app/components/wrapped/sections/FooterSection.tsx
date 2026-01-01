"use client";

import { motion } from "motion/react";

interface FooterSectionProps {
  year: number;
}

export function FooterSection({ year }: FooterSectionProps) {
  return (
    <section className="relative py-24 px-4 md:px-8">
      <div className="absolute inset-0 bg-gradient-to-t from-blue-950/40 via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto text-center relative"
      >
        <div className="mb-8">
          <span className="text-7xl md:text-9xl font-black bg-gradient-to-r from-blue-400 via-blue-300 to-white bg-clip-text text-transparent">
            {year}
          </span>
        </div>

        <p className="text-xl md:text-2xl text-white/60 mb-4">
          And that's a wrap on {year}!
        </p>
        <p className="text-sm text-white/40 mb-8">See you next year!</p>
      </motion.div>
    </section>
  );
}
