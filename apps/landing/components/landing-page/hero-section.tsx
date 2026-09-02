"use client"

import { HeroHeader } from "@/components/landing-page/hero5-header"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { DotPattern } from "../magicui/dot-pattern"
import MacWindow from "./mac-window"
import { Button } from "../ui/button"
import { motion } from "motion/react"
import { AnimatedGradientText } from "../magicui/animated-gradient-text"

const MotionButton = motion(Button)


export function AnimatedReadButton() {
    return (
        <MotionButton
            className="px-6 py-2 sm:w-auto mt-2 sm:mt-0"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            whileHover={{
                scale: 1.05,
                boxShadow: "0px 8px 15px rgba(0, 0, 0, 0.1)",
            }}
            whileTap={{ scale: 0.95 }}
        >
            <span>Try in web</span>
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
                            "absolute translate-y-20 inset-0 w-full h-full -z-10 opacity-40",
                            "[mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
                        )}
                    />
                    <div className="mx-auto max-w-7xl px-2 md:px-6 z-100">
                        <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0 z-100">
                            <h1 className="text-balance text-black font-semibold text-5xl md:text-7xl mt-4 xl:text-[5.25rem] tracking-[-0.02em] max-w-[80rem] mx-auto">
                                One{" "}
                                <AnimatedGradientText speed={1} colorFrom="#6A994E" colorTo="#386641" className="font-semibold tracking-tight">feed</AnimatedGradientText>
                                {" "}for everything you read online.
                            </h1>
                            <p className="px-2 mx-auto mt-4 md:mt-4 mb-4 max-w-3xl text-pretty text-sm sm:text-lg text-[#7a7a7a]">
                                <span className="backdrop-blur-lg bg-opacity-10">
                                    Readspace pulls in your favorite news sites, magazines, and blogs — no algorithm, no doomscrolling, just what you chose to read.
                                </span>
                            </p>

                            {/* <WaitlistForm variant="primary" /> */}
                            <Link href="https://app.readspace.ai">
                                <AnimatedReadButton />
                            </Link>
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

                <div className="relative mt-8 mb-12 mx-auto max-w-7xl px-2 md:px-6 xl:mt-16 z-10">
                    <div className="relative w-full aspect-[16/9]">
                        <MacWindow>
                            <div className="w-full h-full" style={{ clipPath: "inset(1px 1px 1px 1px)" }}>
                                <img
                                    src="https://github.com/kamui-fin/readspace/raw/main/docs/screenshots/readspace-desktop.png"
                                    alt="Readspace demo"
                                    className="block w-full h-full object-cover"
                                />
                            </div>
                        </MacWindow>
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
