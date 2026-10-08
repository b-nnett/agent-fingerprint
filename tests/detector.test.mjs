import test from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../dist/index.js';
const sample = { d:{userAgent:'Mozilla/5.0 (Macintosh) Chrome/154.0.0.0',platform:'MacIntel',webdriver:false,mediaDevices:[]},r:{fonts:{count:7,hash:'5ae7a33e'},canvasHash:'3818d2f6',canvas:{samples:{text:{hash:'0fa6be4f'}}},speechVoices:[],webgl:'unavailable'},b:{integrity:{windowDelta:[0,0]}} };
test('CodexBrowser is a declared suspected identity, not verified attribution',()=>{
  const result=detect({},'CodexBrowser Mozilla/5.0 Chrome/154');
  assert.equal(result.suspectedIdentity,'Codex Browser');
  assert.equal(result.identityBasis,'User-agent claim');
  assert.equal(result.probableOrigin,'Unknown');
  assert.equal(detect({},'Chrome/154').suspectedIdentity,'Unknown');
  assert.equal(detect({},'CodexBrowser Browserbase').suspectedIdentity,'Unknown');
});
test('unlabelled rendering and sparse APIs stay Unknown',()=>{
  const result=detect(sample,'Chrome/154');
  assert.equal(result.probableOrigin,'Unknown');
  assert.equal(result.candidates.length,0);
  assert.equal(result.automation.assessment,'possibly automated');
});
test('canvas variants are one signal family, not independent votes',()=>{
  const onlyCanvas={r:{canvasHash:'same',canvas:{samples:{text:{hash:'same-text'}}}}};
  assert.equal(detect(onlyCanvas,'',[{id:'a',origin:'Instinct',evidence:onlyCanvas}]).probableOrigin,'Unknown');
});
test('common audio and math cannot identify an origin',()=>{
  const common={r:{audio:{sampleHash:'common'},math:{strHash:'common'}}};
  assert.equal(detect(common,'',[{id:'a',origin:'Instinct',evidence:common},{id:'b',origin:'Grok bot',evidence:common}]).probableOrigin,'Unknown');
});
test('missing ancillary probes do not prevent a strong canvas and font match',()=>{
  const reference={...sample,r:{...sample.r,audio:{sampleHash:'reference-audio'},webgl:{unmaskedRenderer:'reference-renderer'}}};
  assert.equal(detect(sample,'',[{id:'a',origin:'ChatGPT web',evidence:reference}]).probableOrigin,'ChatGPT web');
});
test('a Real Browser profile does not override a CodexBrowser declaration',()=>{
  const result=detect(sample,'CodexBrowser Chrome/154',[{id:'a',origin:'Real Browser',evidence:sample}]);
  assert.equal(result.suspectedIdentity,'Codex Browser'); assert.equal(result.probableOrigin,'Unknown');
});
test('standard PDF plugin names do not attribute Edge or automation',()=>{
  const result=detect({d:{plugins:['Microsoft Edge PDF Viewer']}},'Chrome/154');
  assert.equal(result.probableOrigin,'Unknown'); assert.equal(result.automation.score,0);
});
test('provider claims are candidates rather than verified attribution',()=>{
  assert.equal(detect(sample,'Browserbase').probableOrigin,'Unknown');
});
test('labelled matching capture enables probable attribution',()=>{
  assert.equal(detect(sample,'Chrome/154',[{id:'known',origin:'ChatGPT web',evidence:sample}]).probableOrigin,'ChatGPT web');
});
test('shared signatures across providers stay Unknown',()=>{
  assert.equal(detect(sample,'Chrome/154',[{id:'a',origin:'ChatGPT web',evidence:sample},{id:'b',origin:'Browserbase',evidence:sample}]).probableOrigin,'Unknown');
});
test('contradictory rendering value rejects a reference',()=>{
  const changed=structuredClone(sample); changed.r.fonts.hash='different';
  assert.equal(detect(changed,'Chrome/154',[{id:'a',origin:'ChatGPT web',evidence:sample}]).probableOrigin,'Unknown');
});
test('webdriver indicates automation without proving a provider',()=>{
  const result=detect({d:{webdriver:true,userAgent:'Chrome/154'}},'Chrome/154');
  assert.equal(result.probableOrigin,'Unknown'); assert.equal(result.automation.assessment,'likely automated');
  assert.equal(result.candidates[0].origin,'Real Chrome (via automation)');
});

const ios={d:{platform:'iPhone',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',screen:{width:414,height:896,colorDepth:24}},r:{fonts:{hash:'ios-fonts',count:30},webgl:{unmaskedRenderer:'Apple GPU'},math:{strHash:'ios-math'},canvasHash:'first',audio:{sampleHash:'first'},speechVoices:[]}};
const iosRefs=[{id:'ios-one',origin:'Real Browser',evidence:ios},{id:'ios-two',origin:'Real Browser',evidence:{...ios,r:{...ios.r,canvasHash:'second',audio:{sampleHash:'second'}}}}];
test('repeated labelled iOS profiles tolerate changing canvas/audio and voices',()=>{
  const incoming={...ios,r:{...ios.r,canvasHash:'third',audio:{sampleHash:'third'},speechVoices:[{name:'Daniel'}]}};
  assert.equal(detect(incoming,'',iosRefs).suspectedIdentity,'Real Browser');
  assert.equal(detect(incoming,'',iosRefs.slice(0,1)).suspectedIdentity,'Unknown');
  assert.equal(detect({...incoming,d:{...incoming.d,screen:{width:402,height:874,colorDepth:24}}},'',iosRefs).suspectedIdentity,'Unknown');
  assert.equal(detect({...incoming,d:{...incoming.d,webdriver:true}},'',iosRefs).suspectedIdentity,'Unknown');
  assert.equal(detect(incoming,'CodexBrowser',iosRefs).suspectedIdentity,'Codex Browser');
});

test('Steel canvas and fonts can match despite a different session GPU',()=>{
  const steel={d:{platform:'Linux x86_64'},r:{canvasHash:'2d1d1313',fonts:{hash:'9c9cac95',count:17},audio:{sampleHash:'shared-audio'},webgl:{unmaskedRenderer:'GPU A'},math:{strHash:'f0645a90'},speechVoices:[]}};
  const refs=[{id:'steel-reference',origin:'Steel',evidence:steel}];
  const result=detect({...steel,r:{...steel.r,webgl:{unmaskedRenderer:'GPU B'}}},'',refs);
  assert.equal(result.suspectedIdentity,'Steel');
  assert.equal(detect({...steel,r:{...steel.r,canvasHash:'different',fonts:{hash:'different',count:17}}},'',refs).suspectedIdentity,'Unknown');
});

test('perturbed profiles need repeated independent hash changes and stay cautious',()=>{
  const profile=(id)=>({d:{platform:'Win32'},r:{canvasHash:'canvas-'+id,fonts:{hash:'font-'+id,fonts:Array.from({length:8},(_,i)=>`Font ${i}:${100+i}x${100+i}.01`)},audio:{sampleRate:44100,sum:124.043476,sampleHash:'audio-'+id},math:{strHash:'math'},webgl:{hash:'gl',unmaskedRenderer:'RTX'},canvas:{metrics:{width:253.003,left:0,right:253.001,ascent:12.999,descent:4.003,fontAscent:16.996,fontDescent:4.005}}}});
  const refs=[0,1,2].map(i=>({id:'ref-'+i,origin:'Notte',evidence:profile(i)}));
  const incoming=profile(3);
  incoming.r.fonts.fonts=incoming.r.fonts.fonts.map((font,i)=>i<3 ? font : font.replace('.01','.00'));
  const result=detect(incoming,'',refs);
  assert.equal(result.suspectedIdentity,'Notte');
  assert.equal(result.confidence,'low');
  assert.equal(detect(incoming,'',refs.slice(0,2)).suspectedIdentity,'Unknown');
  assert.equal(detect({...incoming,r:{...incoming.r,webgl:{hash:'different',unmaskedRenderer:'RTX'}}},'',refs).suspectedIdentity,'Unknown');
  assert.equal(detect({...incoming,r:{...incoming.r,audio:{...incoming.r.audio,sum:125}}},'',refs).suspectedIdentity,'Unknown');
  assert.equal(detect({...incoming,r:{...incoming.r,canvas:{metrics:{width:253,left:0,right:253,ascent:13,descent:4,fontAscent:17,fontDescent:4}}}},'',refs).suspectedIdentity,'Unknown');
  const competing=refs.map(r=>({...r,id:r.id+'-other',origin:'Steel'}));
  assert.equal(detect(incoming,'',[...refs,...competing]).suspectedIdentity,'Unknown');
});

const metricSample=(delta=0,rename=false)=>({d:{platform:'MacIntel'},r:{canvasHash:'canvas-anchor',fonts:{hash:`fonts-${delta}-${rename}`,count:8,fonts:Array.from({length:8},(_,i)=>`${rename&&i===0?'Different':`Font${i}`}:${Math.round(800.49+i+delta)}x${(800.49+i+delta).toFixed(2)}`)},audio:{sampleHash:'audio-anchor'},webgl:{unmaskedRenderer:'gpu-anchor'}}});
test('subpixel font drift across zoom/DPR retains the independent font anchor',()=>{
 const reference={id:'zoom-reference',origin:'Real Browser',evidence:metricSample()};
 const result=detect(metricSample(.08),'',[reference]);
 assert.equal(result.probableOrigin,'Real Browser');assert.ok(result.candidates[0].matchedFamilies.includes('fonts'));
});
test('font tolerance rejects different metrics or font sets',()=>{
 const reference={id:'zoom-reference',origin:'Real Browser',evidence:metricSample()};
 for(const evidence of [metricSample(.5),metricSample(.08,true)]) {
   const result=detect(evidence,'',[reference]);assert.equal(result.probableOrigin,'Unknown');assert.ok(!result.candidates[0]?.matchedFamilies.includes('fonts'));
 }
});
test('subpixel font matching across competing providers remains ambiguous',()=>{
 assert.equal(detect(metricSample(.08),'',[{id:'a',origin:'Real Browser',evidence:metricSample()},{id:'b',origin:'Instinct',evidence:metricSample(.1)}]).probableOrigin,'Unknown');
});

test('Codex annotation runtime is a browser hint, not verified provider attribution',()=>{
  const e={b:{integrity:{codexAnnotationRoot:true}}};
  const result=detect(e,'Chrome/154');
  assert.equal(result.suspectedIdentity,'Codex Browser');
  assert.equal(result.identityBasis,'Browser annotation runtime');
  assert.equal(result.probableOrigin,'Unknown');
  assert.equal(result.automation.assessment,'insufficient evidence');
  assert.equal(detect(e,'CodexBrowser Chrome/154').suspectedIdentity,'Codex Browser');
  assert.equal(detect(e,'Browserbase Chrome/154').suspectedIdentity,'Unknown');
  assert.equal(detect({b:{integrity:{codexAnnotationRoot:'true'}}},'').suspectedIdentity,'Unknown');
});

test('Claude desktop version token is a declared identity despite shared rendering',()=>{
  const ua='Mozilla/5.0 (Macintosh) Claude/2.19675.1 Chrome/152.0.7977.130 Safari/537.36';
  const result=detect(sample,ua,[{id:'real',origin:'Real Browser',evidence:sample}]);
  assert.equal(result.suspectedIdentity,'Claude');
  assert.equal(result.identityBasis,'User-agent claim');
  assert.equal(result.probableOrigin,'Unknown');
  for(const token of ['Claude-User','Claude-Web','ClaudeBot','Claude/3.0']) assert.equal(detect({},token).suspectedIdentity,'Claude');
  for(const token of ['Claude','Claude/not-a-version','NotClaude/2.0']) assert.equal(detect({},token).suspectedIdentity,'Unknown');
  assert.equal(detect({},ua+' CodexBrowser').suspectedIdentity,'Unknown');
});

test('local controller labels do not turn a known real device into ambiguous app attribution',()=>{
  const refs=['Real Browser','Claude','Codex Browser'].map((origin,i)=>({id:String(i),origin,evidence:sample}));
  assert.equal(detect(sample,'Chrome/154',refs).suspectedIdentity,'Real Browser');
  assert.equal(detect(sample,'Claude/2.0 Chrome/154',refs).suspectedIdentity,'Claude');
  assert.equal(detect({...sample,b:{integrity:{codexAnnotationRoot:true}}},'Chrome/154',refs).suspectedIdentity,'Codex Browser');
  assert.equal(detect(sample,'',refs.slice(1)).suspectedIdentity,'Unknown');
  const android={...sample,d:{...sample.d,userAgent:'Mozilla/5.0 (Linux; Android 14) Chrome/152 Mobile Safari/537.36'}};
  assert.equal(detect(android,'',refs).suspectedIdentity,'Unknown');
  const safari={...sample,d:{...sample.d,userAgent:'Mozilla/5.0 (Macintosh) Version/27.0 Safari/605.1.15'}};
  assert.equal(detect(safari,'',refs).suspectedIdentity,'Unknown');
  assert.equal(detect({...sample,d:{...sample.d,webdriver:true}},'Chrome/154',refs).probableOrigin,'Unknown');
});

const unseenDesktop=()=>({d:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/27.0 Safari/605.1.15',platform:'MacIntel',webdriver:false,screen:{width:1512,height:982,colorDepth:24}},r:{canvasHash:crypto.randomUUID(),canvas:{status:'measured'},fonts:{hash:crypto.randomUUID(),count:44},webgl:{renderer:'WebKit WebGL',unmaskedRenderer:'Apple GPU'},speechVoices:[{name:'Daniel'}]}});
test('unseen coherent desktop and mobile environments need no Real Browser reference',()=>{
 for(const e of [unseenDesktop(),{...unseenDesktop(),d:{userAgent:'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari/604.1',platform:'iPhone',webdriver:false,screen:{width:390,height:844,colorDepth:24}}}]) {
  const result=detect(e,e.d.userAgent,[]);
  assert.equal(result.suspectedIdentity,'Real Browser');
  assert.equal(result.identityBasis,'General browser environment');
  assert.equal(result.confidence,'low');
  assert.equal(result.probableOrigin,'Unknown');
 }
});
test('generic fallback rejects missing, automated and inconsistent environments',()=>{
 const cases=[e=>{delete e.d.webdriver;},e=>{e.d.webdriver=true;},e=>{e.r.webgl.unmaskedRenderer='SwiftShader';},e=>{e.d.userAgent='Mozilla/5.0 (Windows NT 10.0) Firefox/147.0';},e=>{delete e.d.screen;},e=>{e.r.fonts.count=7;},e=>{e.d.clientHints={platform:'Windows'};},e=>{e.d.userAgent='Mozilla/5.0 (Macintosh) HeadlessChrome/155.0';}];
 for(const change of cases){const e=unseenDesktop();change(e);assert.equal(detect(e,e.d.userAgent,[]).suspectedIdentity,'Unknown');}
});
test('provider hints and reference ambiguity override the generic environment fallback',()=>{
 const e=unseenDesktop();
 assert.equal(detect(e,'Claude/2.0').suspectedIdentity,'Claude');
 assert.equal(detect({...e,b:{integrity:{codexAnnotationRoot:true}}},e.d.userAgent).suspectedIdentity,'Codex Browser');
 assert.equal(detect(e,e.d.userAgent,[{id:'provider',origin:'Browserbase',evidence:e}]).suspectedIdentity,'Browserbase');
 assert.equal(detect(e,e.d.userAgent,['Browserbase','Instinct'].map(origin=>({id:origin,origin,evidence:e}))).suspectedIdentity,'Unknown');
});
