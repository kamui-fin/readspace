"use client"

import Header from "@/components/features/navigation/AppHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Upload } from "lucide-react"
import { useRef } from "react"
import { useOpmlImport } from "./hooks/use-opml-import"
import { useActiveImportTask } from "@readspace/shared"

export default function OpmlImportView() {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const {
        isDragging,
        isLoading: isUploading,
        handleFileChange,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    } = useOpmlImport()

    const { data: activeTask } = useActiveImportTask()

    const handleButtonClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    return (
        <div className="flex flex-col h-full">
            <Header
                classAttributes="rounded-t-xl"
                breadcrumbItems={[
                    { href: "/import-opml", label: "OPML Import" },
                ]}
            />
            <main className="flex-1 px-4 py-6 md:px-6 overflow-hidden">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold mb-3">
                            {activeTask ? "Import Began" : "OPML Import"}
                        </h1>
                        <p className="text-muted-foreground leading-relaxed max-w-2xl">
                            {activeTask
                                ? "Your OPML import is currently running. Check the progress below."
                                : "Import feeds from an OPML file exported from another RSS reader."}
                        </p>
                    </div>

                    {/* Show active import status or upload section */}
                    {activeTask ? (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                                        <div>
                                            <div className="font-medium">
                                                {activeTask.filename}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {activeTask.estimated_feeds}{" "}
                                                feeds
                                            </div>
                                        </div>
                                    </div>
                                    <Button asChild>
                                        <a
                                            href={`/import-opml/status/${activeTask.task_id}`}
                                        >
                                            View Progress
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card
                            className={`transition-colors duration-200 cursor-pointer ${isDragging
                                ? "border-primary bg-primary/5"
                                : "border-dashed border-2"
                                } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={handleButtonClick}
                        >
                            <CardContent className="p-8 sm:p-12">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".opml,.xml"
                                    className="hidden"
                                />
                                <div className="flex flex-col items-center justify-center gap-6 text-center">
                                    <div className="p-4 bg-muted rounded-full">
                                        {isUploading ? (
                                            <Clock
                                                size={48}
                                                className="text-muted-foreground animate-spin"
                                            />
                                        ) : (
                                            <Upload
                                                size={48}
                                                className="text-muted-foreground"
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-3 max-w-lg">
                                        <h3 className="text-lg sm:text-xl font-medium">
                                            {isUploading
                                                ? "Uploading..."
                                                : isDragging
                                                    ? "Drop your OPML file here"
                                                    : "Upload OPML File"}
                                        </h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {isUploading
                                                ? "Please wait while we process your file"
                                                : "Drag and drop or click to select a .opml or .xml file from your RSS reader export"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    )
}
