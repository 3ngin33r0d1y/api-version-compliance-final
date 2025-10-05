import{c as l}from"./createLucideIcon-7608Xzvb.js";/**
 * @license lucide-react v0.441.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=l("CircleCheckBig",[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);/**
 * @license lucide-react v0.441.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=l("Shield",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]]);/**
 * @license lucide-react v0.441.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=l("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]),T=c=>{const r=c.toLowerCase();return r.includes("prod")?"prod":r.includes("oat")?"oat":r.includes("uat")?"uat":r.includes("dev")?"dev":r},h=(c,r)=>{const t=s=>s.replace(/^v/i,"").split(/[.-]/).map(o=>parseInt(o.replace(/\D+/g,""),10)||0),e=t(c),i=t(r),n=Math.max(e.length,i.length);for(let s=0;s<n;s++){const o=e[s]??0,v=i[s]??0;if(o!==v)return o-v}return 0},u=c=>{const r=[],{dev:t,uat:e,oat:i,prod:n}=c;if(!t&&!e&&!i&&!n)return r;const s=t??e??i??n,o=(s==null?void 0:s.service)??"unknown",v=(s==null?void 0:s.projectName)??"Unknown Project",a={dev:t==null?void 0:t.version,uat:e==null?void 0:e.version,oat:i==null?void 0:i.version,prod:n==null?void 0:n.version};return n!=null&&n.version&&(i!=null&&i.version)&&h(n.version,i.version)>0&&r.push({service:o,projectName:v,violation:`CRITICAL: PROD version (${n.version}) is higher than OAT version (${i.version}). PROD version can’t be higher than OAT or UAT.`,severity:"critical",environments:a}),n!=null&&n.version&&(e!=null&&e.version)&&h(n.version,e.version)>0&&r.push({service:o,projectName:v,violation:`CRITICAL: PROD version (${n.version}) is higher than UAT version (${e.version}). PROD version can’t be higher than OAT or UAT.`,severity:"critical",environments:a}),i!=null&&i.version&&(e!=null&&e.version)&&h(i.version,e.version)>0&&r.push({service:o,projectName:v,violation:`WARNING: OAT version (${i.version}) is higher than UAT version (${e.version}). OAT version can’t be higher than UAT.`,severity:"warning",environments:a}),n!=null&&n.version&&!(e!=null&&e.version)&&r.push({service:o,projectName:v,violation:`WARNING: PROD exists (${n.version}) but UAT environment is missing.`,severity:"warning",environments:a}),r};export{m as C,A as S,g as T,u as c,T as n};
