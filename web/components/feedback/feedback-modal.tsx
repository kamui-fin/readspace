"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client" // Import Supabase client
import * as React from "react"
import { toast } from "../ui/sonner"

// Define the props for the modal
interface FeedbackModalProps {
    isOpen: boolean
    onOpenChange: (isOpen: boolean) => void
    userId: string | null // Add userId prop
    userEmail: string | null // Add userEmail prop
}

export function FeedbackModal({
    isOpen,
    onOpenChange,
    userId,
    userEmail,
}: FeedbackModalProps) {
    const [allowFollowUp, setAllowFollowUp] = React.useState(false)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)
        const feedbackData = {
            feedback_type: formData.get("feedbackType") as string,
            description: formData.get("description") as string,
            allow_follow_up: formData.get("allowFollowUp") === "on",
            user_id: userId, // Use prop directly
        }

        const supabase = createClient()
        const { error } = await supabase.from("feedback").insert(feedbackData)
        if (error) {
            console.error("Error submitting feedback:", error)
            toast.error("Failed to submit feedback. Please try again.")
            // Do not close modal on error
            return
        }

        toast.success("Thank you for your feedback!")
        onOpenChange(false)
        // Reset only allowFollowUp state
        setAllowFollowUp(false)
    }

    // Reset allowFollowUp state when dialog closes (keep this)
    React.useEffect(() => {
        if (!isOpen) {
            setAllowFollowUp(false)
        }
    }, [isOpen])

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    {/* Use non-breaking space for emoji padding */}
                    <DialogTitle>We&apos;d love your feedback</DialogTitle>
                    <DialogDescription>
                        Help us make Readspace better. Spotted a bug? Confused
                        by something? Got an idea?
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        {/* Feedback Type Dropdown */}
                        <div className="grid grid-cols-1 gap-2">
                            <Label htmlFor="feedback-type">
                                This is about:
                            </Label>
                            <Select name="feedbackType" required>
                                <SelectTrigger id="feedback-type">
                                    <SelectValue placeholder="Select an option..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Use non-breaking spaces for emoji padding */}
                                    <SelectItem value="bug">
                                        A bug&nbsp;🐞
                                    </SelectItem>
                                    <SelectItem value="suggestion">
                                        A suggestion&nbsp;💡
                                    </SelectItem>
                                    <SelectItem value="confusing">
                                        Something confusing&nbsp;😕
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Description Textarea */}
                        <div className="grid grid-cols-1 gap-2">
                            <Label htmlFor="description">
                                What happened? What should we fix or improve?
                            </Label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Tell us more..."
                                className="min-h-[100px]"
                                required
                            />
                        </div>

                        {/* Follow-up Checkbox and Email Input */}
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="allow-follow-up"
                                name="allowFollowUp"
                                checked={allowFollowUp}
                                onCheckedChange={(checked) =>
                                    setAllowFollowUp(Boolean(checked))
                                }
                            />
                            <Label
                                htmlFor="allow-follow-up"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                You're welcome to follow up at:
                            </Label>
                        </div>
                        {allowFollowUp && (
                            <div className="grid grid-cols-1 gap-2 pl-6">
                                <Label
                                    htmlFor="follow-up-email"
                                    className="sr-only"
                                >
                                    Follow-up Email
                                </Label>
                                <Input
                                    id="follow-up-email"
                                    name="followUpEmail"
                                    type="email"
                                    placeholder="your.email@example.com"
                                    // Use defaultValue with the prop email
                                    defaultValue={userEmail ?? ""} // Use prop
                                    key={userEmail} // Still useful to reset if prop changes
                                    required={allowFollowUp}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">Send Feedback</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
