export type Evidence = Record<string, any>;
export const origins = ['Browserbase', 'Grok bot', 'ChatGPT web', 'Real Browser', 'Real Chrome (via automation)', 'Instinct', 'Codex Browser', 'Claude', 'OpenAI dots', 'Kernel.sh', 'Steel', 'Browser Use', 'Hyperbrowser', 'Notte', 'Cloudflare Browser Run'] as const;
export type Origin = typeof origins[number];
type Reason = { signal: string; value: unknown; implication: string };
type Candidate = { origin: Origin; score: number; confidence: 'low' | 'medium'; basis: string; reasons: Reason[]; referenceCount?: number; matchedFamilies?: string[] };
export type Reference = { id: string; origin: Origin; evidence: Evidence };

export function signature(e: Evidence): Record<string, unknown> {
  return Object.fromEntries(Object.entries({
    canvas: e.r?.canvasHash,
    fonts: e.r?.fonts?.hash, audio: e.r?.audio?.sampleHash,
    renderer: e.r?.webgl?.unmaskedRenderer, math: e.r?.math?.strHash,
    platform: e.d?.platform, fontCount: e.r?.fonts?.count,
    voiceCount: Array.isArray(e.r?.speechVoices) ? e.r.speechVoices.length : undefined,
    webglAvailable: e.r?.webgl == null ? undefined : typeof e.r.webgl === 'object' && !!e.r.webgl.unmaskedRenderer,
  }).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

const familyWeights: Record<string, number> = {canvas:4,fonts:4,audio:2,renderer:2,math:.25,platform:.75,fontCount:.5,voiceCount:.5,webglAvailable:.5};
const anchors = new Set(['canvas','fonts','audio','renderer']);
function noisyProfile(e: Evidence) {
  const fonts=e.r?.fonts?.fonts;
  const metrics=e.r?.canvas?.metrics;
  const audio=e.r?.audio;
  const gl=e.r?.webgl;
  if(!Array.isArray(fonts) || fonts.length<8 || !metrics || !gl?.hash || !gl?.unmaskedRenderer || !Number.isFinite(audio?.sum) || !e.d?.platform || !e.r?.math?.strHash) return null;
  const parsed=fonts.map(font=>typeof font==='string' ? /^(.*):([\d.]+)x([\d.]+)$/.exec(font) : null);
  if(parsed.some(v=>!v)) return null;
  const perturbed=parsed.filter(v=>{const delta=Math.abs(Number(v![2])-Number(v![3]));return delta>=.001 && delta<=.025;}).length;
  const entries=Object.entries(metrics);
  if(perturbed<1 || entries.length<7 || entries.some(([,v])=>typeof v!=='number' || !Number.isFinite(v))) return null;
  const noisyMetrics=entries.filter(([,v])=>{const delta=Math.abs(Number(v)-Math.round(Number(v)));return delta>=.0005 && delta<=.01;}).length;
  if(noisyMetrics<3) return null;
  return JSON.stringify({platform:e.d.platform,renderer:gl.unmaskedRenderer,webgl:gl.hash,math:e.r.math.strHash,
    fonts:parsed.map(v=>[v![1],Math.round(Number(v![2])),Math.round(Number(v![3]))]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
    metrics:entries.map(([k,v])=>[k,Math.round(Number(v))]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
    audio:[audio.sampleRate,Math.round(audio.sum*10000)/10000]});
}
function iosProfile(e: Evidence) {
  if(e.d?.platform!=='iPhone' || !/iPhone.*AppleWebKit\//.test(String(e.d?.userAgent || '')) || e.d?.webdriver===true || e.b?.integrity?.webdriver===true) return null;
  const values=[e.r?.fonts?.hash,e.r?.fonts?.count,e.r?.webgl?.unmaskedRenderer,e.r?.math?.strHash,e.d?.screen?.width,e.d?.screen?.height,e.d?.screen?.colorDepth];
  if(values.some(v=>v===undefined || v===null) || values[2]!=='Apple GPU') return null;
  return JSON.stringify(values);
}
function fontMetricsMatch(a: Evidence, b: Evidence, cache: Map<Evidence, Map<string, number[]> | null>) {
  const parse=(e:Evidence)=>{
    if(cache.has(e)) return cache.get(e)!;
    const list=e.r?.fonts?.fonts;
    if(!Array.isArray(list) || list.length<8) return null;
    const entries=list.map(value=>typeof value==='string' ? /^(.*):([\d.]+)x([\d.]+)$/.exec(value) : null);
    if(entries.some(value=>!value || !Number.isFinite(Number(value[2])) || !Number.isFinite(Number(value[3])))) return null;
    const values=new Map(entries.map(value=>[value![1],[Number(value![2]),Number(value![3])]]));
    const result=values.size===list.length ? values : null;
    cache.set(e,result);return result;
  };
  const left=parse(a),right=parse(b);
  if(!left || !right || left.size!==right.size) return false;
  return [...left].every(([name,width])=>{
    const other=right.get(name);
    return !!other && Math.abs(width[0]-other[0])<=1 && Math.abs(width[1]-other[1])<=.25;
  });
}
function browserContext(e: Evidence) {
  const ua=String(e.d?.userAgent || '');
  const os=/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Macintosh/.test(ua)?'macOS':/Windows/.test(ua)?'Windows':/Linux/.test(ua)?'Linux':null;
  const engine=/Chrome\/|Chromium\/|CriOS\//.test(ua)?'Chromium':/Firefox\/|FxiOS\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':null;
  return {os,engine};
}
// This assesses the browser environment, not whether a human controls it.
function browserEnvironment(e: Evidence, automationScore: number) {
  const {os,engine}=browserContext(e);
  const platform=String(e.d?.platform || '');
  const renderer=String(e.r?.webgl?.unmaskedRenderer || '');
  const mobile=os==='iOS' || os==='Android';
  const blockers:string[]=[];
  const support:Reason[]=[];
  if(e.d?.webdriver!==false || e.b?.integrity?.webdriver===true) blockers.push('WebDriver state is missing or enabled');
  if(/HeadlessChrome/i.test(String(e.d?.userAgent || '')) || automationScore>=30) blockers.push('Automation indicators');
  const platformFits=os==='macOS' ? /Mac/.test(platform) : os==='Windows' ? /Win/.test(platform) : os==='iOS' ? /iPhone|iPad|Mac/.test(platform) : os==='Android' || os==='Linux' ? /Linux/.test(platform) : false;
  if(!engine || !platformFits) blockers.push('Unrecognised or inconsistent browser/platform identity');
  const hint=e.d?.clientHints?.platform;
  if(typeof hint==='string' && hint && hint!==os) blockers.push('Client hints disagree with browser OS');
  if(engine==='Firefox' && /WebKit/.test(String(e.r?.webgl?.renderer || ''))) blockers.push('Firefox identity with WebKit renderer');
  if(!renderer || /SwiftShader|llvmpipe|Mesa|software|Microsoft Basic Render/i.test(renderer)) blockers.push('Hardware rendering evidence missing or software renderer');
  if(os==='macOS' && !/Apple|AMD|ATI|Intel|NVIDIA/i.test(renderer)) blockers.push('Renderer inconsistent with macOS');
  const screen=e.d?.screen;
  if(!Number.isFinite(screen?.width) || !Number.isFinite(screen?.height) || screen.width<=0 || screen.height<=0 || !Number.isFinite(screen.colorDepth) || screen.colorDepth<16) blockers.push('Screen evidence missing');
  if(e.r?.canvas?.status!=='measured' || !e.r?.canvasHash || !e.r?.fonts?.hash || !Number.isFinite(e.r?.fonts?.count) || e.r.fonts.count<(mobile?5:15)) blockers.push('Rendering/font evidence incomplete or sparse');
  if(!blockers.length) {
    support.push({signal:'browser.identity',value:{os,engine,platform},implication:'Recognised browser with coherent platform and client hints'});
    support.push({signal:'browser.rendering',value:{renderer,fontCount:e.r.fonts.count},implication:'Measured canvas, installed fonts, hardware rendering and screen; exact hashes need no stored reference'});
    support.push({signal:'browser.automation',value:automationScore,implication:'WebDriver is explicitly disabled and no strong automation indicators were found; stealth automation can expose the same environment'});
  }
  return {assessment:blockers.length?'unknown':'consistent with a real browser',confidence:blockers.length?'unknown':'low',blockers,reasons:support};
}
export function referenceCandidates(e: Evidence, references: Reference[]): Candidate[] {
  // Local app labels describe the controller, not a distinct rendering environment.
  // Their identity comes from explicit UA/runtime signals instead of device references.
  const context=browserContext(e);
  references=references.filter(ref=>{
    if(ref.origin==='Codex Browser' || ref.origin==='Claude') return false;
    if(ref.origin!=='Real Browser') return true;
    if(e.d?.webdriver===true || e.b?.integrity?.webdriver===true) return false;
    const other=browserContext(ref.evidence);
    return !(context.os && other.os && context.os!==other.os) && !(context.engine && other.engine && context.engine!==other.engine);
  });
  const incoming=signature(e);
  const fontCache=new Map<Evidence, Map<string, number[]> | null>();
  const profiles=references.map(ref=>({...ref,features:signature(ref.evidence)}));
  const matches=(key:string,value:unknown,other:typeof profiles[number],ref:typeof profiles[number])=>other.features[key]===value || (key==='fonts' && typeof value==='string' && typeof other.features.fonts==='string' && fontMetricsMatch(other.evidence,ref.evidence,fontCache));
  const best=new Map<Origin,Candidate>();
  for(const ref of profiles) {
    const compared=Object.entries(ref.features).filter(([key])=>key in incoming);
    const matched=compared.filter(([key,value])=>incoming[key]===value || (key==='fonts' && typeof value==='string' && typeof incoming.fonts==='string' && fontMetricsMatch(e,ref.evidence,fontCache)));
    const matchedAnchors=matched.filter(([key])=>anchors.has(key)).map(([key])=>key);
    if(matchedAnchors.length<2 || !matchedAnchors.some(key=>key==='canvas'||key==='fonts')) continue;
    const weight=(key:string,value:unknown)=>{
      const sharingOrigins=new Set(profiles.filter(p=>matches(key,value,p,ref)).map(p=>p.origin)).size;
      return (familyWeights[key] || 0)/Math.max(1,sharingOrigins);
    };
    const total=compared.reduce((sum,[key,value])=>sum+weight(key,value),0);
    const support=matched.reduce((sum,[key,value])=>sum+weight(key,value),0);
    const score=total ? Math.round(support/total*100) : 0;
    if(score<50) continue;
    const count=profiles.filter(p=>p.origin===ref.origin && Object.entries(ref.features).every(([key,value])=>matches(key,value,p,ref))).length;
    const candidate:Candidate={origin:ref.origin,score,confidence:count>=2?'medium':'low',referenceCount:count,matchedFamilies:matchedAnchors,
      basis:`Matches labelled capture ${ref.id}; weighted similarity, not verified provider identity`,
      reasons:matched.map(([signal,value])=>({signal,value,implication:`Matches a labelled ${ref.origin} sample${signal==='fonts' && incoming.fonts!==value ? ' within 0.25 CSS pixels; tolerates zoom/DPR rounding' : ''}`})),
    };
    const previous=best.get(ref.origin);
    if(!previous || score>previous.score || (score===previous.score && count>(previous.referenceCount || 0))) best.set(ref.origin,candidate);
  }
  const profile=iosProfile(e);
  const iosReferences=profile ? references.filter(ref=>ref.origin==='Real Browser' && iosProfile(ref.evidence)===profile) : [];
  if(iosReferences.length>=2 && (best.get('Real Browser')?.score || 0)<85) {
    best.set('Real Browser',{origin:'Real Browser',score:85,confidence:'medium',referenceCount:iosReferences.length,
      matchedFamilies:['fonts','renderer'],basis:'Repeated labelled iOS environment match; canvas/audio and speech voices may vary; not a person identifier',
      reasons:[{signal:'ios.environment',value:iosReferences.map(ref=>ref.id),implication:'Matches screen, fonts, Apple GPU and math in at least two labelled Real Browser captures'}]});
  }
  const noisy=noisyProfile(e);
  if(noisy) for(const origin of origins) {
    const refs=references.filter(ref=>ref.origin===origin && noisyProfile(ref.evidence)===noisy);
    const varying=['canvasHash','fonts','audio'].every(key=>new Set(refs.map(ref=>key==='canvasHash' ? ref.evidence.r?.canvasHash : key==='fonts' ? ref.evidence.r?.fonts?.hash : ref.evidence.r?.audio?.sampleHash).filter(Boolean)).size>=3);
    if(refs.length>=3 && varying && (best.get(origin)?.score || 0)<85) best.set(origin,{origin,score:85,confidence:'low',referenceCount:refs.length,
      matchedFamilies:['font metrics','canvas metrics','audio summary','WebGL'],basis:'Repeated labelled profile with small measurement perturbations; approximate environment match, not verified provider identity',
      reasons:[{signal:'rendering.perturbedProfile',value:refs.map(ref=>ref.id),implication:'Rounded font/canvas measurements, audio summary, platform and WebGL match multiple references whose exact hashes vary'}]});
  }
  return [...best.values()].sort((a,b)=>b.score-a.score);
}

export function detect(e: Evidence, observedUserAgent: string, references: Reference[] = []) {
  const reasons: Reason[] = [];
  let automationScore = 0;
  const add = (signal: string, value: unknown, implication: string, weight: number) => {
    reasons.push({ signal, value, implication }); automationScore += weight;
  };
  const ua = String(e.d?.userAgent || '');
  const webdriver = e.d?.webdriver === true || e.b?.integrity?.webdriver === true;
  if (webdriver) add('webdriver', true, 'Browser declares WebDriver automation', 70);
  if (/HeadlessChrome/i.test(`${ua} ${observedUserAgent}`)) add('userAgent', observedUserAgent || ua, 'Headless Chrome identity', 60);
  const fontCount = e.r?.fonts?.count;
  if (typeof fontCount === 'number' && fontCount <= 8) add('fonts.count', fontCount, 'Sparse font environment', 12);
  if (Array.isArray(e.r?.speechVoices) && !e.r.speechVoices.length) add('speechVoices', [], 'No speech voices exposed', 8);
  const delta = e.b?.integrity?.windowDelta;
  if (Array.isArray(delta) && delta.length === 2 && delta.every(v => v === 0)) add('windowDelta', delta, 'No browser chrome dimensions exposed', 12);
  if (Array.isArray(e.d?.mediaDevices) && !e.d.mediaDevices.length) add('mediaDevices', [], 'No media devices exposed', 8);
  if (e.r?.webgl === 'unavailable' || e.r?.webgl === null) add('webgl', e.r.webgl, 'WebGL unavailable; may also reflect browser policy', 8);
  const claimedMac = /Macintosh/.test(ua) || e.d?.platform === 'MacIntel';
  const renderer = String(e.r?.webgl?.unmaskedRenderer || '');
  if (claimedMac && /Mesa|llvmpipe/i.test(renderer)) add('webgl.unmaskedRenderer', renderer, 'Linux-associated rendering stack with a macOS identity', 25);
  const uaOS = /Macintosh/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : null;
  const hintOS = e.d?.clientHints?.platform;
  if (uaOS && typeof hintOS === 'string' && hintOS !== uaOS && hintOS !== 'Android') add('clientHints.platform', hintOS, `Client hints disagree with ${uaOS} user agent`, 25);
  automationScore = Math.min(100, automationScore);
  const candidates: Candidate[] = [];
  const claims: [Origin, RegExp][] = [
    ['Browserbase', /\bBrowserbase\b/i], ['Grok bot', /\bGrok(?:Bot|[- ]bot)?\b/i],
    ['ChatGPT web', /ChatGPT-User|\bChatGPT\b/i], ['Instinct', /\bInstinct\b/i],
    ['Codex Browser', /\bCodexBrowser\b/i],
    ['Claude', /\bClaude(?:(?:-User|-Web|Bot)\b|\/\d+(?:\.\d+)*\b)/i],
    ['OpenAI dots', /\b(?:OpenAI[- ]?Dots|DotsBrowser)\b/i],
    ['Kernel.sh', /\b(?:KernelBrowser|Kernel\.sh)\b/i],
  ];
  for (const [origin, pattern] of claims) {
    if (pattern.test(observedUserAgent)) candidates.push({ origin, score: 80, confidence: 'medium', basis: 'Unverified HTTP user-agent claim', reasons: [{signal:'http.user-agent',value:observedUserAgent,implication:'Self-identifies the provider; header can be spoofed'}] });
  }
  const runtimeHint = e.b?.integrity?.codexAnnotationRoot === true;
  if (runtimeHint) candidates.push({origin:'Codex Browser',score:80,confidence:'medium',basis:'Unverified browser annotation runtime',reasons:[{signal:'integrity.codexAnnotationRoot',value:true,implication:'Codex annotation DOM found; identifies browser integration, not agent activity, and can be imitated'}]});
  const referenceMatches=referenceCandidates(e,references);
  candidates.push(...referenceMatches);
  if (webdriver && /Chrome\//.test(ua) && !/HeadlessChrome/.test(ua)) candidates.push({origin:'Real Chrome (via automation)',score:60,confidence:'low',basis:'Chrome identity with declared automation; provider unknown',reasons:reasons.filter(r=>r.signal==='webdriver')});
  candidates.sort((a,b)=>b.score-a.score);
  const unique = candidates.filter((c,i)=>candidates.findIndex(x=>x.origin===c.origin)===i);
  // Generic automation and unverified declarations cannot establish a provider.
  const referenceWinner = referenceMatches[0]?.score>=75 ? referenceMatches[0] : undefined;
  const margin = referenceWinner && referenceMatches[1] ? referenceWinner.score-referenceMatches[1].score : null;
  const ambiguous = margin !== null && margin<12;
  const declared = candidates.filter(c=>c.basis==='Unverified HTTP user-agent claim' || c.basis==='Unverified browser annotation runtime').filter((c,i,list)=>list.findIndex(other=>other.origin===c.origin)===i);
  const claim = declared.length===1 ? declared[0] : null;
  const matched = referenceWinner && !ambiguous && declared.length<=1 && (!claim || claim.origin===referenceWinner.origin) ? referenceWinner : null;
  const browser=browserEnvironment(e,automationScore);
  // Provider evidence and ambiguous reference matches take precedence over this fallback.
  const genericReal=!declared.length && !referenceWinner && !referenceMatches.some(c=>c.origin!=='Real Browser') && browser.assessment==='consistent with a real browser';
  const fallback:Candidate | null=genericReal ? {origin:'Real Browser',score:65,confidence:'low',basis:'General browser environment',reasons:browser.reasons} : null;
  if(fallback && !unique.some(c=>c.origin==='Real Browser')) unique.push(fallback);
  const identity = declared.length>1 ? null : claim || matched || fallback;
  return {
    detectorVersion: 11,
    suspectedIdentity: identity?.origin || 'Unknown',
    identityBasis: claim ? claim.basis==='Unverified browser annotation runtime' ? 'Browser annotation runtime' : 'User-agent claim' : matched ? 'Reference match' : fallback ? 'General browser environment' : 'Insufficient evidence',
    probableOrigin: matched?.origin || 'Unknown',
    confidence: matched?.confidence || fallback?.confidence || 'unknown',
    browser,
    referenceMargin: margin,
    referenceSamples: references.length,
    automation: { score: automationScore, assessment: automationScore >= 60 ? 'likely automated' : automationScore >= 30 ? 'possibly automated' : 'insufficient evidence', reasons },
    candidates: unique,
    unrecognisedOrigins: origins.filter(origin=>!unique.some(c=>c.origin===origin)),
    scoreMeaning: 'Heuristic evidence strength, not a calibrated probability. Browser infrastructure and controlling agent may differ.',
  };
}
