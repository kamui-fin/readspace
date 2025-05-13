"use client";

import { StickyBanner } from "@/components/ui/sticky-banner";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Feed } from "@/components/feed";

export default function Home() {
	return (
		<div className="relative flex min-h-screen w-full flex-col overflow-y-auto">
			<StickyBanner className="bg-gradient-to-b from-blue-500 to-blue-600">
				<p className="mx-0 max-w-[90%] text-white drop-shadow-md">
					We're shipping a new version of Readspace, but you can jump back into
					your reading flow{" "}
					<a
						href="https://beta.readspace.ai"
						className="transition duration-200 hover:underline underline-offset-4"
					>
						here
					</a>
				</p>
			</StickyBanner>
			<Header />
			<Feed />
			<Footer />
		</div>
	);
}
