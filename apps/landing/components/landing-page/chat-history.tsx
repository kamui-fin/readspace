"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"

// Define the message type
interface Message {
    id: string
    sender: "alice" | "bob" | "cat"
    avatar: boolean
    content: string
    time?: string
}

// Sample chat data
const initialMessages: Message[] = [
    {
        id: "7",
        sender: "alice",
        avatar: true,
        content: "just read 50 pages on macroecon let’s gooo",
    },
    {
        id: "8",
        sender: "bob",
        avatar: false,
        content: "thats tuff, now explain the fed rate hike 💀",
        time: "32 mins ago",
    },
    {
        id: "9",
        sender: "alice",
        avatar: true,
        content: "uuhh… vibes are bad so money go up? 😭",
    },
    {
        id: "10",
        sender: "bob",
        avatar: false,
        content: "LMAO we're both cooked",
    },
    {
        id: "10b",
        sender: "bob",
        avatar: false,
        content:
            "I memorized the IS-LM model, still don't know what a bond yield is lmfao",
        time: "10 mins ago",
    },
    {
        id: "11",
        sender: "cat",
        avatar: true,
        content:
            "dawg econ class got me solving graphs but i can’t even read a headline 😭",
        time: "5 mins ago",
    },
]

export default function ChatHistory() {
    const messages = initialMessages

    const getAvatar = (message: Message, target: "alice" | "bob" | "cat") => {
        if (message.sender != target) return

        if (message.sender === "alice") {
            return message.avatar ? (
                <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src="/female-avatar.jpg" alt="Alice" />
                    <AvatarFallback>A</AvatarFallback>
                </Avatar>
            ) : (
                <></>
                // <div className="h-8 w-8 mt-1 flex-shrink-0"></div>
            )
        } else if (message.sender === "bob") {
            return message.avatar ? (
                <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src="/male-avatar.jpg" alt="Bob" />
                    <AvatarFallback>B</AvatarFallback>
                </Avatar>
            ) : (
                <></>
                // <div className="h-8 w-8 mt-1 flex-shrink-0"></div>
            )
        } else {
            return message.avatar ? (
                <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src="/confused-avatar.jpg" alt="Cat" />
                    <AvatarFallback>C</AvatarFallback>
                </Avatar>
            ) : (
                <div className="h-8 w-8 mt-1 flex-shrink-0"></div>
            )
        }
    }

    return (
        <div className="py-24">
            <div className="shadow-sm bg-[#E4ECDF] w-full max-w-3xl mx-auto md:rounded-lg rounded-none">
                <Card className="py-6 px-2 md:px-6 pb-20 md:rounded-lg rounded-none">
                    <h1 className="text-4xl mb-8 font-semibold text-center p-6">
                        Sound familiar?
                    </h1>
                    <div className="space-y-2 md:px-6">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.sender === "alice" || message.sender === "cat" ? "justify-start" : "justify-end"}`}
                            >
                                <div className="flex gap-2 max-w-[70%]">
                                    {message.sender === "alice" &&
                                        getAvatar(message, "alice")}
                                    {message.sender === "cat" &&
                                        getAvatar(message, "cat")}
                                    <div>
                                        <div
                                            className={`rounded-lg p-2 ${
                                                message.sender === "bob"
                                                    ? "bg-[#709F53] text-primary-foreground"
                                                    : "bg-[#E0E9DB] text-foreground"
                                            } w-[100%]`}
                                        >
                                            <p className="text-sm">
                                                {message.content}
                                            </p>
                                        </div>
                                        {message.time && (
                                            <p className="text-xs text-muted-foreground text-[#ACB5A7] mt-1">
                                                {message.time}
                                            </p>
                                        )}
                                    </div>

                                    {getAvatar(message, "bob")}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    )
}
