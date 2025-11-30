"use client"

import Header from "@/components/features/navigation/AppHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, FileText, Upload } from "lucide-react"
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
                            className={`transition-colors duration-200 ${isDragging
                                    ? "border-primary bg-primary/5"
                                    : "border-dashed border-2"
                                }`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
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
                                        <Upload
                                            size={48}
                                            className="text-muted-foreground"
                                        />
                                    </div>

                                    <div className="space-y-3 max-w-md">
                                        <h3 className="text-lg sm:text-xl font-medium">
                                            {isDragging
                                                ? "Drop your OPML file here"
                                                : "Upload OPML File"}
                                        </h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Drag and drop or click to select a
                                            .opml or .xml file from your RSS
                                            reader export
                                        </p>
                                    </div>

                                    <Button
                                        onClick={handleButtonClick}
                                        disabled={isUploading}
                                        size="lg"
                                        className="mt-2 w-full sm:w-auto"
                                    >
                                        {isUploading ? (
                                            <>
                                                <Clock className="mr-2 h-4 w-4 animate-spin" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="mr-2 h-4 w-4" />
                                                Choose File
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    )
}
