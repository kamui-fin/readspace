import Image from "next/image";
import { motion } from "motion/react";
import { images } from "@/lib/images";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

function Feed() {
	// Track loaded images by URL
	const [loaded, setLoaded] = useState<Set<string>>(new Set());

	const handleLoad = (url: string) => {
		setLoaded((prev) => new Set(prev).add(url));
	};

	return (
		<div className="grid grid-cols-2 grid-rows-2 gap-x-20 gap-y-20 my-10 w-full max-w-6xl mx-auto">
			{images.slice(0, 4).map((image, index) => {
				// Determine row: 0 or 1
				const row = Math.floor(index / 2);
				// For the second row, invert the rotation
				let rotate = index % 2 === 0 ? 3 : -3;
				if (row === 1) rotate = -rotate;
				const isLoaded = loaded.has(image);
				return (
					<motion.div
						key={image}
						initial={{
							opacity: 0,
							y: -50,
							rotate: 0,
						}}
						animate={{
							opacity: 1,
							y: 0,
							rotate,
						}}
						transition={{ duration: 0.2, delay: index * 0.1 }}
						className="flex justify-center items-center relative"
					>
						<Image
							src={image}
							width={400}
							height={400}
							alt="about"
							className={`rounded-xl object-cover transform rotate-3 shadow-2xl block w-full h-64 md:h-80 hover:rotate-0 transition duration-200 ${isLoaded ? "opacity-100" : "opacity-0"}`}
							onLoadingComplete={() => handleLoad(image)}
						/>
						{!isLoaded && (
							<Skeleton className="absolute inset-0 rounded-xl w-full h-64 md:h-80 max-w-[400px]" />
						)}
					</motion.div>
				);
			})}
		</div>
	);
}

export { Feed };
