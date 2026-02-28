import { HierarchyNode, HierarchyPointNode } from 'd3-hierarchy';
import { ChartInfo, ChartOptions } from '../api';
import { TreeNode } from './api';
import { ChartUtil } from '../chart-util';
export declare class KinshipChartRenderer {
    readonly options: ChartOptions;
    readonly util: ChartUtil;
    constructor(options: ChartOptions);
    layOut(upRoot: HierarchyNode<TreeNode>, downRoot: HierarchyNode<TreeNode>): [
        Array<HierarchyPointNode<TreeNode>>,
        Array<HierarchyPointNode<TreeNode>>
    ];
    render(upNodes: Array<HierarchyPointNode<TreeNode>>, downNodes: Array<HierarchyPointNode<TreeNode>>, rootsCount: number): ChartInfo;
    private renderLinks;
    private cssClassForLink;
    private cssClassForLinkStub;
    private cssClassForLinkType;
    private nodeToLinkStubRenderInfos;
    private getLinkY;
    private setLinkYs;
    /***
     * Calculates indi (indiParent and indiSiblings) and spouse (spouseParent and spouseSiblings)
     * links offset directions, so they don't merge/collide with children links and with each other.
     ***/
    private calcLinkOffsetDirs;
    private findMinXOfChildNodesAnchors;
    private findMaxXOfChildNodesAnchors;
    private findExtremeXOfChildNodesAnchors;
    private linkPoints;
    private additionalMarriageLinkPoints;
    private linkAnchorPoints;
    private indiMidY;
    private renderRootDummyAdditionalMarriageLinkStub;
}
