"use client"

import { useForm, ValidationError } from "@formspree/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { useState } from "react"

export default function ContactSection() {
    const [state, handleSubmit] = useForm("mqpkqbpy")
    const [source, setSource] = useState("")

    if (state.succeeded) {
        return (
            <section className="py-32">
                <div className="mx-auto max-w-3xl px-8 lg:px-0">
                    <h1 className="text-center text-4xl font-semibold lg:text-5xl">
                        Contact us
                    </h1>
                    <p className="mt-4 text-center">
                        Questions, feedback, or press inquiries? Email us at support@readspace.ai — we read and respond to every message.
                    </p>

                    <Card className="mx-auto mt-12 max-w-lg p-8 shadow-md sm:p-16">
                        <div className="text-center space-y-4">
                            <div className="text-primary font-semibold text-lg">
                                ✓ Message sent successfully!
                            </div>
                            <p className="text-gray-600">
                                Thanks for reaching out. We'll get back to you as soon as possible.
                            </p>
                        </div>
                    </Card>
                </div>
            </section>
        )
    }

    return (
        <section className="py-32">
            <div className="mx-auto max-w-3xl px-8 lg:px-0">
                <h1 className="text-center text-4xl font-semibold lg:text-5xl">
                    Contact us
                </h1>
                <p className="mt-4 text-center">
                    Questions, feedback, or press inquiries? Email us at support@readspace.ai — we read and respond to every message.
                </p>

                <Card className="mx-auto mt-12 max-w-lg p-8 shadow-md sm:p-16">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input
                                type="text"
                                id="name"
                                name="name"
                                required
                            />
                            <ValidationError
                                field="name"
                                errors={state.errors}
                                className="text-red-500 text-sm mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="email">Your Email</Label>
                            <Input
                                type="email"
                                id="email"
                                name="email"
                                required
                            />
                            <ValidationError
                                field="email"
                                errors={state.errors}
                                className="text-red-500 text-sm mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="source">
                                Where did you find us?
                            </Label>
                            <Select value={source} onValueChange={setSource}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Social media">
                                        Social media
                                    </SelectItem>
                                    <SelectItem value="Tech community">
                                        Tech community
                                    </SelectItem>
                                    <SelectItem value="Search">
                                        Search
                                    </SelectItem>
                                    <SelectItem value="Friend">
                                        Friend
                                    </SelectItem>
                                    <SelectItem value="Newsletter">
                                        Newsletter
                                    </SelectItem>
                                    <SelectItem value="Other">
                                        Other
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <input
                                type="hidden"
                                name="source"
                                value={source}
                            />
                            <ValidationError
                                field="source"
                                errors={state.errors}
                                className="text-red-500 text-sm mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="message">Message</Label>
                            <Textarea
                                id="message"
                                name="message"
                                rows={3}
                                required
                            />
                            <ValidationError
                                field="message"
                                errors={state.errors}
                                className="text-red-500 text-sm mt-1"
                            />
                        </div>

                        <Button type="submit" disabled={state.submitting}>
                            {state.submitting ? "Sending..." : "Submit"}
                        </Button>

                        {state.errors && state.errors.length > 0 && (
                            <div className="text-red-500 text-sm mt-2">
                                Something went wrong. Please try again.
                            </div>
                        )}
                    </form>
                </Card>
            </div>
        </section>
    )
}
