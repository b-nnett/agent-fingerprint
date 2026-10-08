export function collectDevice(): {
    userAgent: string;
    platform: string;
    language: string;
    languages: string[];
    hardwareConcurrency: number;
    deviceMemory: any;
    maxTouchPoints: number;
    webdriver: boolean;
    vendor: string;
    productSub: string;
    oscpu: any;
    screen: {
        width: number;
        height: number;
        availWidth: number;
        availHeight: number;
        colorDepth: number;
        pixelDepth: number;
    };
    viewport: {
        w: number;
        h: number;
        dpr: number;
        ow: number;
        oh: number;
    };
    timezone: any;
    timezoneOffset: number;
    plugins: any[];
    mimeTypes: any;
    canvasHash: any;
    canvas: any;
    webgl: any;
    storage: {
        localStorage: any;
        indexedDB: any;
        cookies: boolean;
    };
    features: {
        serviceWorker: boolean;
        webassembly: boolean;
        offscreenCanvas: boolean;
        touch: boolean;
    };
};
export function fonts(): any;
export function mathProbes(): any;
export function timingSignals(): any;
export function cssEnvironment(): any;
export function connection(): any;
export function integrity(): {
    webdriver: boolean;
    codexAnnotationRoot: any;
    pluginCoherence: any;
    windowDelta: number[];
    fnToString: any[];
    chromeRuntime: boolean;
    stackFormat: any;
    hasNotification: boolean;
    languagesEmpty: boolean;
    isIframed: boolean;
    historyLength: number;
    hasReferrer: boolean;
    battery: any;
    gamepads: any;
    hasBluetooth: boolean;
    hasUsb: boolean;
    hasHid: boolean;
    codecs: any;
};
export function canvasPreview(): ({
    kind: string;
    width: any;
    height: any;
    png: any;
    hash: string;
    repeatMatches: boolean;
    error?: undefined;
} | {
    kind: string;
    error: string;
    width?: undefined;
    height?: undefined;
    png?: undefined;
    hash?: undefined;
    repeatMatches?: undefined;
})[];
export function canvasDetails(): any;
