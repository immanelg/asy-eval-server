export { default as Copy } from "./icons/copy.svg";
export { default as Copied } from "./icons/copied.svg";
export { default as Run  }from "./icons/run.svg";
export { default as Read } from "./icons/read.svg";
export { default as Write } from "./icons/write.svg";
export { default as Save } from "./icons/save.svg";
export { default as Gift } from "./icons/gift.svg";
export { default as Watch } from "./icons/watch.svg";
export { default as Unwatch } from "./icons/unwatch.svg";

import { h } from "./h.ts";

export function render(icon: string) {
    return h("img.inline-icon", { props: { src: icon } });
}
export function pair(icon: string, and: any) { 
    return [render(icon), and] 
}
