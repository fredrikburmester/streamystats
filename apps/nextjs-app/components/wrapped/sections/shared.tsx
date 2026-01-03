"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  icon: LucideIcon;
  label: string;
  title: ReactNode;
  delay?: number;
}

export function SectionHeader({
  icon: Icon,
  label,
  title,
  delay = 0,
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay }}
      className="mb-12"
    >
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
        <p className="text-base text-white/50 uppercase tracking-wider">
          {label}
        </p>
      </div>
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
        {title}
      </h2>
    </motion.div>
  );
}

interface SectionDescriptionProps {
  children: ReactNode;
  delay?: number;
}

export function SectionDescription({
  children,
  delay = 0.1,
}: SectionDescriptionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay }}
      className="mb-12"
    >
      <div className="flex items-start gap-4">
        <div className="hidden md:block w-px self-stretch bg-gradient-to-b from-blue-400 to-transparent" />
        <p className="text-xl md:text-2xl text-white/70 max-w-2xl leading-relaxed">
          {children}
        </p>
      </div>
    </motion.div>
  );
}

export function Highlight({ children }: { children: ReactNode }) {
  return <span className="text-white font-medium">{children}</span>;
}

export function AccentHighlight({ children }: { children: ReactNode }) {
  return <span className="text-blue-400 font-medium">{children}</span>;
}

export function Tagline({ children }: { children: ReactNode }) {
  return <span className="text-white/50 italic">{children}</span>;
}

interface SubsectionHeaderProps {
  children: ReactNode;
}

export function SubsectionHeader({ children }: SubsectionHeaderProps) {
  return (
    <h3 className="text-base text-white/50 uppercase tracking-wider mb-6">
      {children}
    </h3>
  );
}
