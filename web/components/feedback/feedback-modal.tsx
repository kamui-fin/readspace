"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import toast from "react-hot-toast"

interface FeedbackModalProps {
    isOpen: boolean
    onClose: () => void
    userId?: string | null
}

type FeedbackType = "bug" | "suggestion" | "confusing" | "other"

export function FeedbackModal({ isOpen, onClose, userId }: FeedbackModalProps) {
    const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug")
    const [description, setDescription] = useState("")
    const [allowFollowUp, setAllowFollowUp] = useState(true)

    const { mutate: submitFeedback, isPending } = useMutation({
        mutationFn: async () => {
            const response = await fetch("/api/v1/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    feedback_type: feedbackType,
                    description,
                    allow_follow_up: allowFollowUp,
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to submit feedback")
            }
        },
        onSuccess: () => {
            toast.success("Thank you for your feedback!")
            onClose()
        },
        onError: (error) => {
            toast.error("Failed to submit feedback. Please try again.")
            console.error("Error submitting feedback:", error)
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        submitFeedback()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Submit Feedback</DialogTitle>
                    <DialogDescription>
                        Help us improve by sharing your thoughts, reporting
                        bugs, or suggesting features.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Feedback Type</Label>
                            <RadioGroup
                                value={feedbackType}
                                onValueChange={(value) =>
                                    setFeedbackType(value as FeedbackType)
                                }
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="bug" id="bug" />
                                    <Label htmlFor="bug">Bug Report</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem
                                        value="suggestion"
                                        id="suggestion"
                                    />
                                    <Label htmlFor="suggestion">
                                        Suggestion
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem
                                        value="confusing"
                                        id="confusing"
                                    />
                                    <Label htmlFor="confusing">
                                        Something's Confusing
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="other" id="other" />
                                    <Label htmlFor="other">Other</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Please describe your feedback in detail..."
                                required
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="follow-up"
                                checked={allowFollowUp}
                                onChange={(e) =>
                                    setAllowFollowUp(e.target.checked)
                                }
                            />
                            <Label htmlFor="follow-up">
                                Allow us to follow up with you
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Submitting..." : "Submit Feedback"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
