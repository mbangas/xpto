import { HierarchyNode, HierarchyPointNode } from 'd3-hierarchy';
import { Chart, ChartInfo, ChartOptions, Fam, Indi, TreeNode } from './api';
import { ChartUtil } from './chart-util';
/** Chart layout showing all relatives of a person. */
export declare class RelativesChart<IndiT extends Indi, FamT extends Fam> implements Chart {
    readonly util: ChartUtil;
    readonly options: ChartOptions;
    constructor(inputOptions: ChartOptions);
    layOutAncestorDescendants(ancestorsRoot: HierarchyNode<TreeNode>, focusedNode: HierarchyPointNode<TreeNode>): HierarchyPointNode<TreeNode>[];
    render(): ChartInfo;
}
