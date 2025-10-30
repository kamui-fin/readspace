import { FolderPicker, type FolderPickerRef } from '@/components/FolderPicker';
import { createContext, useContext, useRef, type ReactNode } from 'react';

interface FolderPickerContextValue {
    openPicker: (onSelect: (folderId: string) => void) => void;
}

const FolderPickerContext = createContext<FolderPickerContextValue | null>(null);

export function FolderPickerProvider({ children }: { children: ReactNode }) {
    const folderPickerRef = useRef<FolderPickerRef>(null);
    const onSelectRef = useRef<((folderId: string) => void) | null>(null);

    const openPicker = (onSelect: (folderId: string) => void) => {
        onSelectRef.current = onSelect;
        folderPickerRef.current?.present();
    };

    const handleFolderSelect = (folderId: string) => {
        onSelectRef.current?.(folderId);
        onSelectRef.current = null;
    };

    return (
        <FolderPickerContext.Provider value={{ openPicker }}>
            {children}
            <FolderPicker ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
        </FolderPickerContext.Provider>
    );
}

export function useFolderPicker() {
    const context = useContext(FolderPickerContext);
    if (!context) {
        throw new Error('useFolderPicker must be used within FolderPickerProvider');
    }
    return context;
}
