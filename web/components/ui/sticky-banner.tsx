"use client";
import type React from "react";
import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export const StickyBanner = ({
	className,
	children,
	hideOnScroll = false,
}: {
	className?: string;
	children: React.ReactNode;
	hideOnScroll?: boolean;
}) => {
	const [open, setOpen] = useState(true);
	const { scrollY } = useScroll();

	useMotionValueEvent(scrollY, "change", (latest) => {
		console.log(latest);
		if (hideOnScroll && latest > 40) {
			setOpen(false);
		} else {
			setOpen(true);
		}
	});

	return (
		<motion.div
			className={cn(
				"sticky inset-x-0 top-0 z-40 flex min-h-14 w-full items-center justify-center bg-transparent px-4 py-1",
				className,
			)}
			initial={{
				y: -100,
				opacity: 0,
			}}
			animate={{
				y: open ? 0 : -100,
				opacity: open ? 1 : 0,
			}}
			transition={{
				duration: 0.3,
				ease: "easeInOut",
			}}
		>
			{children}
			<Button
				variant="ghost"
				size="icon"
				className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-transparent"
				onClick={() => setOpen(!open)}
				aria-label="Close banner"
			>
				<X className="h-4 w-4 text-white" />
			</Button>
		</motion.div>
	);
};
