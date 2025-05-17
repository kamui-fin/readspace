import type React from "react"
import Image from "next/image"
import { BookOpen, Cloud, Highlighter, FileText } from "lucide-react"

export default function ReaderLandingSection() {
    return (
        <section
            className="mt-24 sm:mt-28 md:mt-32 lg:mt-36 w-full py-12 md:py-24 lg:py-32"
            style={{ backgroundColor: "#F5F9F3" }}
        >
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16">
                    {/* E-reader mockup - now first */}
                    <div className="flex items-center justify-center order-last lg:order-first">
                        <div className="relative w-full max-w-[800px] md:max-w-[1000px] lg:max-w-[1400px] overflow-hidden rounded-xl bg-white p-2 shadow-xl">
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 rounded-lg"></div>
                            <div
                                className="relative w-full overflow-hidden rounded-lg border"
                                style={{ borderColor: "#E4ECDF" }}
                            >
                                <div
                                    className="flex h-8 items-center border-b bg-[#E4ECDF] px-4"
                                    style={{ borderColor: "#E4ECDF" }}
                                >
                                    <div className="flex space-x-2">
                                        <div className="h-3 w-3 rounded-full bg-[#386641]"></div>
                                        <div
                                            className="h-3 w-3 rounded-full bg-[#6A994E]"
                                            style={{ border: "none" }}
                                        ></div>
                                        <div
                                            className="h-3 w-3 rounded-full bg-[#E4ECDF] border"
                                            style={{ borderColor: "#6A994E" }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="relative w-full">
                                    <Image
                                        src="/reader-demo.png"
                                        alt="E-reader UI"
                                        width={3200}
                                        height={1600}
                                        className="w-full h-auto object-cover"
                                        priority
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Text content - now second */}
                    <div className="flex flex-col justify-center space-y-6 md:space-y-8 order-first lg:order-last">
                        <div className="space-y-3 md:space-y-4">
                            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tighter">
                                A reader that stays out of your way
                            </h2>
                            <p
                                className="text-base sm:text-lg md:text-xl lg:text-base xl:text-xl"
                                style={{ color: "#91998C" }}
                            >
                                The clean, distraction‑free web reader
                                you&apos;ll actually stick with.
                            </p>
                        </div>
                        <div className="space-y-4 sm:space-y-6">
                            <FeatureItem
                                icon={
                                    <Cloud className="h-4 w-4 sm:h-5 sm:w-5" />
                                }
                                title="Seamless sync"
                                description="Keep your place, highlights, notes, and entire library consistent across every device"
                            />
                            <FeatureItem
                                icon={
                                    <Highlighter className="h-4 w-4 sm:h-5 sm:w-5" />
                                }
                                title="Effortless highlighting & inline notes"
                                description="Mark what matters, jot why it matters."
                            />
                            <FeatureItem
                                icon={
                                    <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                                }
                                title="Universal format support"
                                description="Open EPUB and PDF without conversions or plugins."
                            />
                            <FeatureItem
                                icon={
                                    <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
                                }
                                title="Local support"
                                description="Store books directly on your device for full control and offline access."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

function FeatureItem({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode
    title: string
    description: string
}) {
    return (
        <div className="flex items-start gap-3 sm:gap-4">
            <div
                className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full shrink-0"
                style={{ backgroundColor: "#E4ECDF" }}
            >
                <div style={{ color: "#386641" }}>{icon}</div>
            </div>
            <div className="space-y-1 sm:space-y-2">
                <h3
                    className="font-bold text-sm sm:text-base"
                    style={{ color: "#494E47" }}
                >
                    {title}
                </h3>
                <p
                    className="text-sm sm:text-base"
                    style={{ color: "#91998C" }}
                >
                    {description}
                </p>
            </div>
        </div>
    )
}
