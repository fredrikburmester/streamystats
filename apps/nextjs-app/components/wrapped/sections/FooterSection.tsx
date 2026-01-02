"use client";

import { Star } from "lucide-react";
import { motion } from "motion/react";

interface FooterSectionProps {
	year: number;
}

function StarIcon({ className }: { className?: string }) {
	return <Star className={className} fill="currentColor" strokeWidth={0} />;
}

export function FooterSection({ year }: FooterSectionProps) {
	return (
		<section className="relative py-32 md:py-40 px-4 md:px-8 overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-t from-blue-950/30 via-background to-background" />
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-900/15 via-transparent to-transparent" />

			<div
				className="absolute inset-0 opacity-[0.015]"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
				}}
			/>

			<motion.div
				initial={{ opacity: 0, scale: 0.9 }}
				whileInView={{ opacity: 1, scale: 1 }}
				viewport={{ once: true, margin: "-100px" }}
				transition={{ duration: 1, ease: "easeOut" }}
				className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
			>
				<div className="relative">
					<span
						className="text-[12rem] sm:text-[16rem] md:text-[20rem] lg:text-[28rem] font-black leading-none tracking-tighter"
						style={{
							WebkitTextStroke: "2px rgba(59, 130, 246, 0.12)",
							WebkitTextFillColor: "transparent",
						}}
					>
						{year}
					</span>
					<span className="absolute inset-0 text-[12rem] sm:text-[16rem] md:text-[20rem] lg:text-[28rem] font-black leading-none tracking-tighter bg-gradient-to-t from-blue-500/8 to-transparent bg-clip-text text-transparent blur-sm">
						{year}
					</span>
				</div>
			</motion.div>

			<div className="max-w-6xl mx-auto text-center relative z-10">
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.6, delay: 0.2 }}
					className="flex items-center justify-center gap-3 mb-6"
				>
					<StarIcon className="w-3 h-3 text-blue-400/80" />
					<StarIcon className="w-4 h-4 text-blue-400" />
					<span className="text-blue-400 font-bold text-xl md:text-2xl tracking-wider">
						{year}
					</span>
					<StarIcon className="w-4 h-4 text-blue-400" />
					<StarIcon className="w-3 h-3 text-blue-400/80" />
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.7, delay: 0.3 }}
				>
					<h2
						className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight uppercase mb-6"
						style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
					>
						<span className="bg-gradient-to-b from-white via-white to-white/80 bg-clip-text text-transparent">
							That's a wrap!
						</span>
					</h2>
					<p className="text-lg md:text-xl text-white/50 mb-2">
						Thank you for an incredible {year}
					</p>
					<p className="text-sm text-white/30 tracking-wide">
						See you next year!
					</p>
				</motion.div>

				<motion.div
					initial={{ scaleX: 0 }}
					whileInView={{ scaleX: 1 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
					className="mt-12 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent origin-center"
				/>

				<motion.p
					initial={{ opacity: 0 }}
					whileInView={{ opacity: 1 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.5, delay: 0.8 }}
					className="mt-8 text-xs text-white/20 tracking-[0.2em] uppercase"
				>
					Powered by StreamyStats
				</motion.p>
			</div>
		</section>
	);
}
