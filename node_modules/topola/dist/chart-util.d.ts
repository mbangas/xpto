import { BaseType, Selection } from 'd3-selection';
import { ChartOptions, ExpanderState, TreeNode, TreeNodeSelection } from './api';
import { HierarchyNode, HierarchyPointNode } from 'd3-hierarchy';
import 'd3-transition';
type SVGSelection = Selection<BaseType, {}, BaseType, {}>;
/** Horizontal distance between boxes. */
export declare const H_SPACING = 15;
/** Vertical distance between boxes. */
export declare const V_SPACING = 34;
/**
 * Additional layout options intended to be used internally by layout
 * implementations.
 */
export interface LayoutOptions {
    flipVertically?: boolean;
    vSpacing?: number;
    hSpacing?: number;
}
export interface ChartSizeInfo {
    size: [number, number];
    origin: [number, number];
}
/** Assigns an identifier to a link. */
export declare function linkId(node: HierarchyPointNode<TreeNode>): string;
export declare function getChartInfo(nodes: Array<HierarchyPointNode<TreeNode>>): ChartSizeInfo;
export declare function getChartInfoWithoutMargin(nodes: Array<HierarchyPointNode<TreeNode>>): ChartSizeInfo;
/** Utility class with common code for all chart types. */
export declare class ChartUtil {
    readonly options: ChartOptions;
    constructor(options: ChartOptions);
    /** Creates a path from parent to the child node (horizontal layout). */
    private linkHorizontal;
    /** Creates a path from parent to the child node (vertical layout). */
    private linkVertical;
    private linkAdditionalMarriage;
    updateSvgDimensions(chartInfo: ChartSizeInfo): void;
    layOutChart<N extends TreeNode>(root: HierarchyNode<N>, layoutOptions?: LayoutOptions): Array<HierarchyPointNode<N>>;
    renderChart(nodes: Array<HierarchyPointNode<TreeNode>>): Promise<void>;
    renderNodes(nodes: Array<HierarchyPointNode<TreeNode>>, svg: SVGSelection): Promise<void>;
    renderLinks(nodes: Array<HierarchyPointNode<TreeNode>>, svg: SVGSelection): Promise<void>;
    renderExpander(nodes: TreeNodeSelection, stateGetter: (node: HierarchyPointNode<TreeNode>) => ExpanderState | undefined, clickCallback?: (id: string) => void): void;
    renderFamilyControls(nodes: TreeNodeSelection): void;
    renderIndiControls(nodes: TreeNodeSelection): void;
    renderSpouseControls(nodes: TreeNodeSelection): void;
    renderControls(nodes: Array<HierarchyPointNode<TreeNode>>, svg: SVGSelection): Promise<void>;
    getSvgForRendering(): SVGSelection;
}
export {};
