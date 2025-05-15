import { ApiClient } from "./client"

export const UploadService = {
    async uploadDocument(formData: FormData, signal?: AbortSignal) {
        return ApiClient.uploadFile("/upload/", formData, signal)
    },
}