// Browser-compatible OPML parser
// Based on the node OPML package but adapted for browser use

declare global {
    interface Window {
        $: any;
    }
}

function filledString(ch: string, ct: number): string {
    let s = "";
    for (let i = 0; i < ct; i++) {
        s += ch;
    }
    return s;
}

function encodeXml(s: string): string {
    if (s === undefined) {
        return "";
    }
    
    const charMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;'
    };
    
    s = s.toString();
    s = s.replace(/\u00A0/g, " ");
    const escaped = s.replace(/[<>&"]/g, function(ch) {
        return charMap[ch];
    });
    return escaped;
}

function xmlCompile(xmltext: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(xmltext, "text/xml");
}

function xmlGatherAttributes(element: Element, theTable: Record<string, string>): void {
    if (element.attributes) {
        for (let i = 0; i < element.attributes.length; i++) {
            const att = element.attributes[i];
            if (att.specified) {
                theTable[att.name] = att.value;
            }
        }
    }
}

function xmlGetAddress(doc: Document, name: string): Element | null {
    return doc.querySelector(name);
}

function xmlGetSubValues(element: Element | null): Record<string, string> {
    const values: Record<string, string> = {};
    if (!element) return values;
    
    const children = element.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const name = child.nodeName;
        if (name.length > 0) {
            const val = child.textContent || "";
            values[name] = val;
        }
    }
    return values;
}

function xmlHasSubs(element: Element): boolean {
    return element.children.length > 0;
}

interface OpmlOutline {
    text?: string;
    xmlUrl?: string;
    htmlUrl?: string;
    type?: string;
    title?: string;
    [key: string]: any;
    subs?: OpmlOutline[];
}

interface OpmlStructure {
    opml: {
        head: Record<string, string>;
        body: {
            subs: OpmlOutline[];
        };
    };
}

function outlineToJson(element: Element, nameOutlineElement = "outline"): OpmlOutline {
    const theOutline: OpmlOutline = {};
    
    xmlGatherAttributes(element, theOutline);
    
    if (xmlHasSubs(element)) {
        theOutline.subs = [];
        const outlineChildren = element.querySelectorAll(`:scope > ${nameOutlineElement}`);
        outlineChildren.forEach(child => {
            theOutline.subs!.push(outlineToJson(child as Element, nameOutlineElement));
        });
    }
    
    return theOutline;
}

function opmlParse(opmltext: string): OpmlStructure {
    let xstruct: Document;
    try {
        xstruct = xmlCompile(opmltext);
        
        // Check for XML parsing errors
        const parseError = xstruct.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid XML format');
        }
    } catch (err) {
        console.log("opmlParse: invalid XML.");
        throw err;
    }
    
    const head = xmlGetAddress(xstruct, "head");
    const body = xmlGetAddress(xstruct, "body");
    
    if (!body) {
        throw new Error('No body element found in OPML');
    }
    
    const bodyOutline = outlineToJson(body, "outline");
    
    const theObject: OpmlStructure = {
        opml: {
            head: xmlGetSubValues(head),
            body: {
                subs: bodyOutline.subs || []
            }
        }
    };
    
    return theObject;
}

function opmlStringify(theOutline: OpmlStructure): string {
    let opmltext = "";
    let indentlevel = 0;
    
    function add(s: string): void {
        opmltext += filledString("\t", indentlevel) + s + "\n";
    }
    
    function addSubs(subs: OpmlOutline[] | undefined): void {
        if (subs !== undefined) {
            for (let i = 0; i < subs.length; i++) {
                const sub = subs[i];
                let atts = "";
                for (const x in sub) {
                    if (x !== "subs") {
                        atts += ` ${x}="${encodeXml(sub[x])}"`;
                    }
                }
                if (sub.subs === undefined) {
                    add(`<outline${atts} />`);
                } else {
                    add(`<outline${atts} >`);
                    indentlevel++;
                    addSubs(sub.subs);
                    add("</outline>");
                    indentlevel--;
                }
            }
        }
    }
    
    add('<?xml version="1.0" encoding="ISO-8859-1"?>');
    add('<opml version="2.0">');
    indentlevel++;
    
    // Head section
    add("<head>");
    indentlevel++;
    for (const x in theOutline.opml.head) {
        add(`<${x}>${theOutline.opml.head[x]}</${x}>`);
    }
    add("</head>");
    indentlevel--;
    
    // Body section
    add("<body>");
    indentlevel++;
    addSubs(theOutline.opml.body.subs);
    add("</body>");
    indentlevel--;
    
    add("</opml>");
    indentlevel--;
    
    return opmltext;
}

function visitAll(theOutline: OpmlStructure, callback: (outline: OpmlOutline) => boolean): void {
    function visitSubs(theNode: { subs?: OpmlOutline[] }): boolean {
        if (theNode.subs !== undefined) {
            for (let i = 0; i < theNode.subs.length; i++) {
                const theSub = theNode.subs[i];
                if (!callback(theSub)) {
                    return false;
                }
                if (!visitSubs(theSub)) {
                    return false;
                }
            }
        }
        return true;
    }
    visitSubs(theOutline.opml.body);
}

export const opml = {
    parse: opmlParse,
    stringify: opmlStringify,
    visitAll: visitAll
};

export type { OpmlStructure, OpmlOutline };