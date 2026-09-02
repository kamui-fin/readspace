"use client"

import { LocateOff, RefreshCwOff, Unplug } from "lucide-react"
import { useEffect, useState } from "react"
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts"

const graphData = [
    { time: "Immediately", retention: 100, label: "I've mastered this!" },
    { time: "20 min", retention: 60 },
    { time: "1 hr", retention: 45, label: "Wait, how did that concept work?" },
    { time: "9 hr", retention: 37 },
    { time: "1 day", retention: 33 },
    { time: "2 days", retention: 28 },
    { time: "6 days", retention: 18, label: "Did I even read this book?" },
    { time: "31 days", retention: 10 },
]

export default function ProblemOutline() {
    const [isMobile, setIsMobile] = useState(false)
    const [isTablet, setIsTablet] = useState(false)

    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 768)
            setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024)
        }

        // Initial check
        checkScreenSize()

        // Add event listener
        window.addEventListener("resize", checkScreenSize)

        // Cleanup
        return () => window.removeEventListener("resize", checkScreenSize)
    }, [])

    return (
        <section className="py-16 md:py-24 lg:py-32" id="problem">
            <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 bg-background">
                    <div className="w-full lg:w-1/2">
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                            The Real Problem Isn&apos;t You.
                        </h2>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
                            It&apos;s the System
                        </h2>
                        <p className="text-base md:text-lg mb-8">
                            We&apos;ve been taught to consume knowledge, not own
                            it.
                        </p>

                        <div className="space-y-6 md:space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-accent rounded-md shrink-0">
                                    <RefreshCwOff className="h-5 w-5 md:h-6 md:w-6 text-secondary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-base md:text-lg">
                                        No Reinforcement
                                    </h3>
                                    <p className="text-sm md:text-base text-muted-foreground">
                                        Your brain needs friction to grow.
                                        Passive reading is mental junk food.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-accent rounded-md shrink-0">
                                    <Unplug className="h-5 w-5 md:h-6 md:w-6 text-secondary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-base md:text-lg">
                                        No Connections
                                    </h3>
                                    <p className="text-sm md:text-base text-muted-foreground">
                                        That business book&apos;s insight about
                                        resilience? It&apos;s siloed from the
                                        philosophy book you read yesterday.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-accent rounded-md shrink-0">
                                    <LocateOff className="h-5 w-5 md:h-6 md:w-6 text-secondary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-base md:text-lg">
                                        No Direction
                                    </h3>
                                    <p className="text-sm md:text-base text-muted-foreground">
                                        Without linking learning to your goals,
                                        knowledge stays generic, not
                                        transformational.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-1/2 relative mt-8 lg:mt-0">
                        <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={graphData}
                                    margin={
                                        isMobile
                                            ? {
                                                  top: 15,
                                                  right: 10,
                                                  left: 10,
                                                  bottom: 50,
                                              }
                                            : isTablet
                                              ? {
                                                    top: 20,
                                                    right: 20,
                                                    left: 15,
                                                    bottom: 30,
                                                }
                                              : {
                                                    top: 20,
                                                    right: 30,
                                                    left: 20,
                                                    bottom: 10,
                                                }
                                    }
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                        stroke="hsl(var(--border))"
                                    />
                                    <XAxis
                                        dataKey="time"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: isMobile ? 10 : 12 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={isMobile ? 60 : 80}
                                        stroke="hsl(var(--foreground))"
                                        interval={isMobile ? 1 : 0}
                                    />
                                    <YAxis
                                        tickFormatter={(value) => `~${value}%`}
                                        domain={[0, 100]}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: isMobile ? 10 : 12 }}
                                        width={isMobile ? 40 : 50}
                                        stroke="hsl(var(--foreground))"
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="retention"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        dot={{
                                            fill: "hsl(var(--primary))",
                                            r: isMobile ? 3 : 4,
                                        }}
                                        activeDot={{
                                            r: isMobile ? 5 : 6,
                                            fill: "hsl(var(--secondary))",
                                        }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>

                            {/* Sticky note labels - responsive positioning */}
                            <div
                                className="absolute text-[10px] md:text-xs bg-accent/80 p-1.5 md:p-2 rounded shadow-sm transform text-foreground"
                                style={{
                                    top: isMobile ? "4%" : "2%",
                                    right: isMobile
                                        ? "52%"
                                        : isTablet
                                          ? "55%"
                                          : "60%",
                                    maxWidth: isMobile ? "100px" : "120px",
                                    transform: "rotate(2deg)",
                                    zIndex: 10,
                                }}
                            >
                                I&apos;ve mastered this!
                            </div>

                            <div
                                className="absolute text-[10px] md:text-xs bg-accent/80 p-1.5 md:p-2 rounded shadow-sm transform text-foreground"
                                style={{
                                    top: isMobile ? "44%" : "48%",
                                    left: isMobile
                                        ? "24%"
                                        : isTablet
                                          ? "28%"
                                          : "32%",
                                    maxWidth: isMobile ? "120px" : "150px",
                                    transform: "rotate(8deg)",
                                    zIndex: 10,
                                }}
                            >
                                Wait, how did that concept work?
                            </div>

                            <div
                                className="absolute text-[10px] md:text-xs bg-accent/80 p-1.5 md:p-2 rounded shadow-sm transform text-foreground"
                                style={{
                                    top: isMobile
                                        ? "28%"
                                        : isTablet
                                          ? "35%"
                                          : "42%",
                                    right: isMobile
                                        ? "0"
                                        : isTablet
                                          ? "0"
                                          : "2%",
                                    maxWidth: isMobile ? "120px" : "150px",
                                    transform: "rotate(5deg)",
                                    zIndex: 10,
                                }}
                            >
                                Did I even read this book?
                            </div>
                        </div>
                        <p className="text-center text-xs md:text-sm text-muted-foreground mt-4">
                            Most people forget 50% of what they read within an
                            hour and 90% within a week.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
