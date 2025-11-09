import { h as __h, type VNode, type VNodeData } from "snabbdom";

// adapted from lichess lila/ui/lib

// strip boolean results and flatten arrays in renders.  Allows
//   h('div', isDivEmpty || [ 'foo', fooHasBar && [ 'has', 'bar' ])
export function h(sel: string, dataOrKids: VNode[] | any| VNodeData , kids: VNode[] | any | null = null) {
  if (kids) return __h(sel, dataOrKids, filterKids(kids));
  if (!kidFilter(dataOrKids)) return __h(sel);
  if (Array.isArray(dataOrKids) || (typeof dataOrKids === 'object' && 'sel' in dataOrKids!))
    return __h(sel, filterKids(dataOrKids));
  else return __h(sel, dataOrKids);
}
const kidFilter = (x: any): boolean => (x && x !== true) || x === '' || x === 0;
const filterKids = (children: any) => {
  const flatKids = [];
  flattenKids(children, flatKids);
  return flatKids.filter(kidFilter);
};
const flattenKids = (children, out) => {
  if (Array.isArray(children)) for (const el of children) flattenKids(el, out);
  else out.push(children);
};

