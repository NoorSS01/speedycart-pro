import{p as n,a as p,ap as m,r as u,j as e,aq as s,ar as y,as as b,at as g,au as f,av as v,ak as j,T as k,V as N,Q as M}from"./index-CWmUW0Oc.js";import{B as S}from"./boxes-b2j2-WXi.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=n("LayoutDashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=n("Megaphone",[["path",{d:"m3 11 18-5v12L3 14v-3z",key:"n962bs"}],["path",{d:"M11.6 16.8a3 3 0 1 1-5.8-1.6",key:"1yl0tm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B=n("Menu",[["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}],["line",{x1:"4",x2:"20",y1:"6",y2:"6",key:"1owob3"}],["line",{x1:"4",x2:"20",y1:"18",y2:"18",key:"yk5zj1"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=n("Wallet",[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]]);function O(){const r=p(),l=m(),[c,i]=u.useState(!1),d=[{icon:w,label:"Home",path:"/admin"},{icon:j,label:"Orders",path:"/admin/orders"},{icon:S,label:"Stock",path:"/admin/stock"},{icon:C,label:"Payments",path:"/admin/to-pay"}],h=[{icon:k,label:"Delivery Apps",path:"/admin/delivery-apps"},{icon:N,label:"Security",path:"/admin/security"},{icon:M,label:"Users",path:"/admin/users"},{icon:A,label:"Broadcast",path:"/admin/notifications"}],x=a=>{r(a),i(!1)};return e.jsx("nav",{className:"fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_-10px_40px_rgba(15,23,42,0.35)]",children:e.jsx("div",{className:"container mx-auto px-2",children:e.jsxs("div",{className:"flex items-center justify-around py-2",children:[d.map(a=>{const o=a.icon,t=l.pathname===a.path;return e.jsxs("button",{onClick:()=>r(a.path),className:s("relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all",t?"text-primary bg-primary/10":"text-muted-foreground hover:text-foreground hover:bg-muted/50"),children:[e.jsx(o,{className:s("h-5 w-5",t&&"scale-110")}),e.jsx("span",{className:"text-[10px] font-medium",children:a.label})]},a.label)}),e.jsxs(y,{open:c,onOpenChange:i,children:[e.jsx(b,{asChild:!0,children:e.jsxs("button",{className:s("relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all","text-muted-foreground hover:text-foreground hover:bg-muted/50"),children:[e.jsx(B,{className:"h-5 w-5"}),e.jsx("span",{className:"text-[10px] font-medium",children:"More"})]})}),e.jsxs(g,{side:"bottom",className:"h-auto",children:[e.jsx(f,{className:"pb-4",children:e.jsx(v,{children:"More Options"})}),e.jsx("div",{className:"grid grid-cols-4 gap-4 pb-6",children:h.map(a=>{const o=a.icon,t=l.pathname===a.path;return e.jsxs("button",{onClick:()=>x(a.path),className:s("flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all",t?"text-primary bg-primary/10":"text-muted-foreground hover:text-foreground hover:bg-muted/50"),children:[e.jsx(o,{className:"h-6 w-6"}),e.jsx("span",{className:"text-xs font-medium",children:a.label})]},a.label)})})]})]})]})})})}export{O as A,A as M,C as W};
