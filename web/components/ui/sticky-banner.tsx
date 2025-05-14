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
				"relative overflow-hidden w-full z-40 flex items-center justify-center bg-transparent px-4 py-1",
				className,
			)}
			initial={{ height: 56, opacity: 1, paddingTop: 4, paddingBottom: 4 }}
			animate={{
				height: open ? 56 : 0,
				opacity: open ? 1 : 0,
				paddingTop: open ? 4 : 0,
				paddingBottom: open ? 4 : 0,
			}}
			transition={{
				duration: 0.3,
				ease: "easeInOut",
			}}
		>
			{open && (
				<>
					{children}
					<Button
						variant="ghost"
						size="icon"
						className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-transparent"
						onClick={() => setOpen(false)}
						aria-label="Close banner"
					>
						<X className="h-4 w-4 text-white" />
					</Button>
				</>
			)}
		</motion.div>
	);
};
