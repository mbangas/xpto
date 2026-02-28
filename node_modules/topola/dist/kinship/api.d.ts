import { TreeNode as BaseTreeNode } from '../api';
export declare class ChildNodes {
    static readonly EMPTY: ChildNodes;
    indiParents: TreeNode[];
    indiSiblings: TreeNode[];
    spouseParents: TreeNode[];
    spouseSiblings: TreeNode[];
    children: TreeNode[];
    constructor(overrides?: ChildNodesOverrides);
    get(type: LinkType): TreeNode[];
    getAll(): TreeNode[];
}
interface ChildNodesOverrides {
    indiParents?: TreeNode[];
    indiSiblings?: TreeNode[];
    spouseParents?: TreeNode[];
    spouseSiblings?: TreeNode[];
    children?: TreeNode[];
}
export interface TreeNode extends BaseTreeNode {
    parentNode: TreeNode;
    childNodes: ChildNodes;
    /** List of link types for which link stub should be rendered */
    linkStubs: LinkType[];
    /** Type of link from parent node to this node, from the perspective of a parent node */
    linkFromParentType?: LinkType;
    /** Primary marriage fam node, for fam nodes that are additional marriages */
    primaryMarriage?: TreeNode;
    /** Node, that this node is duplicate of */
    duplicateOf?: TreeNode;
    /** If true, then there exist one or more nodes, that are duplicates of this node */
    duplicated?: boolean;
    /** Y coordinates for different types of outgoing links */
    linkYs?: {
        indi: number;
        spouse: number;
        children: number;
    };
}
export declare enum LinkType {
    IndiParents = 0,
    IndiSiblings = 1,
    SpouseParents = 2,
    SpouseSiblings = 3,
    Children = 4
}
export declare function otherSideLinkType(type: LinkType): LinkType;
export {};
