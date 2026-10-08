import { classify, type Classification, type Evidence, type Reference } from './index.js';
export type Capture = { evidence: Evidence; classification: Classification; request: Request };
export type RouteOptions = {
  references?: Reference[] | (() => Reference[] | Promise<Reference[]>);
  onCapture?: (capture: Capture) => void | { id: string } | Promise<void | { id: string }>;
  maxBodyBytes?: number;
};
export function createAgentRoute(options: RouteOptions = {}) {
  const maxBytes = options.maxBodyBytes ?? 262144;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('Invalid maxBodyBytes');
  const json = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
  return async function POST(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({error:'Method not allowed'},405);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({error:'JSON required'},415);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({error:'Cross-origin request rejected'},403);
    if (!request.body) return json({error:'Body required'},400);
    const reader=request.body.getReader();
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>maxBytes){await reader.cancel();return json({error:'Body too large'},413);}chunks.push(next.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let evidence:Evidence;
    try {
      evidence=JSON.parse(new TextDecoder().decode(bytes));
      const object=(v:unknown)=>!!v && typeof v==='object' && !Array.isArray(v);
      if(!object(evidence) || !Number.isInteger(evidence.v) || evidence.v<1 || typeof evidence.h!=='string' || !/^[a-f0-9]{64}$/.test(evidence.h) || !['d','r','b','n'].every(k=>object(evidence[k]))) throw new Error('Invalid report');
    }catch{return json({error:'Invalid evidence report'},400);}
    let references:Reference[]|undefined;
    try { references=typeof options.references==='function' ? await options.references() : options.references; }
    catch {return json({error:'Reference lookup failed'},503);}
    let classification:Classification;
    try {classification=classify(evidence,{userAgent:request.headers.get('user-agent') || '',references});}
    catch{return json({error:'Invalid evidence report'},400);}
    try {
      const saved=await options.onCapture?.({evidence,classification,request});
      return json({...classification,...(saved ? {id:saved.id} : {})});
    } catch {return json({error:'Capture could not be saved'},503);}
  };
}
