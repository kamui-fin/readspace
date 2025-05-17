import type React from "react"
interface MacWindowProps {
    children: React.ReactNode
    title?: string
}

export default function MacWindow({
    children,
    title = "Readspace",
}: MacWindowProps) {
    return (
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] ">
            {/* macOS-style titlebar - remove bg, add border-b */}
            <div className="px-4 py-2 flex items-center border-b border-gray-200">
                <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 text-center text-sm font-medium text-gray-500">
                    {title}
                </div>
                <div className="w-6"></div> {/* Spacer to balance the layout */}
            </div>

            {/* Content area - add padding */}
            <div className="bg-white p-1">{children}</div>
        </div>
    )
}
