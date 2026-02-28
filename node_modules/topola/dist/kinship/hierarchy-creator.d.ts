import { TreeNode } from './api';
import { DataProvider, Fam, Indi } from '../api';
import { HierarchyNode } from 'd3-hierarchy';
import { HierarchyFilter } from './hierarchy-filter';
import { IdGenerator } from '../id-generator';
export declare class HierarchyCreator {
    readonly data: DataProvider<Indi, Fam>;
    static readonly UP_FILTER: HierarchyFilter;
    static readonly DOWN_FILTER: HierarchyFilter;
    static readonly ALL_ACCEPTING_FILTER: HierarchyFilter;
    static createHierarchy(data: DataProvider<Indi, Fam>, startEntryId: EntryId): Hierarchy;
    readonly startEntryId: EntryId;
    readonly startFamIndi: string | null;
    readonly queuedNodesById: Map<string, TreeNode>;
    readonly idGenerator: IdGenerator;
    private constructor();
    private expandStartId;
    createHierarchy(): Hierarchy;
    private fillNodeData;
    private childNodesForFam;
    private childNodesForIndi;
    private areParentsAndSiblingsPresent;
    private getParentsAndSiblings;
    private indiIdsToFamAsSpouseNodes;
    private indiIdToFamAsSpouseNodes;
    private famAsSpouseIdsToNodes;
    private idsToNodes;
    private idToNode;
    private createLinkStubs;
    private isChildNodeTypeForbidden;
    private isFamNode;
}
export interface Hierarchy {
    upRoot: HierarchyNode<TreeNode>;
    downRoot: HierarchyNode<TreeNode>;
}
export declare class EntryId {
    id: string;
    isFam: boolean;
    static indi(id: string): EntryId;
    static fam(id: string): EntryId;
    constructor(indiId: string | null, famId: string | null);
}
export declare function getRootsCount(upRoot: HierarchyNode<TreeNode>, data: DataProvider<Indi, Fam>): number;
