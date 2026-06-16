/* [7] photo-session 순수 로직 QA — node scripts/itbi-photo-session-qa.js */
const PS = require('../js/assistant/core/photo-session.js');
let pass=0, fail=0;
function eq(n,g,e){const a=JSON.stringify(g),b=JSON.stringify(e); if(a===b){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n,'\n  got',a,'\n  exp',b);}}
function ok(n,c){ if(c){pass++;console.log('PASS',n);} else {fail++;console.log('FAIL',n);} }

// 1) 1장 자동 role = hero
let s=PS.autoAssign(PS.addAssets(PS.create(),['u1'],'single'));
eq('1장 자동 hero', s.assets.map(a=>a.role), ['hero']);

// 2) 2장 자동 before/after
s=PS.autoAssign(PS.addAssets(PS.create(),['u1','u2'],'batch'));
eq('2장 자동 before/after', s.assets.map(a=>a.role), ['before','after']);

// 3) 3장 자동 before/after/hero
s=PS.autoAssign(PS.addAssets(PS.create(),['u1','u2','u3'],'batch'));
eq('3장 자동 before/after/hero', s.assets.map(a=>a.role), ['before','after','hero']);

// 4) role 충돌 해결: before 2개 지정 → 마지막 우선, 이전 unset
s=PS.autoAssign(PS.addAssets(PS.create(),['u1','u2','u3'],'batch')); // b,a,h
const id3=s.assets[2].assetId;
PS.setRole(s,id3,'before'); // u3=before → u1(before) unset
eq('before 충돌 → 직전 unset', s.assets.map(a=>a.role), ['unset','after','before']);

// 5) exclude 처리 + 검증
s=PS.autoAssign(PS.addAssets(PS.create(),['u1','u2'],'batch'));
PS.setRole(s,s.assets[1].assetId,'exclude'); // after 제외 → no_after
eq('after 제외 시 validate no_after', PS.validateBeforeAfter(s).reason, 'no_after');
PS.setRole(s,s.assets[0].assetId,'exclude');
eq('전부 제외 → all_excluded', PS.validateBeforeAfter(s).reason, 'all_excluded');

// 6) 정상 전후 → ok, photosForBA
s=PS.autoAssign(PS.addAssets(PS.create(),['ub','ua'],'batch'));
ok('전후 정상 ok', PS.validateBeforeAfter(s).ok===true);
const ba=PS.photosForBA(s);
eq('photosForBA before/after url', [ba.before.url, ba.after.url], ['ub','ua']);

// 7) showcase/caption 선택
s=PS.autoAssign(PS.addAssets(PS.create(),['u1','u2','u3'],'batch')); // b,a,hero(u3)
eq('showcase=hero(u3)', PS.photosForShowcase(s).url, 'u3');
PS.setRole(s,s.assets[2].assetId,'caption');
eq('caption 지정 우선', PS.photosForCaption(s).url, 'u3');

// 8) serialize 중복 최소화 — 같은 dataUrl 1번만 refs
s=PS.addAssets(PS.create(),['dup','dup','x'],'batch');
const ser=PS.serialize(s);
eq('refs 중복제거(2개: dup,x)', ser.photoSession.refs.length, 2);
ok('assets엔 dataUrl 없음(photoRef만)', ser.photoSession.assets.every(a=>!('url' in a) && !('dataUrl' in a) && !!a.photoRef));

// 9) serialize→restore 라운드트립(역할/순서/url 보존)
s=PS.autoAssign(PS.addAssets(PS.create(),['ub','ua','uh'],'batch'));
PS.setRole(s,s.assets[2].assetId,'caption');
const ser2=PS.serialize(s);
const r=PS.restore(ser2.photoSession);
eq('restore 역할 보존', r.assets.map(a=>a.role), ['before','after','caption']);
eq('restore url 보존', r.assets.map(a=>a.url), ['ub','ua','uh']);

console.log('\n==== RESULT:',pass,'PASS,',fail,'FAIL ===='); process.exit(fail?1:0);
