import type { ViewportHighlight } from "react-pdf-highlighter-extended"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { PdfHighlight } from "@/types/library"
import { zodResolver } from "@hookform/resolvers/zod"
import { Separator } from "@radix-ui/react-separator"
import { MessageSquareDiff, PlusIcon, TrashIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

interface HighlightPopupProps {
    highlight: ViewportHighlight<PdfHighlight>
    deleteHighlight: (text: string) => void
    addNote: (note: string, textToAdd: string) => void
}

const HighlightPopup = ({
    highlight,
    deleteHighlight,
    addNote,
}: HighlightPopupProps) => {
    const [showNoteForm, setShowNoteForm] = useState(false)
    const [showAbove, setShowAbove] = useState(true)
    const formRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [isVisible, setIsVisible] = useState(true)

    const handleNoteSubmit = (note: string) => {
        if (!highlight.content.text) return
        addNote(note, highlight.content.text)
    }

    useEffect(() => {
        if (showNoteForm && buttonRef.current && formRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect()
            const formHeight = formRef.current.offsetHeight
            const spaceAbove = buttonRect.top

            // If there's not enough space above (adding some padding), show below
            setShowAbove(spaceAbove > formHeight + 30)
        }
    }, [showNoteForm])

    if (!isVisible) return null

    return (
        <Card className="popover-animation pl-2 pt-3 pr-20 pb-3 min-w-[300px] relative bg-background">
            <div>
                {highlight.note && (
                    <div className="flex flex-col w-full gap-y-1">
                        <h1 className="text-xl font-bold dark:text-white">
                            Note
                        </h1>
                        <p>{highlight.note}</p>
                        <Separator />
                    </div>
                )}
                <div className="flex space-x-3 items-center">
                    <Button
                        onClick={() => {
                            if (highlight.content.text)
                                deleteHighlight(highlight.content.text)
                            setIsVisible(false)
                        }}
                        variant="destructive"
                    >
                        <TrashIcon className="-ms-1 opacity-60" size={16} />
                        Delete
                    </Button>
                    <div className="relative">
                        <Button
                            ref={buttonRef}
                            variant="outline"
                            size="icon"
                            onClick={() => {
                                setShowNoteForm(!showNoteForm)
                            }}
                        >
                            <MessageSquareDiff />
                        </Button>
                    </div>
                    {showNoteForm && (
                        <div
                            ref={formRef}
                            className={`absolute z-50 ${showAbove
                                    ? "bottom-[calc(100%+30px)]"
                                    : "top-[calc(100%+30px)]"
                                } left-2 -translate-x-[20px] dark:bg-gray-800 p-4 rounded-md shadow-lg border bg-popover`}
                            style={{
                                minWidth: "285px",
                            }}
                        >
                            <AddNoteForm
                                onSubmit={(note) => {
                                    note
                                    handleNoteSubmit(note)
                                    setShowNoteForm(false)
                                    setIsVisible(false)
                                }}
                                defaultVal={
                                    highlight.note ? highlight.note : ""
                                }
                            />
                        </div>
                    )}
                </div>
            </div>
        </Card>
    )
}
const AnnotationFormSchema = z.object({
    note: z
        .string()
        .min(1, {
            message: "Note must not be empty",
        })
        .max(160, {
            message: "Note must not be longer than 160 characters.",
        }),
})

type AnnotationForm = z.infer<typeof AnnotationFormSchema>

function AddNoteForm({
    onSubmit,
    defaultVal,
}: {
    onSubmit: (note: string) => void
    defaultVal: string
}) {
    const formMethods = useForm<AnnotationForm>({
        resolver: zodResolver(AnnotationFormSchema),
        defaultValues: { note: defaultVal },
    })
    const submitHandler = formMethods.handleSubmit(async ({ note }) => {
        onSubmit(note)
        formMethods.reset()
    })
    return (
        <Form {...formMethods}>
            <form onSubmit={submitHandler} className="space-y-6">
                <FormField
                    control={formMethods.control}
                    name="note"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Annotation</FormLabel>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    placeholder="Add a new note"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    variant="outline"
                    className="aspect-square max-w-28 max-sm:p-0 self-end"
                >
                    <PlusIcon className="opacity-60 sm:-ms-1" size={16} />
                    <span className="max-sm:sr-only">Add new</span>
                </Button>
            </form>
        </Form>
    )
}

export default HighlightPopup
