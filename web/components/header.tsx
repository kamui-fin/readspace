import Link from "next/link";
import { Button } from "@/components/ui/button";

function Header() {
	return (
		<header className="flex items-center justify-between w-full px-8 pt-8 pb-2 bg-transparent">
			{/* Left: Title and subtitle */}
			<div className="flex flex-col gap-1">
				<span className="text-xl font-semibold leading-tight text-zinc-900 dark:text-white">
					Your RSS reader for discovering
					<br />
					and maximizing content
				</span>
			</div>
			{/* Right: Membership and Get Early Access */}
			<div className="flex items-center gap-4">
				<Button asChild className="px-8 py-6 rounded-full font-semibold">
					<Link href="/signup">Get Early Access</Link>
				</Button>
			</div>
		</header>
	);
}

export { Header };
