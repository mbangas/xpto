"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DescendantChart = exports.DUMMY_ROOT_NODE_ID = void 0;
exports.layOutDescendants = layOutDescendants;
var d3_hierarchy_1 = require("d3-hierarchy");
var api_1 = require("./api");
var chart_util_1 = require("./chart-util");
var id_generator_1 = require("./id-generator");
exports.DUMMY_ROOT_NODE_ID = 'DUMMY_ROOT_NODE';
function layOutDescendants(options, layoutOptions) {
    if (layoutOptions === void 0) { layoutOptions = {}; }
    var descendants = new DescendantChart(options);
    var descendantsRoot = descendants.createHierarchy();
    return removeDummyNode(new chart_util_1.ChartUtil(options).layOutChart(descendantsRoot, layoutOptions));
}
/** Removes the dummy root node if it was added in createHierarchy(). */
function removeDummyNode(allNodes) {
    if (allNodes[0].id !== exports.DUMMY_ROOT_NODE_ID) {
        return allNodes;
    }
    var nodes = allNodes.slice(1);
    // Move first node to (0, 0) coordinates.
    var dx = -nodes[0].x;
    var dy = -nodes[0].y;
    nodes.forEach(function (node) {
        if (node.parent &&
            node.parent.id === exports.DUMMY_ROOT_NODE_ID &&
            !node.data.additionalMarriage) {
            node.parent = null;
        }
        node.x += dx;
        node.y += dy;
        node.data.generation--;
    });
    return nodes;
}
/** Returns the spouse of the given individual in the given family. */
function getSpouse(indiId, fam) {
    if (fam.getFather() === indiId) {
        return fam.getMother();
    }
    return fam.getFather();
}
/** Renders a descendants chart. */
var DescendantChart = /** @class */ (function () {
    function DescendantChart(options) {
        this.options = options;
        this.util = new chart_util_1.ChartUtil(options);
    }
    DescendantChart.prototype.getNodes = function (id) {
        var _this = this;
        var indi = this.options.data.getIndi(id);
        var famIds = indi.getFamiliesAsSpouse();
        if (!famIds.length) {
            // Single person.
            return [
                {
                    id: id,
                    indi: {
                        id: id,
                    },
                },
            ];
        }
        // Marriages.
        var nodes = famIds.map(function (famId) {
            var entry = {
                id: famId,
                indi: {
                    id: id,
                },
                family: {
                    id: famId,
                },
            };
            var fam = _this.options.data.getFam(famId);
            var spouse = getSpouse(id, fam);
            if (spouse) {
                entry.spouse = { id: spouse };
            }
            return entry;
        });
        nodes.slice(1).forEach(function (node) {
            node.additionalMarriage = true;
        });
        return nodes;
    };
    DescendantChart.prototype.getFamNode = function (famId) {
        var node = { id: famId, family: { id: famId } };
        var fam = this.options.data.getFam(famId);
        var father = fam.getFather();
        if (father) {
            node.indi = { id: father };
        }
        var mother = fam.getMother();
        if (mother) {
            node.spouse = { id: mother };
        }
        return node;
    };
    /** Creates a d3 hierarchy from the input data. */
    DescendantChart.prototype.createHierarchy = function () {
        var _this = this;
        var _a;
        var parents = [];
        var nodes = this.options.startIndi
            ? this.getNodes(this.options.startIndi)
            : [this.getFamNode(this.options.startFam)];
        var idGenerator = this.options.idGenerator || new id_generator_1.IdGenerator();
        nodes.forEach(function (node) { return (node.id = idGenerator.getId(node.id)); });
        // If there are multiple root nodes, i.e. the start individual has multiple
        // marriages, create a dummy root node.
        // After layout is complete, the dummy node will be removed.
        if (nodes.length > 1) {
            var dummyNode_1 = {
                id: exports.DUMMY_ROOT_NODE_ID,
                height: 1,
                width: 1,
            };
            parents.push(dummyNode_1);
            nodes.forEach(function (node) { return (node.parentId = dummyNode_1.id); });
        }
        parents.push.apply(parents, nodes);
        var stack = [];
        nodes.forEach(function (node) {
            if (node.family) {
                stack.push(node);
            }
        });
        var _loop_1 = function () {
            var entry = stack.pop();
            var fam = this_1.options.data.getFam(entry.family.id);
            var children = fam.getChildren();
            var collapsed = (_a = this_1.options.collapsedFamily) === null || _a === void 0 ? void 0 : _a.has(entry.id);
            if (children.length) {
                entry.family.expander = collapsed
                    ? api_1.ExpanderState.PLUS
                    : api_1.ExpanderState.MINUS;
            }
            if (!collapsed) {
                children.forEach(function (childId) {
                    var childNodes = _this.getNodes(childId);
                    childNodes.forEach(function (node) {
                        node.parentId = entry.id;
                        if (node.family) {
                            node.id = "".concat(idGenerator.getId(node.family.id));
                            stack.push(node);
                        }
                    });
                    parents.push.apply(parents, childNodes);
                });
            }
        };
        var this_1 = this;
        while (stack.length) {
            _loop_1();
        }
        return (0, d3_hierarchy_1.stratify)()(parents);
    };
    /**
     * Renders the tree, calling the provided renderer to draw boxes for
     * individuals.
     */
    DescendantChart.prototype.render = function () {
        var root = this.createHierarchy();
        var nodes = removeDummyNode(this.util.layOutChart(root));
        var animationPromise = this.util.renderChart(nodes);
        var info = (0, chart_util_1.getChartInfo)(nodes);
        this.util.updateSvgDimensions(info);
        return Object.assign(info, { animationPromise: animationPromise });
    };
    return DescendantChart;
}());
exports.DescendantChart = DescendantChart;
