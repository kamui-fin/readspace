import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { FolderPlus, Loader2 } from "lucide-react"

interface FolderSelectProps {
    folders: Array<{ id: string; name: string }>
    selectedFolderId: string
    onFolderSelect: (folderId: string) => void
    isCreatingFolder: boolean
    onCreateNew: () => void
    onCancelCreate: () => void
    newFolderName: string
    onNewFolderNameChange: (name: string) => void
    isLoading: boolean
}

export function FolderSelect({
    folders,
    selectedFolderId,
    onFolderSelect,
    isCreatingFolder,
    onCreateNew,
    newFolderName,
    onNewFolderNameChange,
    isLoading,
}: FolderSelectProps) {
    return (
        <div className="space-y-2">
            <Label htmlFor="folder-select" className="text-sm font-medium">
                Choose Folder
                <span className="text-destructive ml-1">*</span>
            </Label>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                </div>
            ) : isCreatingFolder ? (
                <div className="space-y-2">
                    <Input
                        id="folder-name-input"
                        placeholder="Enter folder name..."
                        value={newFolderName}
                        onChange={(e) => onNewFolderNameChange(e.target.value)}
                        required
                        autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                        Creating a new folder: &quot;{newFolderName || "..."}
                        &quot;
                    </p>
                </div>
            ) : (
                <Select
                    value={selectedFolderId}
                    onValueChange={(value) => {
                        if (value === "CREATE_NEW") {
                            onCreateNew()
                        } else {
                            onFolderSelect(value)
                        }
                    }}
                    required
                >
                    <SelectTrigger id="folder-select">
                        <SelectValue placeholder="Select a folder" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            value="CREATE_NEW"
                            className="cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <FolderPlus className="h-4 w-4 text-primary" />
                                <span className="font-medium">
                                    Create New Folder
                                </span>
                            </div>
                        </SelectItem>
                        {folders.map((folder) => (
                            <SelectItem
                                key={folder.id}
                                value={folder.id}
                                className="cursor-pointer"
                            >
                                {folder.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
    )
}
