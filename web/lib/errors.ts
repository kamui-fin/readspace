export class HTTPError extends Error {
    status: number
    response?: string

    constructor(status: number, response?: string) {
        super(`HTTP Error: ${status}`)
        this.status = status
        this.response = response
        this.name = "HTTPError"
    }
}
