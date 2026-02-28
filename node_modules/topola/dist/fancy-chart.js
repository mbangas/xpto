"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FancyChart = void 0;
var d3_array_1 = require("d3-array");
var chart_util_1 = require("./chart-util");
var descendant_chart_1 = require("./descendant-chart");
/** Returns an SVG line definition for a tree branch between two points. */
function branch(x1, y1, x2, y2) {
    var yMid = y2 + 110;
    if (x2 > x1 + 100) {
        return "\n      M ".concat(x1 + 10, "       ").concat(y1, "\n      C ").concat(x1 + 10, "       ").concat(yMid + 25, "\n        ").concat(x1 + 45, "       ").concat(yMid + 10, "\n        ").concat((x1 + x2) / 2, " ").concat(yMid + 5, "\n        ").concat(x2 - 45, "       ").concat(yMid, "\n        ").concat(x2 + 2, "        ").concat(yMid - 25, "\n        ").concat(x2 + 2, "        ").concat(y2, "\n      L ").concat(x2 - 2, "        ").concat(y2, "\n      C ").concat(x2 - 2, "        ").concat(yMid - 25, "\n        ").concat(x2 - 45, "       ").concat(yMid - 10, "\n        ").concat((x1 + x2) / 2, " ").concat(yMid - 5, "\n        ").concat(x1 + 45, "       ").concat(yMid, "\n        ").concat(x1 - 10, "       ").concat(yMid + 25, "\n        ").concat(x1 - 10, "       ").concat(y1);
    }
    if (x2 < x1 - 100) {
        return "\n      M ".concat(x1 - 10, "       ").concat(y1, "\n      C ").concat(x1 - 10, "       ").concat(yMid + 25, "\n        ").concat(x1 - 45, "       ").concat(yMid + 10, "\n        ").concat((x1 + x2) / 2, " ").concat(yMid + 5, "\n        ").concat(x2 + 45, "       ").concat(yMid, "\n        ").concat(x2 - 2, "        ").concat(yMid - 25, "\n        ").concat(x2 - 2, "        ").concat(y2, "\n      L ").concat(x2 + 2, "        ").concat(y2, "\n      C ").concat(x2 + 2, "        ").concat(yMid - 25, "\n        ").concat(x2 + 45, "       ").concat(yMid - 10, "\n        ").concat((x1 + x2) / 2, " ").concat(yMid - 5, "\n        ").concat(x1 - 45, "       ").concat(yMid, "\n        ").concat(x1 + 10, "       ").concat(yMid + 25, "\n        ").concat(x1 + 10, "       ").concat(y1);
    }
    return "\n    M ".concat(x1 + 10, "       ").concat(y1, "\n    C ").concat(x1 + 10, "       ").concat(yMid + 25, "\n      ").concat(x2 + 2, "        ").concat(yMid - 25, "\n      ").concat(x2 + 2, "        ").concat(y2, "\n    L ").concat(x2 - 2, "        ").concat(y2, "\n    C ").concat(x2 - 2, "        ").concat(yMid - 25, "\n      ").concat(x1 - 10, "       ").concat(yMid + 25, "\n      ").concat(x1 - 10, "       ").concat(y1);
}
/** Renders a fancy descendants tree chart. */
var FancyChart = /** @class */ (function () {
    function FancyChart(options) {
        this.options = options;
        this.util = new chart_util_1.ChartUtil(options);
    }
    /** Creates a path from parent to the child node (vertical layout). */
    FancyChart.prototype.linkVertical = function (s, d) {
        var sAnchor = this.options.renderer.getFamilyAnchor(s.data);
        var dAnchor = s.id === d.data.spouseParentNodeId
            ? this.options.renderer.getSpouseAnchor(d.data)
            : this.options.renderer.getIndiAnchor(d.data);
        var _a = [s.x + sAnchor[0], s.y + sAnchor[1]], sx = _a[0], sy = _a[1];
        var _b = [d.x + dAnchor[0], d.y + dAnchor[1]], dx = _b[0], dy = _b[1];
        return branch(dx, dy, sx, sy);
    };
    FancyChart.prototype.linkAdditionalMarriage = function (node) {
        var nodeIndex = node.parent.children.findIndex(function (n) { return n.id === node.id; });
        // Assert nodeIndex > 0.
        var siblingNode = node.parent.children[nodeIndex - 1];
        var sAnchor = this.options.renderer.getIndiAnchor(node.data);
        var dAnchor = this.options.renderer.getIndiAnchor(siblingNode.data);
        var _a = [node.x + sAnchor[0], node.y + sAnchor[1]], sx = _a[0], sy = _a[1];
        var _b = [siblingNode.x + dAnchor[0], siblingNode.y + dAnchor[1]], dx = _b[0], dy = _b[1];
        return "M ".concat(sx, ", ").concat(sy + 2, "\n              L ").concat(dx, ", ").concat(dy + 10, "\n              ").concat(dx, ", ").concat(dy - 10, "\n              ").concat(sx, ", ").concat(sy - 2);
    };
    FancyChart.prototype.renderBackground = function (chartInfo, svg) {
        svg
            .select('g')
            .append('rect')
            .attr('x', -chartInfo.origin[0])
            .attr('y', -chartInfo.origin[1])
            .attr('width', chartInfo.size[0])
            .attr('height', chartInfo.origin[1])
            .attr('fill', '#cff');
        svg
            .select('g')
            .append('rect')
            .attr('x', -chartInfo.origin[0])
            .attr('y', 0)
            .attr('width', chartInfo.size[0])
            .attr('height', chartInfo.size[1] - chartInfo.origin[1])
            .attr('fill', '#494');
    };
    FancyChart.prototype.renderLeaves = function (nodes, svg) {
        var gradient = svg
            .select('g')
            .append('radialGradient')
            .attr('id', 'gradient');
        gradient.append('stop').attr('offset', '0%').attr('stop-color', '#8f8');
        gradient
            .append('stop')
            .attr('offset', '80%')
            .attr('stop-color', '#8f8')
            .attr('stop-opacity', 0.5);
        gradient
            .append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#8f8')
            .attr('stop-opacity', 0);
        var backgroundNodes = nodes.filter(function (n) { return n.parent && n.parent.id !== descendant_chart_1.DUMMY_ROOT_NODE_ID; });
        var minGeneration = (0, d3_array_1.min)(backgroundNodes, function (node) { return node.data.generation; }) || 0;
        var sizeFunction = function (node) {
            return 280 - 180 / Math.sqrt(1 + node.data.generation - minGeneration);
        };
        {
            var boundNodes = svg
                .select('g')
                .selectAll('g.background')
                .data(backgroundNodes, function (d) { return d.id; });
            var enter = boundNodes.enter().append('g');
            enter
                .merge(boundNodes)
                .attr('class', 'background')
                .attr('transform', function (node) {
                return "translate(".concat(node.x - node.data.width / 2, ", ").concat(node.y - node.data.height / 2, ")");
            });
            var background = enter.append('g').attr('class', 'background');
            background
                .append('circle')
                .attr('class', 'background')
                .attr('r', sizeFunction)
                .attr('cx', function (node) { return node.data.width / 2; })
                .attr('cy', function (node) { return node.data.height / 2; })
                .style('fill', '#493');
        }
        {
            var boundNodes = svg
                .select('g')
                .selectAll('g.background2')
                .data(backgroundNodes, function (d) { return d.id; });
            var enter = boundNodes.enter().append('g');
            enter
                .merge(boundNodes)
                .attr('class', 'background2')
                .attr('transform', function (node) {
                return "translate(".concat(node.x - node.data.width / 2, ", ").concat(node.y - node.data.height / 2, ")");
            });
            var background = enter.append('g').attr('class', 'background2');
            background
                .append('circle')
                .attr('class', 'background')
                .attr('r', sizeFunction)
                .attr('cx', function (node) { return node.data.width / 2; })
                .attr('cy', function (node) { return node.data.height / 2; })
                .style('fill', 'url(#gradient)');
        }
    };
    FancyChart.prototype.renderLinks = function (nodes, svg) {
        var _this = this;
        var link = function (parent, child) {
            if (child.data.additionalMarriage) {
                return _this.linkAdditionalMarriage(child);
            }
            return _this.linkVertical(child, parent);
        };
        var links = nodes.filter(function (n) { return !!n.parent; });
        svg
            .select('g')
            .selectAll('path.branch')
            .data(links, chart_util_1.linkId)
            .enter()
            .append('path')
            .attr('class', function (node) {
            return node.data.additionalMarriage ? 'branch additional-marriage' : 'branch';
        })
            .attr('d', function (node) { return link(node.parent, node); });
    };
    FancyChart.prototype.renderTreeTrunk = function (nodes, svg) {
        var trunkNodes = nodes.filter(function (n) { return !n.parent || n.parent.id === descendant_chart_1.DUMMY_ROOT_NODE_ID; });
        svg
            .select('g')
            .selectAll('g.trunk')
            .data(trunkNodes, function (d) { return d.id; })
            .enter()
            .append('g')
            .attr('class', 'trunk')
            .attr('transform', function (node) { return "translate(".concat(node.x, ", ").concat(node.y, ")"); })
            .append('path')
            .attr('d', "\n          M 10 20\n          L 10 40\n          C 10 60 10 90 40 90\n          L -40 90\n          C -10 90 -10 60 -10 40\n          L -10 20");
    };
    FancyChart.prototype.render = function () {
        var nodes = (0, descendant_chart_1.layOutDescendants)(this.options, {
            flipVertically: true,
            vSpacing: 100,
        });
        var info = (0, chart_util_1.getChartInfo)(nodes);
        info.origin[0] += 150;
        info.origin[1] += 150;
        info.size[0] += 300;
        info.size[1] += 250;
        var svg = this.util.getSvgForRendering();
        svg.append('style').text("\n      .branch, .trunk {\n        fill: #632;\n        stroke: #632;\n      }");
        this.renderBackground(info, svg);
        this.renderLeaves(nodes, svg);
        this.renderLinks(nodes, svg);
        this.renderTreeTrunk(nodes, svg);
        this.util.renderNodes(nodes, svg);
        this.util.updateSvgDimensions(info);
        return Object.assign(info, { animationPromise: Promise.resolve() });
    };
    return FancyChart;
}());
exports.FancyChart = FancyChart;
