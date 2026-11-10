import { AppInsights } from "applicationinsights-js";
import { settings } from "./telemetryClientSettings";

const EVENT_PREFIX = "WorkItemPropertyWidget.";

let sessionStarted = false;
let sessionReady = false;
let pending: Array<() => void> = [];

function utf8Bytes(value: string): Uint8Array {
    const encoded = encodeURIComponent(value);
    const bytes: number[] = [];
    for (let i = 0; i < encoded.length; i++) {
        if (encoded.charAt(i) === "%") {
            bytes.push(parseInt(encoded.substr(i + 1, 2), 16));
            i += 2;
        } else {
            bytes.push(encoded.charCodeAt(i));
        }
    }
    return new Uint8Array(bytes);
}

function toHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
        hex += ("0" + bytes[i].toString(16)).slice(-2);
    }
    return hex;
}

function sha256Hex(value: string): any {
    return (<any>window).crypto.subtle.digest("SHA-256", utf8Bytes(value)).then(toHex);
}

function ensureSession(): void {
    if (sessionStarted) {
        return;
    }
    sessionStarted = true;
    const webContext = VSS.getWebContext();
    sha256Hex(webContext.user.id).then((userHash: string) => {
        return sha256Hex(webContext.collection.id).then((orgHash: string) => {
            AppInsights.downloadAndSetup({ instrumentationKey: settings.key, disableAjaxTracking: true, enableDebug: false });
            AppInsights.setAuthenticatedUserContext(userHash, orgHash);
            sessionReady = true;
            pending.forEach((send) => send());
            pending = [];
        });
    }).catch(() => {
        pending = [];
    });
}

export function track(enabled: boolean, name: string, properties?: { [key: string]: string }): void {
    if (!enabled) {
        return;
    }
    ensureSession();
    const send = () => {
        // every event carries the widget version, so results can be grouped by the build that sent them
        const eventProperties: { [key: string]: string } = { version: VSS.getExtensionContext().version };
        for (const key in properties) {
            if (properties.hasOwnProperty(key)) {
                eventProperties[key] = properties[key];
            }
        }
        AppInsights.trackEvent(EVENT_PREFIX + name, eventProperties);
        AppInsights.flush();
    };
    if (sessionReady) {
        send();
    } else {
        pending.push(send);
    }
}

export function trackError(enabled: boolean, code: string): void {
    track(enabled, "Error", { code: code });
}
