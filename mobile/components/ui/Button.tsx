import React from "react";
import {
	Pressable,
	Text,
	PressableProps,
	ActivityIndicator,
} from "react-native";
import { cn } from "@/lib/utils";

type Variant =
	| "default"
	| "secondary"
	| "destructive"
	| "outline"
	| "ghost"
	| "link";

interface ButtonProps extends PressableProps {
	variant?: Variant;
	loading?: boolean;
	children: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
	default: "bg-black text-white border border-black",
	secondary: "bg-gray-100 text-black border border-gray-200",
	destructive: "bg-red-600 text-white border border-red-600",
	outline: "bg-transparent text-black border border-gray-200",
	ghost: "bg-transparent text-black",
	link: "bg-transparent text-blue-600 underline",
};

export function Button({
	variant = "default",
	loading = false,
	children,
	className,
	...props
}: ButtonProps) {
	return (
		<Pressable
			className={cn(
				"px-4 py-2 rounded-md flex-row items-center justify-center gap-2",
				variantStyles[variant],
				loading ? "opacity-50" : "",
				className,
			)}
			disabled={loading || props.disabled}
			{...props}
		>
			{loading && (
				<ActivityIndicator
					size="small"
					color={variant === "default" ? "#fff" : "#000"}
				/>
			)}
			<Text
				className={cn(
					"font-medium",
					variant === "link" ? "underline" : "",
					variant === "destructive" ? "text-white" : "",
				)}
			>
				{children}
			</Text>
		</Pressable>
	);
}
