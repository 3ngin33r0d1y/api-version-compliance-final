import{c as h}from"./createLucideIcon-DK-Wc8Hz.js";/**
 * @license lucide-react v0.441.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=h("CircleCheckBig",[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);/**
 * @license lucide-react v0.441.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=h("Shield",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]]);/**
 * @license lucide-react v0.441.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=h("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]),f=v=>{const s=v.toLowerCase();return s.includes("prod")?"prod":s.includes("oat")?"oat":s.includes("uat")?"uat":s.includes("dev")?"dev":s},a=(v,s)=>{const t=v.split(".").map(Number),i=s.split(".").map(Number),n=Math.max(t.length,i.length);for(let e=0;e<n;e++){const r=t[e]||0,o=i[e]||0;if(r!==o)return r-o}return 0},g=v=>{var l,m;const s=[],{dev:t,uat:i,oat:n,prod:e}=v;if(!t&&!i&&!n&&!e)return s;const r=((l=Object.values(v)[0])==null?void 0:l.service)||"unknown",o=((m=Object.values(v)[0])==null?void 0:m.projectName)||"Unknown Project",c={dev:t==null?void 0:t.version,uat:i==null?void 0:i.version,oat:n==null?void 0:n.version,prod:e==null?void 0:e.version};return e!=null&&e.version&&(n!=null&&n.version)&&a(e.version,n.version)>0&&s.push({service:r,projectName:o,violation:`CRITICAL: PROD version (${e.version}) is higher than OAT version (${n.version})`,severity:"critical",environments:c}),e!=null&&e.version&&(i!=null&&i.version)&&a(e.version,i.version)>0&&s.push({service:r,projectName:o,violation:`CRITICAL: PROD version (${e.version}) is higher than UAT version (${i.version})`,severity:"critical",environments:c}),n!=null&&n.version&&(i!=null&&i.version)&&a(n.version,i.version)>0&&s.push({service:r,projectName:o,violation:`WARNING: OAT version (${n.version}) is higher than UAT version (${i.version})`,severity:"warning",environments:c}),n!=null&&n.version&&(e!=null&&e.version)&&a(n.version,e.version)>0&&s.push({service:r,projectName:o,violation:`CRITICAL: OAT version (${n.version}) is higher than PROD version (${e.version})`,severity:"critical",environments:c}),i!=null&&i.version&&(e!=null&&e.version)&&a(i.version,e.version)>0&&s.push({service:r,projectName:o,violation:`CRITICAL: UAT version (${i.version}) is higher than PROD version (${e.version})`,severity:"critical",environments:c}),e!=null&&e.version&&!(i!=null&&i.version)&&s.push({service:r,projectName:o,violation:`WARNING: PROD exists (${e.version}) but UAT environment is missing`,severity:"warning",environments:c}),s};export{p as C,A as S,C as T,g as c,f as n};
