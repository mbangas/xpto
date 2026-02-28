import { FamDetails, IndiDetails } from './data';
import { HierarchyNode } from 'd3-hierarchy';
import { Renderer, RendererOptions, TreeNode, TreeNodeSelection, TreeEntry } from './api';
/** Renders person or married couple inside a sircle. */
export declare class CircleRenderer implements Renderer {
    readonly options: RendererOptions<IndiDetails, FamDetails>;
    constructor(options: RendererOptions<IndiDetails, FamDetails>);
    getFamilyAnchor(node: TreeNode): [number, number];
    getIndiAnchor(node: TreeNode): [number, number];
    getSpouseAnchor(node: TreeNode): [number, number];
    updateNodes(nodes: Array<HierarchyNode<TreeNode>>): void;
    getName(entry: TreeEntry | undefined): string;
    render(enter: TreeNodeSelection, update: TreeNodeSelection): void;
    getCss(): string;
}
