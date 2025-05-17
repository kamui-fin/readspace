"use client"

import { HeroHeader } from "@/components/landing-page/hero5-header"
import { cn } from "@/lib/utils"
import { BookText, CalendarArrowUp } from "lucide-react"
import Link from "next/link"
import { AnimatedShinyText } from "../magicui/animated-shiny-text"
import { DotPattern } from "../magicui/dot-pattern"
import MacWindow from "./mac-window"
import { Button } from "../ui/button"
import { motion } from "motion/react"
import VideoPlayer from "./video-player"
import { AnimatedGradientText } from "../magicui/animated-gradient-text"
import { WaitlistForm } from "./waitlist-form"

const MotionButton = motion(Button)


export function AnimatedReadButton() {
    return (
        <MotionButton
            className="px-6 py-6 sm:w-auto mt-2 sm:mt-0 space-x-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            whileHover={{
                scale: 1.05,
                boxShadow: "0px 8px 15px rgba(0, 0, 0, 0.1)",
            }}
            whileTap={{ scale: 0.95 }}
        >
            <BookText className="w-5 h-5" />
            <span>Start reading</span>
        </MotionButton>
    )
}

export default function HeroSection({ className }: { className?: string }) {
    return (
        <div id="hero">
            <HeroHeader />
            <section className={className}>
                <div className="relative pt-24 md:pt-36">
                    <DotPattern
                        glow={false}
                        className={cn(
                            "absolute translate-y-20 inset-0 w-full h-full -z-10",
                            "[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]"
                        )}
                    />
                    <div className="mx-auto max-w-7xl px-2 md:px-6 z-100">
                        <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0 z-100">
                            <Link
                                href="#cta"
                                className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-3 rounded-full border p-1 px-4 shadow-md shadow-zinc-950/5 dark:border-t-white/5 dark:shadow-zinc-950"
                            >
                                <CalendarArrowUp className="size-3" />
                                <AnimatedShinyText>
                                    <span className="text-foreground text-sm">
                                        We just launched the open beta!
                                    </span>
                                </AnimatedShinyText>
                            </Link>

                            <h1 className="text-balance text-black font-semibold text-5xl md:text-7xl mt-4 xl:text-[5.25rem] tracking-[-0.02em] max-w-[80rem] mx-auto">
                                AI that makes reading{" "}
                                <AnimatedGradientText speed={1} colorFrom="#6A994E" colorTo="#386641" className="font-semibold tracking-tight">stick.</AnimatedGradientText>
                            </h1>
                            <p className="px-2 mx-auto mt-4 md:mt-4 mb-4 max-w-3xl text-pretty text-sm sm:text-lg text-[#7a7a7a]">
                                <span className="backdrop-blur-lg bg-opacity-10">
                                    Readspace turns your reading into an active process — asking you simple questions, helping you explain ideas, and reminding you when it&apos;s time to review.
                                </span>
                            </p>

                            <div className="mt-8">
                                <WaitlistForm variant="primary" />
                            </div>
                        </div>
                        {/* <div className="bg-background has-[input:focus]:ring-muted relative grid grid-cols-[1fr_auto] items-center rounded-[calc(var(--radius)+0.5rem)] border pr-2 shadow shadow-zinc-950/5 has-[input:focus]:ring-2">

                                    <Input
                                        placeholder="Your email address"
                                        className="h-14 w-full bg-transparent pl-12 focus:outline-none"
                                        type="email"
                                    />

                                </div> */}
                    </div>
                </div>


                {/* <section className="bg-background pb-16 pt-16 md:pb-32">
                    <div className="group relative m-auto max-w-5xl px-6">
                        <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
                            <Link
                                href="/"
                                className="block text-sm duration-150 hover:opacity-75">
                                <span> Meet Our Customers</span>

                                <ChevronRight className="ml-1 inline-block size-3" />
                            </Link>
                        </div>
                        <div className="group-hover:blur-xs mx-auto mt-12 grid max-w-2xl grid-cols-4 gap-x-12 gap-y-8 transition-all duration-500 group-hover:opacity-50 sm:gap-x-16 sm:gap-y-14">
                            <div className="flex">
                                <img
                                    className="mx-auto h-5 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/nvidia.svg"
                                    alt="Nvidia Logo"
                                    height="20"
                                    width="auto"
                                />
                            </div>

                            <div className="flex">
                                <img
                                    className="mx-auto h-4 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/column.svg"
                                    alt="Column Logo"
                                    height="16"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-4 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/github.svg"
                                    alt="GitHub Logo"
                                    height="16"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-5 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/nike.svg"
                                    alt="Nike Logo"
                                    height="20"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-5 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/lemonsqueezy.svg"
                                    alt="Lemon Squeezy Logo"
                                    height="20"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-4 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/laravel.svg"
                                    alt="Laravel Logo"
                                    height="16"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-7 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/lilly.svg"
                                    alt="Lilly Logo"
                                    height="28"
                                    width="auto"
                                />
                            </div>

                            <div className="flex">
                                <img
                                    className="mx-auto h-6 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/openai.svg"
                                    alt="OpenAI Logo"
                                    height="24"
                                    width="auto"
                                />
                            </div>
                        </div>
                    </div>
                </section> */}
            </section>
        </div>
    )
}
