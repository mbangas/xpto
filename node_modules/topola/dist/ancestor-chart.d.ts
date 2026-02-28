import { Chart, ChartInfo, ChartOptions, Fam, Indi, TreeNode } from './api';
import { ChartUtil } from './chart-util';
import { HierarchyNode } from 'd3-hierarchy';
export declare function getAncestorsTree(options: ChartOptions): HierarchyNode<TreeNode>;
/** Renders an ancestors chart. */
export declare class AncestorChart<IndiT extends Indi, FamT extends Fam> implements Chart {
    readonly options: ChartOptions;
    readonly util: ChartUtil;
    constructor(options: ChartOptions);
    /** Creates a d3 hierarchy from the input data. */
    createHierarchy(): HierarchyNode<TreeNode>;
    /**
     * Renders the tree, calling the provided renderer to draw boxes for
     * individuals.
     */
    render(): ChartInfo;
}
