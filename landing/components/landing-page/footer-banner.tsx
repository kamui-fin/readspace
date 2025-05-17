"use client"

import { AnimatedShinyText } from "../magicui/animated-shiny-text"
import { WaitlistForm } from "./waitlist-form"

export default function FooterBanner() {
    return (
        <div className="w-full py-4 px-4 bg-[rgba(56,102,65)]" id="cta">
            <div className="flex flex-col items-center justify-center gap-6 py-8 px-4 text-center w-full mx-auto ">
                <div className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-3 rounded-full border p-1 px-4 shadow-md shadow-zinc-950/5 dark:border-t-white/5 dark:shadow-zinc-950">
                    <AnimatedShinyText>
                        <span className="text-foreground text-sm">
                            Don&apos;t miss out!
                        </span>
                    </AnimatedShinyText>
                </div>

                <h1 className="text-5xl font-bold tracking-tight text-[#FCFFFC]">
                    Beta out in 2 weeks!
                </h1>

                <p className="text-sm text-[rgba(252,259,252,0.8)]">
                    Join our waitlist for exclusive access to our Beta Launch
                </p>
                <div className="w-full max-w-md mx-auto">
                    <div className="w-full max-w-xl mx-auto">
                        <WaitlistForm variant="black" />
                    </div>
                </div>
            </div>
        </div>
    )
}
