export type Evidence = Record<string, any>;
export declare const origins: readonly ["Browserbase", "Grok bot", "ChatGPT web", "Real Browser", "Real Chrome (via automation)", "Instinct", "Codex Browser", "Claude", "OpenAI dots", "Kernel.sh", "Steel", "Browser Use", "Hyperbrowser", "Notte", "Cloudflare Browser Run"];
export type Origin = typeof origins[number];
type Reason = {
    signal: string;
    value: unknown;
    implication: string;
};
type Candidate = {
    origin: Origin;
    score: number;
    confidence: 'low' | 'medium';
    basis: string;
    reasons: Reason[];
    referenceCount?: number;
    matchedFamilies?: string[];
};
export type Reference = {
    id: string;
    origin: Origin;
    evidence: Evidence;
};
export declare function signature(e: Evidence): Record<string, unknown>;
export declare function referenceCandidates(e: Evidence, references: Reference[]): Candidate[];
export declare function detect(e: Evidence, observedUserAgent: string, references?: Reference[]): {
    detectorVersion: number;
    suspectedIdentity: string;
    identityBasis: string;
    probableOrigin: string;
    confidence: string;
    browser: {
        assessment: string;
        confidence: string;
        blockers: string[];
        reasons: Reason[];
    };
    referenceMargin: number | null;
    referenceSamples: number;
    automation: {
        score: number;
        assessment: string;
        reasons: Reason[];
    };
    candidates: Candidate[];
    unrecognisedOrigins: ("Browserbase" | "Grok bot" | "ChatGPT web" | "Real Browser" | "Real Chrome (via automation)" | "Instinct" | "Codex Browser" | "Claude" | "OpenAI dots" | "Kernel.sh" | "Steel" | "Browser Use" | "Hyperbrowser" | "Notte" | "Cloudflare Browser Run")[];
    scoreMeaning: string;
};
export {};
