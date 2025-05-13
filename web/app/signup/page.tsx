import { useId } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Signup() {
	const nameId = useId();
	const emailId = useId();

	return (
		<div className="min-h-screen flex flex-col dark-black:bg">
			<div className="flex items-center justify-between w-full px-6 pt-6">
				<Link href="/">
					<Image
						src="/wordmark.svg"
						alt="Readspace Logo"
						width={178}
						height={63}
					/>
				</Link>
			</div>
			<div className="flex flex-1 items-center justify-center">
				<form className="flex flex-col gap-4 w-full max-w-md bg-transparent p-8 rounded-lg">
					<div className="flex flex-col items-center mb-2">
						<h1 className="text-2xl font-semibold">join the waitlist</h1>
					</div>
					<div className="group relative">
						<label
							htmlFor={nameId}
							className="origin-start text-muted-foreground/70 group-focus-within:text-foreground has-[+input:not(:placeholder-shown)]:text-foreground absolute top-1/2 block -translate-y-1/2 cursor-text px-1 text-sm transition-all group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:text-xs group-focus-within:font-medium has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:text-xs has-[+input:not(:placeholder-shown)]:font-medium"
						>
							<span className="bg-background inline-flex px-2">Name</span>
						</label>
						<Input
							id={nameId}
							type="name"
							placeholder=" "
							className="dark:bg-zinc-900 placeholder:text-zinc-400"
						/>
					</div>
					<div className="group relative">
						<label
							htmlFor={emailId}
							className="origin-start text-muted-foreground/70 group-focus-within:text-foreground has-[+input:not(:placeholder-shown)]:text-foreground absolute top-1/2 block -translate-y-1/2 cursor-text px-1 text-sm transition-all group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:text-xs group-focus-within:font-medium has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:text-xs has-[+input:not(:placeholder-shown)]:font-medium"
						>
							<span className="bg-background inline-flex px-2">Email</span>
						</label>
						<Input
							id={emailId}
							type="email"
							placeholder=" "
							className="dark:bg-zinc-900 placeholder:text-zinc-400 pr-10"
						/>
					</div>
					<div className="flex items-center justify-end mt-2">
						<Button
							type="submit"
							className="px-6 py-2 rounded-md font-semibold bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-100"
						>
							Sign up
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
