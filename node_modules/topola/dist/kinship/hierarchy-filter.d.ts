export declare class HierarchyFilter {
    indiParents: boolean;
    indiSiblings: boolean;
    spouseParents: boolean;
    spouseSiblings: boolean;
    children: boolean;
    static allAccepting(): HierarchyFilter;
    static allRejecting(): HierarchyFilter;
    constructor(overrides?: HierarchyFilterOverrides);
    modify(overrides: HierarchyFilterOverrides): HierarchyFilter;
}
interface HierarchyFilterOverrides {
    indiParents?: boolean;
    indiSiblings?: boolean;
    spouseParents?: boolean;
    spouseSiblings?: boolean;
    children?: boolean;
}
export {};
