import { HierarchyNode, HierarchyPointNode } from 'd3-hierarchy';
import { Chart, ChartInfo, ChartOptions, Fam, Indi, TreeNode } from './api';
import { ChartUtil, LayoutOptions } from './chart-util';
export declare const DUMMY_ROOT_NODE_ID = "DUMMY_ROOT_NODE";
export declare function layOutDescendants(options: ChartOptions, layoutOptions?: LayoutOptions): HierarchyPointNode<TreeNode>[];
/** Renders a descendants chart. */
export declare class DescendantChart<IndiT extends Indi, FamT extends Fam> implements Chart {
    readonly options: ChartOptions;
    readonly util: ChartUtil;
    constructor(options: ChartOptions);
    private getNodes;
    private getFamNode;
    /** Creates a d3 hierarchy from the input data. */
    createHierarchy(): HierarchyNode<TreeNode>;
    /**
     * Renders the tree, calling the provided renderer to draw boxes for
     * individuals.
     */
    render(): ChartInfo;
}
