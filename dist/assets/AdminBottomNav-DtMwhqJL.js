import{q as t,a as x,at as m,r as y,j as e,ad as n,au as u,av as b,aw as g,ax as v,ay as k,ao as f,T as j,W as N,R as M}from"./index-BASgNFzI.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=t("Boxes",[["path",{d:"M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z",key:"lc1i9w"}],["path",{d:"m7 16.5-4.74-2.85",key:"1o9zyk"}],["path",{d:"m7 16.5 5-3",key:"va8pkn"}],["path",{d:"M7 16.5v5.17",key:"jnp8gn"}],["path",{d:"M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z",key:"8zsnat"}],["path",{d:"m17 16.5-5-3",key:"8arw3v"}],["path",{d:"m17 16.5 4.74-2.85",key:"8rfmw"}],["path",{d:"M17 16.5v5.17",key:"k6z78m"}],["path",{d:"M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z",key:"1xygjf"}],["path",{d:"M12 8 7.26 5.15",key:"1vbdud"}],["path",{d:"m12 8 4.74-2.85",key:"3rx089"}],["path",{d:"M12 13.5V8",key:"1io7kd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=t("LayoutDashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=t("Megaphone",[["path",{d:"m3 11 18-5v12L3 14v-3z",key:"n962bs"}],["path",{d:"M11.6 16.8a3 3 0 1 1-5.8-1.6",key:"1yl0tm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=t("Menu",[["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}],["line",{x1:"4",x2:"20",y1:"6",y2:"6",key:"1owob3"}],["line",{x1:"4",x2:"20",y1:"18",y2:"18",key:"yk5zj1"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=t("Wallet",[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]]);function C(){const r=x(),l=m(),[c,i]=y.useState(!1),d=[{icon:S,label:"Home",path:"/admin"},{icon:f,label:"Orders",path:"/admin/orders"},{icon:w,label:"Stock",path:"/admin/stock"},{icon:z,label:"Payments",path:"/admin/to-pay"}],h=[{icon:j,label:"Delivery Apps",path:"/admin/delivery-apps"},{icon:N,label:"Security",path:"/admin/security"},{icon:M,label:"Users",path:"/admin/users"},{icon:A,label:"Broadcast",path:"/admin/notifications"}],p=a=>{r(a),i(!1)};return e.jsx("nav",{className:"fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_-10px_40px_rgba(15,23,42,0.35)]",children:e.jsx("div",{className:"container mx-auto px-2",children:e.jsxs("div",{className:"flex items-center justify-around py-2",children:[d.map(a=>{const o=a.icon,s=l.pathname===a.path;return e.jsxs("button",{onClick:()=>r(a.path),className:n("relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all",s?"text-primary bg-primary/10":"text-muted-foreground hover:text-foreground hover:bg-muted/50"),children:[e.jsx(o,{className:n("h-5 w-5",s&&"scale-110")}),e.jsx("span",{className:"text-[10px] font-medium",children:a.label})]},a.label)}),e.jsxs(u,{open:c,onOpenChange:i,children:[e.jsx(b,{asChild:!0,children:e.jsxs("button",{className:n("relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all","text-muted-foreground hover:text-foreground hover:bg-muted/50"),children:[e.jsx(L,{className:"h-5 w-5"}),e.jsx("span",{className:"text-[10px] font-medium",children:"More"})]})}),e.jsxs(g,{side:"bottom",className:"h-auto",children:[e.jsx(v,{className:"pb-4",children:e.jsx(k,{children:"More Options"})}),e.jsx("div",{className:"grid grid-cols-4 gap-4 pb-6",children:h.map(a=>{const o=a.icon,s=l.pathname===a.path;return e.jsxs("button",{onClick:()=>p(a.path),className:n("flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all",s?"text-primary bg-primary/10":"text-muted-foreground hover:text-foreground hover:bg-muted/50"),children:[e.jsx(o,{className:"h-6 w-6"}),e.jsx("span",{className:"text-xs font-medium",children:a.label})]},a.label)})})]})]})]})})})}export{C as A,w as B,A as M,z as W};
