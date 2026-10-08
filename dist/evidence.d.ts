export type Signal = {
    group: string;
    name: string;
    value: unknown;
    status: 'measured' | 'unavailable' | 'error';
    source: string;
};
export type Report = {
    capturedAt: string;
    version: number;
    signals: Signal[];
    digest: string;
    duration: number;
};
export declare function fingerprintInput(signals: Signal[]): string;
export declare function compactReport(report: Report): {
    e?: Record<string, string> | undefined;
    v: number;
    t: string;
    h: string;
    ms: number;
};
export declare function collect(options?: {
    networkEndpoint?: string;
    signal?: AbortSignal;
}): Promise<Report>;
