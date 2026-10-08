'use client';
import { useEffect, useRef } from 'react';
import { collect, compactReport } from './client.js';
import type { Classification } from './index.js';
export type AgentFingerprintProps = {
  endpoint?: string;
  networkEndpoint?: string;
  onResult?: (result: Classification & { id?: string }) => void;
  onError?: (error: Error) => void;
};
/** Headless collector. Mount once after any consent required by your app. */
export function AgentFingerprint({endpoint='/api/agent',networkEndpoint,onResult,onError}:AgentFingerprintProps) {
  const callbacks=useRef({onResult,onError});callbacks.current={onResult,onError};
  useEffect(()=>{
    const controller=new AbortController();
    void (async()=>{
      try {
        const evidence=compactReport(await collect({networkEndpoint,signal:controller.signal}));
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evidence),signal:controller.signal});
        if(!response.ok) throw new Error(`Agent classification failed (${response.status})`);
        const result=await response.json();
        if(!controller.signal.aborted) callbacks.current.onResult?.(result);
      }catch(error){if(!controller.signal.aborted) callbacks.current.onError?.(error instanceof Error ? error : new Error(String(error)));}
    })();
    return ()=>controller.abort();
  },[endpoint,networkEndpoint]);
  return null;
}
