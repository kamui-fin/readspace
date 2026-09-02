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
        <div className="rounded-xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] ">
            {/* macOS-style titlebar */}
            <div className="px-4 py-2 flex items-center border-b border-gray-100 bg-white">
                <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 text-center text-sm font-medium text-gray-500">
                    {title}
                </div>
                <div className="w-6"></div>
            </div>

            {/* Content area */}
            <div className="overflow-hidden" style={{ backgroundColor: "#e5ede0" }}>{children}</div>
        </div>
    )
}
