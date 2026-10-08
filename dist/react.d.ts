import type { Classification } from './index.js';
export type AgentFingerprintProps = {
    endpoint?: string;
    networkEndpoint?: string;
    onResult?: (result: Classification & {
        id?: string;
    }) => void;
    onError?: (error: Error) => void;
};
/** Headless collector. Mount once after any consent required by your app. */
export declare function AgentFingerprint({ endpoint, networkEndpoint, onResult, onError }: AgentFingerprintProps): null;
