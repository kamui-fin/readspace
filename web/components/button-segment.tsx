import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A reusable segmented button group container, similar to a button group or pill group.
 * Accepts all div props and merges className using cn().
 */
export interface ButtonSegmentProps
	extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
}

const ButtonSegment = React.forwardRef<HTMLDivElement, ButtonSegmentProps>(
	({ children, className, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn("flex bg-zinc-900/80 rounded-full shadow-md", className)}
				{...props}
			>
				{children}
			</div>
		);
	},
);
ButtonSegment.displayName = "ButtonSegment";

export { ButtonSegment };
