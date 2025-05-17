import { Button } from "@/components/ui/button"

export default function ReadspaceBanner() {
    return (
        <div className="w-full bg-[#F5F9F3] py-8 md:py-12 my-24">
            {" "}
            {/* Adjusted padding for responsiveness */}
            <div className="flex flex-col items-center justify-center gap-4 md:gap-6 text-center w-full mx-auto max-w-7xl">
                {" "}
                {/* Added max-w-7xl for better control */}
                {/* Button */}
                <div>
                    <Button
                        variant="outline"
                        className="rounded-full py-1 text-sm font-medium cursor-default pointer-events-none bg-[#F5F9F3] text-[#71717A]"
                    >
                        Introducing Readspace
                    </Button>
                </div>
                {/* Heading */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-[#000000] px-4">
                    {" "}
                    {/* Responsive text sizes */}A simple 3 step system: Grasp,
                    Engage, Retain
                </h1>
                {/* Subheading */}
                <p className="md:text-lg sm:text-xl text-[#91998C] px-6">
                    {" "}
                    {/* Responsive text sizes */}
                    Use science-backed tools and methods to learn better
                </p>
            </div>
        </div>
    )
}
