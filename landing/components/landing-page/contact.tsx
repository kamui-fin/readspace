"use client"

import { useState } from "react"
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
import { contactSchema } from "@/lib/landing/zod"
import z from "zod"
import { Formik, Form, Field, ErrorMessage, FormikHelpers } from "formik"
import { toFormikValidationSchema } from "zod-formik-adapter"

type ContactFormValues = z.infer<typeof contactSchema>

export default function ContactSection() {
    const [status, setStatus] = useState<
        "idle" | "sending" | "success" | "error"
    >("idle")

    const initialValues: ContactFormValues = {
        name: "",
        email: "",
        source: "",
        message: "",
    }

    const handleSubmit = async (
        values: ContactFormValues,
        { resetForm }: FormikHelpers<ContactFormValues>
    ) => {
        setStatus("sending")

        try {
            const response = await fetch("/api/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (response.ok) {
                setStatus("success")
                resetForm()
            } else {
                setStatus("error")
            }
        } catch (error) {
            console.error(error)
            setStatus("error")
        }
    }

    return (
        <section className="py-32">
            <div className="mx-auto max-w-3xl px-8 lg:px-0">
                <h1 className="text-center text-4xl font-semibold lg:text-5xl">
                    Contact Us
                </h1>
                <p className="mt-4 text-center">
                    Help shape Readspace – We value your feedback!
                </p>

                <Card className="mx-auto mt-12 max-w-lg p-8 shadow-md sm:p-16">
                    <Formik
                        initialValues={initialValues}
                        validationSchema={toFormikValidationSchema(
                            contactSchema
                        )}
                        onSubmit={handleSubmit}
                    >
                        {({
                            errors,
                            touched,
                            isSubmitting,
                            setFieldValue,
                            values,
                        }) => (
                            <Form className="space-y-6">
                                <div>
                                    <Label htmlFor="name">Name</Label>
                                    <Field
                                        as={Input}
                                        type="text"
                                        id="name"
                                        name="name"
                                        className={
                                            errors.name && touched.name
                                                ? "border-red-500"
                                                : ""
                                        }
                                    />
                                    <ErrorMessage
                                        name="name"
                                        component="div"
                                        className="text-red-500 text-sm mt-1"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="email">Your Email</Label>
                                    <Field
                                        as={Input}
                                        type="email"
                                        id="email"
                                        name="email"
                                        className={
                                            errors.email && touched.email
                                                ? "border-red-500"
                                                : ""
                                        }
                                    />
                                    <ErrorMessage
                                        name="email"
                                        component="div"
                                        className="text-red-500 text-sm mt-1"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="source">
                                        Where did you find us?
                                    </Label>
                                    <Select
                                        onValueChange={(value) =>
                                            setFieldValue("source", value)
                                        }
                                        value={values.source}
                                    >
                                        <SelectTrigger
                                            className={
                                                errors.source && touched.source
                                                    ? "border-red-500"
                                                    : ""
                                            }
                                        >
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
                                    <ErrorMessage
                                        name="source"
                                        component="div"
                                        className="text-red-500 text-sm mt-1"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="message">Message</Label>
                                    <Field
                                        as={Textarea}
                                        id="message"
                                        name="message"
                                        rows={3}
                                        className={
                                            errors.message && touched.message
                                                ? "border-red-500"
                                                : ""
                                        }
                                    />
                                    <ErrorMessage
                                        name="message"
                                        component="div"
                                        className="text-red-500 text-sm mt-1"
                                    />
                                </div>

                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Sending..." : "Submit"}
                                </Button>

                                {status === "success" && (
                                    <div className="text-green-500 mt-2">
                                        Message sent successfully!
                                    </div>
                                )}
                                {status === "error" && (
                                    <div className="text-red-500 mt-2">
                                        Something went wrong. Try again.
                                    </div>
                                )}
                            </Form>
                        )}
                    </Formik>
                </Card>
            </div>
        </section>
    )
}
