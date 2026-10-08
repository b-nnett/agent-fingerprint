import { detect, type Evidence, type Reference } from './detector.js';
import profiles from './references.json';
export { origins, signature, referenceCandidates, detect } from './detector.js';
export type { Evidence, Origin, Reference } from './detector.js';
export const referenceProfiles = profiles as Reference[];
export function classify(evidence: Evidence, options: { userAgent?: string; references?: Reference[] } = {}) {
  return detect(evidence, options.userAgent || '', options.references ?? referenceProfiles);
}
export type Classification = ReturnType<typeof classify>;
