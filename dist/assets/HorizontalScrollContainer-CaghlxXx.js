import{r as n,j as t,C as b}from"./index-CqeKPE8b.js";import{C as v}from"./chevron-left-_58TzeDw.js";function x({children:s,className:d="",showButtons:a=!0}){const l=n.useRef(null),[u,f]=n.useState(!1),[h,m]=n.useState(!1),r=()=>{const e=l.current;e&&(f(e.scrollLeft>10),m(e.scrollLeft<e.scrollWidth-e.clientWidth-10))};n.useEffect(()=>{r();const e=l.current;if(e){e.addEventListener("scroll",r),window.addEventListener("resize",r);const o=setTimeout(r,100);return()=>{e.removeEventListener("scroll",r),window.removeEventListener("resize",r),clearTimeout(o)}}},[s]);const c=e=>{const o=l.current;if(!o)return;const i=o.clientWidth*.7;o.scrollBy({left:e==="left"?-i:i,behavior:"smooth"})};return t.jsxs("div",{className:"relative group",children:[a&&u&&t.jsx("button",{onClick:()=>c("left"),className:`absolute left-0 top-1/2 -translate-y-1/2 z-10 \r
                        w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm \r
                        border border-border/50 shadow-sm\r
                        flex items-center justify-center\r
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200\r
                        hover:bg-background hover:shadow-md`,"aria-label":"Scroll left",children:t.jsx(v,{className:"h-4 w-4 text-muted-foreground"})}),a&&h&&t.jsx("button",{onClick:()=>c("right"),className:`absolute right-0 top-1/2 -translate-y-1/2 z-10 \r
                        w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm \r
                        border border-border/50 shadow-sm\r
                        flex items-center justify-center\r
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200\r
                        hover:bg-background hover:shadow-md`,"aria-label":"Scroll right",children:t.jsx(b,{className:"h-4 w-4 text-muted-foreground"})}),t.jsx("div",{ref:l,className:`flex overflow-x-auto scrollbar-hide ${d}`,style:{scrollbarWidth:"none",msOverflowStyle:"none"},children:s})]})}export{x as H};
