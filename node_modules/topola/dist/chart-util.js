"use strict";
/// <reference path='d3-flextree.d.ts' />
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartUtil = exports.V_SPACING = exports.H_SPACING = void 0;
exports.linkId = linkId;
exports.getChartInfo = getChartInfo;
exports.getChartInfoWithoutMargin = getChartInfoWithoutMargin;
var d3_selection_1 = require("d3-selection");
var api_1 = require("./api");
var d3_flextree_1 = require("d3-flextree");
var d3_array_1 = require("d3-array");
require("d3-transition");
var composite_renderer_1 = require("./composite-renderer");
/** Horizontal distance between boxes. */
exports.H_SPACING = 15;
/** Vertical distance between boxes. */
exports.V_SPACING = 34;
/** Margin around the whole drawing. */
var MARGIN = 15;
var HIDE_TIME_MS = 200;
var MOVE_TIME_MS = 500;
function getExpanderCss() {
    return "\n.expander {\n  fill: white;\n  stroke: black;\n  stroke-width: 2px;\n  cursor: pointer;\n}";
}
/** Assigns an identifier to a link. */
function linkId(node) {
    if (!node.parent) {
        return "".concat(node.id, ":A");
    }
    var _a = node.data.generation > node.parent.data.generation
        ? [node.data, node.parent.data]
        : [node.parent.data, node.data], child = _a[0], parent = _a[1];
    if (child.additionalMarriage) {
        return "".concat(child.id, ":A");
    }
    return "".concat(parent.id, ":").concat(child.id);
}
function getChartInfo(nodes) {
    // Calculate chart boundaries.
    var x0 = (0, d3_array_1.min)(nodes, function (d) { return d.x - d.data.width / 2; }) - MARGIN;
    var y0 = (0, d3_array_1.min)(nodes, function (d) { return d.y - d.data.height / 2; }) - MARGIN;
    var x1 = (0, d3_array_1.max)(nodes, function (d) { return d.x + d.data.width / 2; }) + MARGIN;
    var y1 = (0, d3_array_1.max)(nodes, function (d) { return d.y + d.data.height / 2; }) + MARGIN;
    return { size: [x1 - x0, y1 - y0], origin: [-x0, -y0] };
}
function getChartInfoWithoutMargin(nodes) {
    // Calculate chart boundaries.
    var x0 = (0, d3_array_1.min)(nodes, function (d) { return d.x - d.data.width / 2; });
    var y0 = (0, d3_array_1.min)(nodes, function (d) { return d.y - d.data.height / 2; });
    var x1 = (0, d3_array_1.max)(nodes, function (d) { return d.x + d.data.width / 2; });
    var y1 = (0, d3_array_1.max)(nodes, function (d) { return d.y + d.data.height / 2; });
    return { size: [x1 - x0, y1 - y0], origin: [-x0, -y0] };
}
/** Utility class with common code for all chart types. */
var ChartUtil = /** @class */ (function () {
    function ChartUtil(options) {
        this.options = options;
    }
    /** Creates a path from parent to the child node (horizontal layout). */
    ChartUtil.prototype.linkHorizontal = function (s, d) {
        var sAnchor = this.options.renderer.getFamilyAnchor(s.data);
        var dAnchor = s.id === d.data.spouseParentNodeId
            ? this.options.renderer.getSpouseAnchor(d.data)
            : this.options.renderer.getIndiAnchor(d.data);
        var _a = [s.x + sAnchor[0], s.y + sAnchor[1]], sx = _a[0], sy = _a[1];
        var _b = [d.x + dAnchor[0], d.y + dAnchor[1]], dx = _b[0], dy = _b[1];
        var midX = (s.x + s.data.width / 2 + d.x - d.data.width / 2) / 2;
        return "M ".concat(sx, " ").concat(sy, "\n            L ").concat(midX, " ").concat(sy, ",\n              ").concat(midX, " ").concat(dy, ",\n              ").concat(dx, " ").concat(dy);
    };
    /** Creates a path from parent to the child node (vertical layout). */
    ChartUtil.prototype.linkVertical = function (s, d) {
        var sAnchor = this.options.renderer.getFamilyAnchor(s.data);
        var dAnchor = s.id === d.data.spouseParentNodeId
            ? this.options.renderer.getSpouseAnchor(d.data)
            : this.options.renderer.getIndiAnchor(d.data);
        var _a = [s.x + sAnchor[0], s.y + sAnchor[1]], sx = _a[0], sy = _a[1];
        var _b = [d.x + dAnchor[0], d.y + dAnchor[1]], dx = _b[0], dy = _b[1];
        var midY = s.y + s.data.height / 2 + exports.V_SPACING / 2;
        return "M ".concat(sx, " ").concat(sy, "\n            L ").concat(sx, " ").concat(midY, ",\n              ").concat(dx, " ").concat(midY, ",\n              ").concat(dx, " ").concat(dy);
    };
    ChartUtil.prototype.linkAdditionalMarriage = function (node) {
        var nodeIndex = node.parent.children.findIndex(function (n) { return n.data.id === node.data.id; });
        // Assert nodeIndex > 0.
        var siblingNode = node.parent.children[nodeIndex - 1];
        var sAnchor = this.options.renderer.getIndiAnchor(node.data);
        var dAnchor = this.options.renderer.getIndiAnchor(siblingNode.data);
        var _a = [node.x + sAnchor[0], node.y + sAnchor[1]], sx = _a[0], sy = _a[1];
        var _b = [siblingNode.x + dAnchor[0], siblingNode.y + dAnchor[1]], dx = _b[0], dy = _b[1];
        return "M ".concat(sx, ", ").concat(sy, "\n            L ").concat(dx, ", ").concat(dy);
    };
    ChartUtil.prototype.updateSvgDimensions = function (chartInfo) {
        var svg = (0, d3_selection_1.select)(this.options.svgSelector);
        var group = svg.select('g');
        var transition = this.options.animate
            ? group.transition().delay(HIDE_TIME_MS).duration(MOVE_TIME_MS)
            : group;
        transition.attr('transform', "translate(".concat(chartInfo.origin[0], ", ").concat(chartInfo.origin[1], ")"));
    };
    ChartUtil.prototype.layOutChart = function (root, layoutOptions) {
        var _this = this;
        if (layoutOptions === void 0) { layoutOptions = {}; }
        // Add styles so that calculating text size is correct.
        var svg = (0, d3_selection_1.select)(this.options.svgSelector);
        if (svg.select('style').empty()) {
            svg
                .append('style')
                .text(this.options.renderer.getCss() + getExpanderCss());
        }
        // Assign generation number.
        root.each(function (node) {
            node.data.generation =
                node.depth * (layoutOptions.flipVertically ? -1 : 1) +
                    (_this.options.baseGeneration || 0);
        });
        // Set preferred sizes.
        this.options.renderer.updateNodes(root.descendants());
        var vSizePerDepth = new Map();
        root.each(function (node) {
            var depth = node.depth;
            var maxVSize = (0, d3_array_1.max)([
                _this.options.horizontal ? node.data.width : node.data.height,
                vSizePerDepth.get(depth),
            ]);
            vSizePerDepth.set(depth, maxVSize);
        });
        // Set sizes of whole nodes.
        root.each(function (node) {
            var vSize = vSizePerDepth.get(node.depth);
            if (_this.options.horizontal) {
                node.data.width = vSize;
            }
            else {
                node.data.height = vSize;
            }
        });
        var vSpacing = layoutOptions.vSpacing !== undefined ? layoutOptions.vSpacing : exports.V_SPACING;
        var hSpacing = layoutOptions.hSpacing !== undefined ? layoutOptions.hSpacing : exports.H_SPACING;
        // Assigns the x and y position for the nodes.
        var treemap = (0, d3_flextree_1.flextree)()
            .nodeSize(function (node) {
            if (_this.options.horizontal) {
                var maxChildSize_1 = (0, d3_array_1.max)(node.children || [], function (n) { return n.data.width; }) || 0;
                return [
                    node.data.height,
                    (maxChildSize_1 + node.data.width) / 2 + vSpacing,
                ];
            }
            var maxChildSize = (0, d3_array_1.max)(node.children || [], function (n) { return n.data.height; }) || 0;
            return [
                node.data.width,
                (maxChildSize + node.data.height) / 2 + vSpacing,
            ];
        })
            .spacing(function (a, b) { return hSpacing; });
        var nodes = treemap(root).descendants();
        // Swap x-y coordinates for horizontal layout.
        nodes.forEach(function (node) {
            var _a;
            if (layoutOptions.flipVertically) {
                node.y = -node.y;
            }
            if (_this.options.horizontal) {
                _a = [node.y, node.x], node.x = _a[0], node.y = _a[1];
            }
        });
        return nodes;
    };
    ChartUtil.prototype.renderChart = function (nodes) {
        var svg = this.getSvgForRendering();
        var nodeAnimation = this.renderNodes(nodes, svg);
        var linkAnimation = this.renderLinks(nodes, svg);
        var expanderAnimation = this.renderControls(nodes, svg);
        return Promise.all([
            nodeAnimation,
            linkAnimation,
            expanderAnimation,
        ]);
    };
    ChartUtil.prototype.renderNodes = function (nodes, svg) {
        var _this = this;
        var animationPromise = new Promise(function (resolve) {
            var boundNodes = svg
                .select('g')
                .selectAll('g.node')
                .data(nodes, function (d) { return d.id; });
            var nodeEnter = boundNodes.enter().append('g');
            var transitionsPending = boundNodes.exit().size() + boundNodes.size() + nodeEnter.size();
            var transitionDone = function () {
                transitionsPending--;
                if (transitionsPending === 0) {
                    resolve();
                }
            };
            if (!_this.options.animate || transitionsPending === 0) {
                resolve();
            }
            nodeEnter
                .merge(boundNodes)
                .attr('class', function (node) { return "node generation".concat(node.data.generation); });
            nodeEnter.attr('transform', function (node) {
                return "translate(".concat(node.x - node.data.width / 2, ", ").concat(node.y - node.data.height / 2, ")");
            });
            if (_this.options.animate) {
                nodeEnter
                    .style('opacity', 0)
                    .transition()
                    .delay(HIDE_TIME_MS + MOVE_TIME_MS)
                    .duration(HIDE_TIME_MS)
                    .style('opacity', 1)
                    .on('end', transitionDone);
            }
            var updateTransition = _this.options.animate
                ? boundNodes
                    .transition()
                    .delay(HIDE_TIME_MS)
                    .duration(MOVE_TIME_MS)
                    .on('end', transitionDone)
                : boundNodes;
            updateTransition.attr('transform', function (node) {
                return "translate(".concat(node.x - node.data.width / 2, ", ").concat(node.y - node.data.height / 2, ")");
            });
            _this.options.renderer.render(nodeEnter, boundNodes);
            if (_this.options.animate) {
                boundNodes
                    .exit()
                    .transition()
                    .duration(HIDE_TIME_MS)
                    .style('opacity', 0)
                    .remove()
                    .on('end', transitionDone);
            }
            else {
                boundNodes.exit().remove();
            }
        });
        return animationPromise;
    };
    ChartUtil.prototype.renderLinks = function (nodes, svg) {
        var _this = this;
        var animationPromise = new Promise(function (resolve) {
            var link = function (parent, child) {
                if (child.data.additionalMarriage) {
                    return _this.linkAdditionalMarriage(child);
                }
                var flipVertically = parent.data.generation > child.data.generation;
                if (_this.options.horizontal) {
                    if (flipVertically) {
                        return _this.linkHorizontal(child, parent);
                    }
                    return _this.linkHorizontal(parent, child);
                }
                if (flipVertically) {
                    return _this.linkVertical(child, parent);
                }
                return _this.linkVertical(parent, child);
            };
            var links = nodes.filter(function (n) { return !!n.parent || n.data.additionalMarriage; });
            var boundLinks = svg
                .select('g')
                .selectAll('path.link')
                .data(links, linkId);
            var path = boundLinks
                .enter()
                .insert('path', 'g')
                .attr('class', function (node) {
                return node.data.additionalMarriage ? 'link additional-marriage' : 'link';
            })
                .attr('d', function (node) { return link(node.parent, node); });
            var transitionsPending = boundLinks.exit().size() + boundLinks.size() + path.size();
            var transitionDone = function () {
                transitionsPending--;
                if (transitionsPending === 0) {
                    resolve();
                }
            };
            if (!_this.options.animate || transitionsPending === 0) {
                resolve();
            }
            var linkTransition = _this.options.animate
                ? boundLinks
                    .transition()
                    .delay(HIDE_TIME_MS)
                    .duration(MOVE_TIME_MS)
                    .on('end', transitionDone)
                : boundLinks;
            linkTransition.attr('d', function (node) { return link(node.parent, node); });
            if (_this.options.animate) {
                path
                    .style('opacity', 0)
                    .transition()
                    .delay(2 * HIDE_TIME_MS + MOVE_TIME_MS)
                    .duration(0)
                    .style('opacity', 1)
                    .on('end', transitionDone);
            }
            if (_this.options.animate) {
                boundLinks
                    .exit()
                    .transition()
                    .duration(0)
                    .style('opacity', 0)
                    .remove()
                    .on('end', transitionDone);
            }
            else {
                boundLinks.exit().remove();
            }
        });
        return animationPromise;
    };
    ChartUtil.prototype.renderExpander = function (nodes, stateGetter, clickCallback) {
        nodes = nodes.filter(function (node) { return stateGetter(node) !== undefined; });
        nodes.on('click', function (event, data) {
            clickCallback === null || clickCallback === void 0 ? void 0 : clickCallback(data.id);
        });
        nodes.append('rect').attr('width', 12).attr('height', 12);
        nodes
            .append('line')
            .attr('x1', 3)
            .attr('y1', 6)
            .attr('x2', 9)
            .attr('y2', 6)
            .attr('stroke', 'black');
        nodes
            .filter(function (node) { return stateGetter(node) === api_1.ExpanderState.PLUS; })
            .append('line')
            .attr('x1', 6)
            .attr('y1', 3)
            .attr('x2', 6)
            .attr('y2', 9)
            .attr('stroke', 'black');
    };
    ChartUtil.prototype.renderFamilyControls = function (nodes) {
        var _this = this;
        var boundNodes = nodes
            .selectAll('g.familyExpander')
            .data(function (node) { var _a; return (((_a = node.data.family) === null || _a === void 0 ? void 0 : _a.expander) !== undefined ? [node] : []); });
        var nodeEnter = boundNodes
            .enter()
            .append('g')
            .attr('class', 'familyExpander expander');
        var merged = nodeEnter.merge(boundNodes);
        var updateTransition = this.options.animate
            ? merged.transition().delay(HIDE_TIME_MS).duration(MOVE_TIME_MS)
            : merged;
        updateTransition.attr('transform', function (node) {
            var anchor = _this.options.renderer.getFamilyAnchor(node.data);
            return "translate(".concat(anchor[0] - 6, ", ").concat(-node.data.height / 2 + (0, composite_renderer_1.getVSize)(node.data, !!_this.options.horizontal), ")");
        });
        this.renderExpander(merged, function (node) { var _a; return (_a = node.data.family) === null || _a === void 0 ? void 0 : _a.expander; }, function (id) { var _a, _b; return (_b = (_a = _this.options).expanderCallback) === null || _b === void 0 ? void 0 : _b.call(_a, id, api_1.ExpanderDirection.FAMILY); });
        boundNodes.exit().remove();
    };
    ChartUtil.prototype.renderIndiControls = function (nodes) {
        var _this = this;
        var boundNodes = nodes
            .selectAll('g.indiExpander')
            .data(function (node) { var _a; return (((_a = node.data.indi) === null || _a === void 0 ? void 0 : _a.expander) !== undefined ? [node] : []); });
        var nodeEnter = boundNodes
            .enter()
            .append('g')
            .attr('class', 'indiExpander expander');
        var merged = nodeEnter.merge(boundNodes);
        var updateTransition = this.options.animate
            ? merged.transition().delay(HIDE_TIME_MS).duration(MOVE_TIME_MS)
            : merged;
        updateTransition.attr('transform', function (node) {
            var anchor = _this.options.renderer.getIndiAnchor(node.data);
            return "translate(".concat(anchor[0] - 6, ", ").concat(-node.data.height / 2 - 12, ")");
        });
        this.renderExpander(merged, function (node) { var _a; return (_a = node.data.indi) === null || _a === void 0 ? void 0 : _a.expander; }, function (id) { var _a, _b; return (_b = (_a = _this.options).expanderCallback) === null || _b === void 0 ? void 0 : _b.call(_a, id, api_1.ExpanderDirection.INDI); });
        boundNodes.exit().remove();
    };
    ChartUtil.prototype.renderSpouseControls = function (nodes) {
        var _this = this;
        var boundNodes = nodes
            .selectAll('g.spouseExpander')
            .data(function (node) { var _a; return (((_a = node.data.spouse) === null || _a === void 0 ? void 0 : _a.expander) !== undefined ? [node] : []); });
        var nodeEnter = boundNodes
            .enter()
            .append('g')
            .attr('class', 'spouseExpander expander');
        var merged = nodeEnter.merge(boundNodes);
        var updateTransition = this.options.animate
            ? merged.transition().delay(HIDE_TIME_MS).duration(MOVE_TIME_MS)
            : merged;
        updateTransition.attr('transform', function (node) {
            var anchor = _this.options.renderer.getSpouseAnchor(node.data);
            return "translate(".concat(anchor[0] - 6, ", ").concat(-node.data.height / 2 - 12, ")");
        });
        this.renderExpander(merged, function (node) { var _a; return (_a = node.data.spouse) === null || _a === void 0 ? void 0 : _a.expander; }, function (id) { var _a, _b; return (_b = (_a = _this.options).expanderCallback) === null || _b === void 0 ? void 0 : _b.call(_a, id, api_1.ExpanderDirection.SPOUSE); });
        boundNodes.exit().remove();
    };
    ChartUtil.prototype.renderControls = function (nodes, svg) {
        var _this = this;
        if (!this.options.expanders) {
            return Promise.resolve();
        }
        var animationPromise = new Promise(function (resolve) {
            var boundNodes = svg
                .select('g')
                .selectAll('g.controls')
                .data(nodes, function (d) { return d.id; });
            var nodeEnter = boundNodes
                .enter()
                .append('g')
                .attr('class', 'controls');
            nodeEnter.attr('transform', function (node) {
                return "translate(".concat(node.x, ", ").concat(node.y, ")");
            });
            var transitionsPending = boundNodes.exit().size() + boundNodes.size() + nodeEnter.size();
            var transitionDone = function () {
                transitionsPending--;
                if (transitionsPending === 0) {
                    resolve();
                }
            };
            if (!_this.options.animate || transitionsPending === 0) {
                resolve();
            }
            var updateTransition = _this.options.animate
                ? boundNodes
                    .transition()
                    .delay(HIDE_TIME_MS)
                    .duration(MOVE_TIME_MS)
                    .on('end', transitionDone)
                : boundNodes;
            updateTransition.attr('transform', function (node) {
                return "translate(".concat(node.x, ", ").concat(node.y, ")");
            });
            if (_this.options.animate) {
                nodeEnter
                    .style('opacity', 0)
                    .transition()
                    .delay(HIDE_TIME_MS + MOVE_TIME_MS)
                    .duration(HIDE_TIME_MS)
                    .style('opacity', 1)
                    .on('end', transitionDone);
            }
            var merged = nodeEnter.merge(boundNodes);
            _this.renderFamilyControls(merged);
            _this.renderIndiControls(merged);
            _this.renderSpouseControls(merged);
            if (_this.options.animate) {
                boundNodes
                    .exit()
                    .transition()
                    .duration(HIDE_TIME_MS)
                    .style('opacity', 0)
                    .remove()
                    .on('end', transitionDone);
            }
            else {
                boundNodes.exit().remove();
            }
        });
        return animationPromise;
    };
    ChartUtil.prototype.getSvgForRendering = function () {
        var svg = (0, d3_selection_1.select)(this.options.svgSelector);
        if (svg.select('g').empty()) {
            svg.append('g');
        }
        return svg;
    };
    return ChartUtil;
}());
exports.ChartUtil = ChartUtil;
