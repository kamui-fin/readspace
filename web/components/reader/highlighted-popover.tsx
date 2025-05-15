import { EpubHighlight, PdfHighlight } from "@/types/library"
import { useReaderStore } from "@/stores/reader"
import { zodResolver } from "@hookform/resolvers/zod"
import { MessageSquareDiff, PlusIcon, TrashIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { ViewportHighlight } from "react-pdf-highlighter-extended"
import { z } from "zod"
import { Button } from "../ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "../ui/form"
import { Separator } from "../ui/separator"
import { Textarea } from "../ui/textarea"
import { CustomTooltip } from "./highlight-popover"

interface HighlightedPopoverProps {
    selectedHighlight: EpubHighlight | ViewportHighlight<PdfHighlight>
    handleRemoveHighlight(text?: string): void
    handleSubmitNote(note: string, text?: string): void
}

const HighlightedPopover = ({
    selectedHighlight,
    handleRemoveHighlight,
    handleSubmitNote,
}: HighlightedPopoverProps) => {
    const [isVisible, setIsVisible] = useState(true)
    const [showNoteForm, setShowNoteForm] = useState(false)
    const [showAbove, setShowAbove] = useState(true)
    const formRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const highlightType = useReaderStore((state) => state.bookMeta?.type)

    const onRemoveHighlight = () => {
        if (highlightType == "epub") {
            handleRemoveHighlight()
        } else {
            handleRemoveHighlight(
                (selectedHighlight as unknown as PdfHighlight).content.text
            )
        }
        setIsVisible(false)
    }

    const onAddNote = (note: string) => {
        if (highlightType == "epub") {
            handleSubmitNote(note)
        } else {
            handleSubmitNote(
                note,
                (selectedHighlight as unknown as PdfHighlight).content.text
            )
        }

        setShowNoteForm(false)
        setIsVisible(false)
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
        <div className="p-4 rounded-lg border shadow-lg w-[300px] bg-background popover-animation">
            <div className="flex flex-col w-full gap-y-4">
                {selectedHighlight?.note && (
                    <div className="flex flex-col w-full gap-y-1">
                        <h1 className="text-xl font-bold dark:text-white">
                            Note
                        </h1>
                        <p>{selectedHighlight.note}</p>
                        <Separator />
                    </div>
                )}
                <div className="flex space-x-3 items-center">
                    <CustomTooltip content="Remove highlight">
                        <Button
                            onClick={onRemoveHighlight}
                            variant="destructive"
                        >
                            <TrashIcon className="-ms-1 opacity-60" size={16} />
                            Delete
                        </Button>
                    </CustomTooltip>
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
                            className={`absolute z-50 ${
                                showAbove
                                    ? "bottom-[calc(100%+30px)]"
                                    : "top-[calc(100%+30px)]"
                            } left-2 -translate-x-[20px] dark:bg-gray-800 p-4 rounded-md shadow-lg border bg-popover`}
                            style={{
                                minWidth: "285px",
                            }}
                        >
                            <AddNoteForm
                                onSubmit={onAddNote}
                                defaultVal={
                                    selectedHighlight.note
                                        ? selectedHighlight.note
                                        : ""
                                }
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
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

export function AddNoteForm({
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
                                    placeholder="Add a small note"
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

export default HighlightedPopover
