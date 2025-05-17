import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import confetti from "canvas-confetti"
import { Mail } from "lucide-react"
import { useState } from "react"

export const WaitlistForm = ({ variant }: { variant: "primary" | "black" }) => {
    const [email, setEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    return (
        <form
            action=""
            className="mx-auto w-full max-w-[30rem] mt-4 px-4 sm:px-0"
        >
            <div className="flex flex-col sm:flex-row w-full items-center gap-2 sm:space-x-2">
                <div className="relative flex items-center w-full">
                    <Mail className="ml-2 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                        type="email"
                        placeholder="Enter your email"
                        className="pl-12 py-6 w-full bg-accent"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <Button
                    className={cn("px-6 py-6 w-full sm:w-auto mt-2 sm:mt-0", {
                        " bg-black hover:bg-black/60": variant === "black",
                    })}
                    aria-label="submit"
                    disabled={isSubmitting}
                    onClick={async (e) => {
                        e.preventDefault()
                        if (!email) return

                        setIsSubmitting(true)
                        try {
                            const response = await fetch("/api/waitlist", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    email: email,
                                }),
                            })

                            if (response.ok) {
                                confetti({
                                    particleCount: 100,
                                    spread: 70,
                                    origin: { y: 0.6 },
                                })

                                toast({
                                    title: "You're on the waitlist!",
                                    description:
                                        "Make sure to check your spam inbox to confirm your waitlist spot. We'll keep you updated on our progress.",
                                    variant: "default",
                                })
                            } else {
                                toast({
                                    title: "Something went wrong",
                                    description: "Please try again later.",
                                    variant: "destructive",
                                })
                            }
                        } catch (error) {
                            console.error(error)
                            toast({
                                title: "Something went wrong",
                                description: "Please try again later.",
                                variant: "destructive",
                            })
                        } finally {
                            setIsSubmitting(false)
                        }
                    }}
                >
                    {isSubmitting ? "Joining..." : "Join Waitlist"}
                </Button>
            </div>
        </form>
    )
}
