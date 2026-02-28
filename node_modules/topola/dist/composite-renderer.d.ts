import { HierarchyNode } from 'd3-hierarchy';
import { TreeNode } from './api';
/**
 * Common code for tree nodes that are composed of individual and family boxes.
 */
export declare abstract class CompositeRenderer {
    readonly options: {
        horizontal?: boolean;
    };
    constructor(options: {
        horizontal?: boolean;
    });
    abstract getPreferredIndiSize(id: string): [number, number];
    getPreferredFamSize(id: string): [number, number];
    private setPreferredIndiSize;
    updateNodes(nodes: Array<HierarchyNode<TreeNode>>): void;
    getFamilyAnchor(node: TreeNode): [number, number];
    getSpouseAnchor(node: TreeNode): [number, number];
    getIndiAnchor(node: TreeNode): [number, number];
}
/**
 * Returns the relative position of the family box for the vertical layout.
 */
export declare function getFamPositionVertical(node: TreeNode): number;
/**
 * Returns the relative position of the family box for the horizontal layout.
 */
export declare function getFamPositionHorizontal(node: TreeNode): number;
/** Returns the vertical size. */
export declare function getVSize(node: TreeNode, horizontal: boolean): number;
