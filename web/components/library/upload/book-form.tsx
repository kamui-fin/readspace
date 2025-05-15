"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/ui/sonner"
import { Textarea } from "@/components/ui/textarea"
import { getFrontendLimit, UserRole } from "@/utils/limits"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { updateBookGoals } from "./api"

type TargetLevel = "basic" | "intermediate" | "advanced"

interface BookGoalsFormProps {
    bookId: string
    userRole: UserRole
    onComplete: () => void
}

export const BookGoalsForm = ({
    bookId,
    userRole,
    onComplete,
}: BookGoalsFormProps) => {
    const [goals, setGoals] = useState("")
    const [targetLevel, setTargetLevel] = useState<TargetLevel>("advanced")
    const [isSaving, setIsSaving] = useState(false)

    const handleContinue = async () => {
        try {
            // If goals are not empty, update them
            if (goals.trim()) {
                const maxGoalLen = getFrontendLimit(userRole, "maxGoalLength")
                if (goals.length > maxGoalLen) {
                    toast.error(`Goals cannot exceed ${maxGoalLen} characters.`)
                    return
                }

                setIsSaving(true)
                await updateBookGoals(bookId, goals)
                toast.success("Your goals have been saved")
            }

            // Always move to the next step
            onComplete()
        } catch (error) {
            console.error("Error saving goals:", error)
            toast.error("Failed to save your goals")
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <Label htmlFor="goals">Your Goals (Optional)</Label>
                <Textarea
                    id="goals"
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    placeholder="For example: 'I want to understand the core principles of atomic habits and apply them to my daily routine.'"
                    className="min-h-[100px] mt-1 text-sm"
                />
            </div>
            <div className="hidden space-y-4">
                <Label>Target Level of Understanding</Label>
                <RadioGroup
                    className="gap-2 mt-1"
                    defaultValue="advanced"
                    value={targetLevel}
                    onValueChange={(value) =>
                        setTargetLevel(value as TargetLevel)
                    }
                >
                    <div className="border-input has-data-[state=checked]:border-ring relative flex w-full items-start gap-2 rounded-md border p-4 shadow-xs outline-none">
                        <RadioGroupItem
                            value="basic"
                            id="basic"
                            aria-describedby="basic-description"
                            className="order-1 after:absolute after:inset-0"
                        />
                        <div className="grid grow gap-2">
                            <Label htmlFor="basic">
                                Basic Understanding{" "}
                                <span className="text-muted-foreground text-xs leading-[inherit] font-normal">
                                    (Familiarity)
                                </span>
                            </Label>
                            <p
                                id="basic-description"
                                className="text-muted-foreground text-xs"
                            >
                                You want to understand the main concepts and key
                                points of the material.
                            </p>
                        </div>
                    </div>
                    <div className="border-input has-data-[state=checked]:border-ring relative flex w-full items-start gap-2 rounded-md border p-4 shadow-xs outline-none">
                        <RadioGroupItem
                            value="intermediate"
                            id="intermediate"
                            aria-describedby="intermediate-description"
                            className="order-1 after:absolute after:inset-0"
                        />
                        <div className="grid grow gap-2">
                            <Label htmlFor="intermediate">
                                Intermediate Understanding{" "}
                                <span className="text-muted-foreground text-xs leading-[inherit] font-normal">
                                    (Comprehension)
                                </span>
                            </Label>
                            <p
                                id="intermediate-description"
                                className="text-muted-foreground text-xs"
                            >
                                You want to be able to explain concepts and
                                apply them in different contexts.
                            </p>
                        </div>
                    </div>
                    <div className="border-input has-data-[state=checked]:border-ring relative flex w-full items-start gap-2 rounded-md border p-4 shadow-xs outline-none">
                        <RadioGroupItem
                            value="advanced"
                            id="advanced"
                            aria-describedby="advanced-description"
                            className="order-1 after:absolute after:inset-0"
                        />
                        <div className="grid grow gap-2">
                            <Label htmlFor="advanced">
                                Advanced Understanding{" "}
                                <span className="text-muted-foreground text-xs leading-[inherit] font-normal">
                                    (Mastery)
                                </span>
                            </Label>
                            <p
                                id="advanced-description"
                                className="text-muted-foreground text-xs"
                            >
                                You want to deeply understand the material and
                                be able to teach it to others.
                            </p>
                        </div>
                    </div>
                </RadioGroup>
            </div>

            <div className="flex justify-end">
                <Button
                    onClick={handleContinue}
                    disabled={isSaving}
                    className="group"
                >
                    {isSaving ? (
                        <div className="flex items-center gap-2">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            <span>Saving...</span>
                        </div>
                    ) : (
                        "Continue"
                    )}
                </Button>
            </div>
        </div>
    )
}
