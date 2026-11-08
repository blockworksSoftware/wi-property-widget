// ---------------------------------------------------------------------
// <copyright file="htmlSanitizer.ts">
//    This code is licensed under the MIT License.
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
//    ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
//    TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
//    PARTICULAR PURPOSE AND NONINFRINGEMENT.
// </copyright>
// <summary>
// Keeps simple formatting from a work item field and removes anything that can run script or load remote content.
// </summary>
// ---------------------------------------------------------------------

"use strict";

// Tags that keep their formatting. Any other tag is removed, and its text is kept.
const allowedTags: { [tag: string]: boolean } = {
    "A": true, "B": true, "BR": true, "EM": true, "H1": true, "H2": true, "H3": true,
    "H4": true, "H5": true, "H6": true, "I": true, "LI": true, "OL": true, "P": true,
    "STRONG": true, "U": true, "UL": true,
};

// Tags removed together with everything inside them.
const droppedTags: { [tag: string]: boolean } = {
    "SCRIPT": true, "STYLE": true, "IFRAME": true, "OBJECT": true, "EMBED": true, "SVG": true,
    "MATH": true, "TEMPLATE": true, "NOSCRIPT": true, "FORM": true, "TEXTAREA": true,
    "SELECT": true, "BUTTON": true, "INPUT": true, "LINK": true, "META": true,
};

// Only http and https links keep their href. javascript: and data: links are removed.
function safeHref(value: string): string {
    const href = (value || "").trim();
    return /^https?:\/\//i.test(href) ? href : "";
}

// Images keep inline data: sources and http or https sources, as Azure DevOps shows them in the work item.
// SVG inside an <img> can't run script, so it's allowed.
function safeImageSource(value: string): string {
    const src = (value || "").trim();
    const isInlineImage = /^data:image\/(png|jpeg|gif|webp|svg\+xml)[;,]/i.test(src);
    const isWebImage = /^https?:\/\//i.test(src);
    return isInlineImage || isWebImage ? src : "";
}

function copyChildren(source: Node, target: Node, doc: Document): void {
    for (let i = 0; i < source.childNodes.length; i++) {
        const child = source.childNodes[i];
        if (child.nodeType === 3) {
            // text
            target.appendChild(doc.createTextNode(child.nodeValue || ""));
        } else if (child.nodeType === 1) {
            // element
            const element = child as Element;
            const tag = element.tagName.toUpperCase();
            if (droppedTags[tag]) {
                continue;
            }
            if (tag === "IMG") {
                const src = safeImageSource(element.getAttribute("src") || "");
                if (src) {
                    const image = doc.createElement("img");
                    image.setAttribute("src", src);
                    image.setAttribute("alt", element.getAttribute("alt") || "");
                    target.appendChild(image);
                }
                continue;
            }
            if (allowedTags[tag]) {
                const copy = doc.createElement(tag);
                if (tag === "A") {
                    const href = safeHref(element.getAttribute("href") || "");
                    if (href) {
                        copy.setAttribute("href", href);
                        copy.setAttribute("target", "_blank");
                        copy.setAttribute("rel", "noopener noreferrer");
                    }
                }
                target.appendChild(copy);
                copyChildren(element, copy, doc);
            } else {
                // unknown tag, for example DIV or IMG: keep its text and drop the tag
                copyChildren(element, target, doc);
            }
        }
    }
}

// Returns HTML that is safe to pass to jQuery .html(). DOMParser documents don't run scripts or load images.
export function sanitizeHtml(value: any): string {
    const parsed = new DOMParser().parseFromString("<body>" + String(value) + "</body>", "text/html");
    const output = parsed.createElement("div");
    copyChildren(parsed.body, output, parsed);
    return output.innerHTML;
}
