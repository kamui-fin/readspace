import Image from "next/image";
import Link from "next/link";
import { GitHubStarsButton } from "@/components/animated/github-stars";
import { ButtonSegment } from "@/components/button-segment";
import { socials } from "@/lib/socials";

function Footer() {
	return (
		<footer className="fixed bottom-0 left-0 w-full z-50 px-8 pb-6 pt-2 bg-transparent flex items-end justify-between">
			{/* Left group: ButtonSegment and Star us button */}
			<div className="flex items-center gap-2">
				<ButtonSegment className="bg-black text-white inline-flex items-center rounded-full px-4">
					{socials.map(({ href, label }) => (
						<Link
							key={label}
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							className="px-4 py-6 rounded-full transition-colors hover:opacity-70 h-12 flex items-center text-sm font-semibold"
						>
							{label}
						</Link>
					))}
				</ButtonSegment>
				<GitHubStarsButton
					className="bg-secondary px-6 py-6 rounded-full transition-colors hover:opacity-70 h-12 flex items-center text-black text-sm font-semibold"
					username="kamui-fin"
					repo="readspace"
				/>
			</div>
			{/* Right: App Store badge */}
			<div>
				<Image
					src="/readspace.svg"
					alt="Readspace Logo"
					width={48}
					height={48}
					className="rounded-lg"
				/>
			</div>
		</footer>
	);
}

export { Footer };
