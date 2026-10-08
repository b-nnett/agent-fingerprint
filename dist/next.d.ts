import { type Classification, type Evidence, type Reference } from './index.js';
export type Capture = {
    evidence: Evidence;
    classification: Classification;
    request: Request;
};
export type RouteOptions = {
    references?: Reference[] | (() => Reference[] | Promise<Reference[]>);
    onCapture?: (capture: Capture) => void | {
        id: string;
    } | Promise<void | {
        id: string;
    }>;
    maxBodyBytes?: number;
};
export declare function createAgentRoute(options?: RouteOptions): (request: Request) => Promise<Response>;
