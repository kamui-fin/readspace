declare module "opml" {
    interface OpmlOutline {
        text?: string
        title?: string
        xmlUrl?: string
        htmlUrl?: string
        type?: string
        children?: OpmlOutline[]
    }

    interface OpmlHead {
        title?: string
        dateCreated?: string
        dateModified?: string
    }

    interface OpmlBody {
        children: OpmlOutline[]
    }

    interface ParsedOpml {
        head?: OpmlHead
        body?: OpmlBody
    }

    export function parse(opmlString: string): ParsedOpml | null
}