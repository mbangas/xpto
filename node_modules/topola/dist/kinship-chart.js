"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KinshipChart = void 0;
var renderer_1 = require("./kinship/renderer");
var hierarchy_creator_1 = require("./kinship/hierarchy-creator");
var KinshipChart = /** @class */ (function () {
    function KinshipChart(options) {
        this.options = options;
        this.renderer = new renderer_1.KinshipChartRenderer(this.options);
    }
    KinshipChart.prototype.render = function () {
        var _this = this;
        var hierarchy = hierarchy_creator_1.HierarchyCreator.createHierarchy(this.options.data, new hierarchy_creator_1.EntryId(this.options.startIndi || null, this.options.startFam || null));
        var _a = this.renderer.layOut(hierarchy.upRoot, hierarchy.downRoot), upNodes = _a[0], downNodes = _a[1];
        upNodes.concat(downNodes).forEach(function (node) {
            _this.setChildNodesGenerationNumber(node);
        });
        return this.renderer.render(upNodes, downNodes, (0, hierarchy_creator_1.getRootsCount)(hierarchy.upRoot, this.options.data));
    };
    KinshipChart.prototype.setChildNodesGenerationNumber = function (node) {
        var childNodes = this.getChildNodesByType(node);
        var setGenerationNumber = function (childNodes, value) {
            return childNodes.forEach(function (n) { return (n.data.generation = node.data.generation + value); });
        };
        setGenerationNumber(childNodes.indiParents, -1);
        setGenerationNumber(childNodes.indiSiblings, 0);
        setGenerationNumber(childNodes.spouseParents, -1);
        setGenerationNumber(childNodes.spouseSiblings, 0);
        setGenerationNumber(childNodes.children, 1);
    };
    KinshipChart.prototype.getChildNodesByType = function (node) {
        if (!node || !node.children)
            return EMPTY_HIERARCHY_TREE_NODES;
        // Maps id to node object for all children of the input node
        var childNodesById = new Map(node.children.map(function (n) { return [n.data.id, n]; }));
        var nodeToHNode = function (n) {
            return childNodesById.get(n.id);
        };
        var childNodes = node.data.childNodes;
        return {
            indiParents: childNodes.indiParents.map(nodeToHNode),
            indiSiblings: childNodes.indiSiblings.map(nodeToHNode),
            spouseParents: childNodes.spouseParents.map(nodeToHNode),
            spouseSiblings: childNodes.spouseSiblings.map(nodeToHNode),
            children: childNodes.children.map(nodeToHNode),
        };
    };
    return KinshipChart;
}());
exports.KinshipChart = KinshipChart;
var EMPTY_HIERARCHY_TREE_NODES = {
    indiParents: [],
    indiSiblings: [],
    spouseParents: [],
    spouseSiblings: [],
    children: [],
};
