import { type Evidence, type Reference } from './detector.js';
export { origins, signature, referenceCandidates, detect } from './detector.js';
export type { Evidence, Origin, Reference } from './detector.js';
export declare const referenceProfiles: Reference[];
export declare function classify(evidence: Evidence, options?: {
    userAgent?: string;
    references?: Reference[];
}): {
    detectorVersion: number;
    suspectedIdentity: string;
    identityBasis: string;
    probableOrigin: string;
    confidence: string;
    browser: {
        assessment: string;
        confidence: string;
        blockers: string[];
        reasons: {
            signal: string;
            value: unknown;
            implication: string;
        }[];
    };
    referenceMargin: number | null;
    referenceSamples: number;
    automation: {
        score: number;
        assessment: string;
        reasons: {
            signal: string;
            value: unknown;
            implication: string;
        }[];
    };
    candidates: {
        origin: import("./detector.js").Origin;
        score: number;
        confidence: "low" | "medium";
        basis: string;
        reasons: {
            signal: string;
            value: unknown;
            implication: string;
        }[];
        referenceCount?: number;
        matchedFamilies?: string[];
    }[];
    unrecognisedOrigins: ("Browserbase" | "Grok bot" | "ChatGPT web" | "Real Browser" | "Real Chrome (via automation)" | "Instinct" | "Codex Browser" | "Claude" | "OpenAI dots" | "Kernel.sh" | "Steel" | "Browser Use" | "Hyperbrowser" | "Notte" | "Cloudflare Browser Run")[];
    scoreMeaning: string;
};
export type Classification = ReturnType<typeof classify>;
