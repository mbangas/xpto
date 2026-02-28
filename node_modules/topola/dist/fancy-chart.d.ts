import { BaseType, Selection } from 'd3-selection';
import { HierarchyPointNode } from 'd3-hierarchy';
import { Chart, ChartInfo, ChartOptions, Fam, Indi, TreeNode } from './api';
import { ChartUtil, ChartSizeInfo } from './chart-util';
/** Renders a fancy descendants tree chart. */
export declare class FancyChart<IndiT extends Indi, FamT extends Fam> implements Chart {
    readonly options: ChartOptions;
    readonly util: ChartUtil;
    constructor(options: ChartOptions);
    /** Creates a path from parent to the child node (vertical layout). */
    private linkVertical;
    private linkAdditionalMarriage;
    renderBackground(chartInfo: ChartSizeInfo, svg: Selection<BaseType, {}, BaseType, {}>): void;
    renderLeaves(nodes: Array<HierarchyPointNode<TreeNode>>, svg: Selection<BaseType, {}, BaseType, {}>): void;
    renderLinks(nodes: Array<HierarchyPointNode<TreeNode>>, svg: Selection<BaseType, {}, BaseType, {}>): void;
    renderTreeTrunk(nodes: Array<HierarchyPointNode<TreeNode>>, svg: Selection<BaseType, {}, BaseType, {}>): void;
    render(): ChartInfo;
}
