import { collectDevice, fonts, mathProbes, timingSignals, cssEnvironment, connection, integrity } from './probes.js';
export type Signal = { group: string; name: string; value: unknown; status: 'measured' | 'unavailable' | 'error'; source: string };
export type Report = { capturedAt: string; version: number; signals: Signal[]; digest: string; duration: number };
export function fingerprintInput(signals: Signal[]) {
  const canonical = (value: any): any => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    }
    return value;
  };
  return JSON.stringify(signals
    .filter(s => s.group === 'Rendering' || (s.group === 'Device' && !['battery', 'mediaDevices', 'viewport'].some(key => s.name.includes(key))))
    .map(s => [s.group, s.name, canonical(s.value)])
    .sort((a, b) => {
      const left = `${a[0]}.${a[1]}`, right = `${b[0]}.${b[1]}`;
      return left < right ? -1 : left > right ? 1 : 0;
    }));
}
export function compactReport(report: Report) {
  const groups: Record<string, string> = { Device: 'd', Rendering: 'r', Browser: 'b', Network: 'n' };
  const data: Record<string, any> = {};
  const errors: Record<string, string> = {};
  for (const signal of report.signals) {
    const group = groups[signal.group] || signal.group;
    const path = signal.name.split('.');
    let target = data[group] ||= {};
    for (const key of path.slice(0, -1)) target = target[key] ||= {};
    target[path[path.length - 1]] = signal.status === 'error' ? null : signal.value;
    if (signal.status === 'error') errors[`${group}.${signal.name}`] = String(signal.value);
  }
  return { v: report.version, t: report.capturedAt, h: report.digest, ms: report.duration, ...data,
    ...(Object.keys(errors).length ? { e: errors } : {}) };
}
export async function collect(options: { networkEndpoint?: string; signal?: AbortSignal } = {}): Promise<Report> {
  if (typeof window === 'undefined') throw new Error('collect() requires a browser');
  options.signal?.throwIfAborted();
  const started = performance.now();
  const signals: Signal[] = [];
  const add = (group: string, name: string, value: unknown, source = 'Browser API') => signals.push({ group, name, value: value ?? null, status: value == null ? 'unavailable' : 'measured', source });
  const flatten = (group: string, obj: any, prefix = '') => {
    Object.entries(obj || {}).forEach(([key, value]) => {
      const name = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) flatten(group, value, name);
      else add(group, name, value);
    });
  };
  const run = async (group: string, name: string, fn: () => any, source?: string) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { const result = await Promise.race([Promise.resolve().then(fn), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out after 4 seconds')), 4000); })]); add(group, name, result, source); }
    catch (error) { signals.push({ group, name, value: error instanceof Error ? error.message : String(error), status: 'error', source: source || 'Browser API' }); }
    finally { clearTimeout(timer); }
  };
  const d = collectDevice();
  const {canvas, canvasHash, webgl, ...device} = d;
  flatten('Device', device);
  flatten('Rendering', {canvasHash, canvas, webgl, fonts: fonts(), math: mathProbes()});
  flatten('Browser', {integrity: integrity(), css: cssEnvironment(), connection: connection(), timing: timingSignals()});
  add('Browser', 'secureContext', isSecureContext);
  add('Browser', 'crossOriginIsolated', crossOriginIsolated);
  add('Browser', 'doNotTrack', navigator.doNotTrack);
  add('Browser', 'globalPrivacyControl', (navigator as any).globalPrivacyControl);
  add('Browser', 'pdfViewerEnabled', navigator.pdfViewerEnabled);
  await Promise.all([
    run('Network', 'edge', async () => { if (!options.networkEndpoint) return null; const r = await fetch(options.networkEndpoint, {cache:'no-store', signal:options.signal}); if(!r.ok) throw new Error(`Network endpoint: ${r.status}`); return r.json(); }, 'Server observed'),
    run('Device', 'clientHints', () => (navigator as any).userAgentData?.getHighEntropyValues(['architecture','bitness','model','platform','platformVersion','uaFullVersion','fullVersionList','wow64'])),
    run('Browser', 'storageEstimate', () => navigator.storage?.estimate()),
    run('Device', 'battery', async () => { if(!(navigator as any).getBattery) return null; const b = await (navigator as any).getBattery(); return {charging:b.charging,level:b.level,chargingTime:String(b.chargingTime),dischargingTime:String(b.dischargingTime)}; }),
    run('Browser', 'permissions', async () => { if(!navigator.permissions) return null; return Object.fromEntries(await Promise.all(['geolocation','notifications','camera','microphone','clipboard-read','persistent-storage'].map(async name => { try {return [name,(await navigator.permissions.query({name:name as PermissionName})).state];} catch {return [name,'unsupported query'];} }))); }),
    run('Device', 'mediaDevices', async () => navigator.mediaDevices ? (await navigator.mediaDevices.enumerateDevices()).map(d => ({kind:d.kind,label:d.label || 'Permission required',deviceId:d.deviceId,groupId:d.groupId})) : null),
    run('Rendering', 'audio', async () => { const C = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext; if(!C) return null; const c = new C(1,44100,44100); const o = c.createOscillator(); const compressor = c.createDynamicsCompressor(); o.type='triangle'; o.frequency.value=10000; compressor.threshold.value=-50; compressor.knee.value=40; compressor.ratio.value=12; compressor.attack.value=0; compressor.release.value=.25; o.connect(compressor); compressor.connect(c.destination); o.start(); const buffer = await c.startRendering(); const samples = buffer.getChannelData(0); return {sampleRate:buffer.sampleRate,sum:Array.from(samples.slice(4500,5000)).reduce((a:number,b:any)=>a+Math.abs(b),0),sampleHash:await sha(new Uint8Array(samples.buffer))}; }),
    run('Network', 'webrtc', () => new Promise(resolve => { if(!window.RTCPeerConnection) return resolve(null); const p = new RTCPeerConnection({iceServers:[]}); const candidates: string[]=[]; let ended=false; const finish = (status:string) => {if(ended)return;ended=true;clearTimeout(timer);p.close();resolve({status,candidates,stun:'Not used; host candidates only'});}; const timer=setTimeout(()=>finish('gathering timeout'),1800); p.onicecandidate=e=>{if(e.candidate)candidates.push(e.candidate.candidate);else finish('complete');}; p.createDataChannel('probe'); p.createOffer().then(o=>p.setLocalDescription(o)).catch(()=>finish('blocked')); })),
    run('Rendering', 'speechVoices', () => new Promise(resolve => { if(!window.speechSynthesis)return resolve(null); const read=()=>speechSynthesis.getVoices().map(v=>({name:v.name,lang:v.lang,local:v.localService})); const first=read(); if(first.length)return resolve(first); const done=()=>{clearTimeout(timer);speechSynthesis.removeEventListener('voiceschanged',done);resolve(read());};const timer=setTimeout(done,800);speechSynthesis.addEventListener('voiceschanged',done); })),
  ]);
  options.signal?.throwIfAborted();
  return {version:2,capturedAt:new Date().toISOString(),signals,digest:await sha(new TextEncoder().encode(fingerprintInput(signals))),duration:Math.round(performance.now()-started)};
}
async function sha(bytes: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))).map(b=>b.toString(16).padStart(2,'0')).join(''); }
