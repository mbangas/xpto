"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KinshipChartRenderer = void 0;
var d3_array_1 = require("d3-array");
var api_1 = require("./api");
var chart_util_1 = require("../chart-util");
var utils_1 = require("../utils");
var LINKS_BASE_OFFSET = 17;
var PARENT_LINK_ANCHOR_X_OFFSET = 15;
var SIBLING_LINK_ANCHOR_Y_OFFSET = 5;
var SIBLING_LINK_STARTER_LENGTH = 7;
var LINKS_SEPARATION = 6;
var LINK_STUB_CIRCLE_R = 3;
var KinshipChartRenderer = /** @class */ (function () {
    function KinshipChartRenderer(options) {
        this.options = options;
        this.util = new chart_util_1.ChartUtil(this.options);
    }
    KinshipChartRenderer.prototype.layOut = function (upRoot, downRoot) {
        var svg = this.util.getSvgForRendering();
        // Add styles so that calculating text size is correct.
        if (svg.select('style').empty()) {
            svg.append('style').text(this.options.renderer.getCss());
        }
        return [
            this.util.layOutChart(upRoot, { flipVertically: true }),
            this.util.layOutChart(downRoot),
        ];
    };
    KinshipChartRenderer.prototype.render = function (upNodes, downNodes, rootsCount) {
        var _this = this;
        var allNodes = upNodes.concat(downNodes);
        var allNodesDeduped = allNodes.slice(1); // Remove duplicate start/center node
        // Prepare for rendering
        upNodes.forEach(function (node) { return _this.setLinkYs(node, true); });
        downNodes.forEach(function (node) { return _this.setLinkYs(node, false); });
        // Render chart
        var animationPromise = this.util.renderNodes(allNodesDeduped, this.util.getSvgForRendering());
        this.renderLinks(allNodes);
        if (rootsCount > 1) {
            this.renderRootDummyAdditionalMarriageLinkStub(allNodes[0]);
        }
        var info = (0, chart_util_1.getChartInfo)(allNodesDeduped);
        this.util.updateSvgDimensions(info);
        return Object.assign(info, { animationPromise: animationPromise });
    };
    KinshipChartRenderer.prototype.renderLinks = function (nodes) {
        var _this = this;
        var svgg = this.util.getSvgForRendering().select('g');
        var keyFn = function (d) { return d.data.id; };
        // Render links
        var boundLinkNodes = svgg.selectAll('path.internode-link').data(nodes.filter(function (n) { return !!n.parent; }), keyFn);
        boundLinkNodes
            .enter()
            .insert('path', 'g')
            .attr('class', function (node) { return _this.cssClassForLink(node); })
            .merge(boundLinkNodes)
            .attr('d', function (node) {
            var linkPoints = node.data.primaryMarriage
                ? _this.additionalMarriageLinkPoints(node)
                : _this.linkPoints(node.parent, node, node.data.linkFromParentType);
            return (0, utils_1.points2pathd)(linkPoints);
        });
        boundLinkNodes.exit().remove();
        // Render link stubs container "g" element
        var boundLinkStubNodes = svgg.selectAll('g.link-stubs').data(nodes.filter(function (n) {
            return n.data.duplicateOf || n.data.duplicated || n.data.primaryMarriage;
        }), keyFn);
        var linkStubNodesEnter = boundLinkStubNodes
            .enter()
            .insert('g', 'g')
            .attr('class', 'link-stubs');
        boundLinkStubNodes.exit().remove();
        // Render link stubs
        var boundLinkStubs = linkStubNodesEnter
            .merge(boundLinkStubNodes)
            .selectAll('g')
            .data(function (node) { return _this.nodeToLinkStubRenderInfos(node); }, function (d) { return d.linkType.toString(); });
        boundLinkStubs
            .enter()
            .append('g')
            .call(function (g) {
            return g
                .append('path')
                .attr('class', function (d) { return _this.cssClassForLinkStub(d.linkType); })
                .merge(boundLinkStubs.select('path.link-stub'))
                .attr('d', function (d) { return (0, utils_1.points2pathd)(d.points); });
        })
            .call(function (g) {
            return g
                .append('circle')
                .attr('r', LINK_STUB_CIRCLE_R)
                .style('stroke', 'black')
                .style('fill', 'none')
                .merge(boundLinkStubs.select('circle'))
                .attr('transform', function (d) {
                return "translate(".concat((0, utils_1.last)(d.points).x, ", ").concat((0, utils_1.last)(d.points).y + LINK_STUB_CIRCLE_R * d.treeDir, ")");
            });
        });
        boundLinkStubs.exit().remove();
    };
    KinshipChartRenderer.prototype.cssClassForLink = function (fromNode) {
        if (fromNode.data.primaryMarriage) {
            return 'link internode-link additional-marriage';
        }
        return ('link internode-link ' +
            this.cssClassForLinkType(fromNode.data.linkFromParentType));
    };
    KinshipChartRenderer.prototype.cssClassForLinkStub = function (linkType) {
        return 'link link-stub ' + this.cssClassForLinkType(linkType);
    };
    KinshipChartRenderer.prototype.cssClassForLinkType = function (linkType) {
        switch (linkType) {
            case api_1.LinkType.IndiParents:
            case api_1.LinkType.SpouseParents:
                return 'parents-link';
            case api_1.LinkType.IndiSiblings:
            case api_1.LinkType.SpouseSiblings:
                return 'siblings-link';
            case api_1.LinkType.Children:
                return 'children-link';
        }
    };
    KinshipChartRenderer.prototype.nodeToLinkStubRenderInfos = function (node) {
        var _this = this;
        return node.data.linkStubs.map(function (linkType) {
            var isUpTree = node.y < node.parent.y;
            var treeDir = isUpTree ? -1 : 1;
            var anchorPoints = _this.linkAnchorPoints(node, linkType, isUpTree);
            var y = node.data.linkYs.children -
                (2 * LINKS_SEPARATION + 2 * LINK_STUB_CIRCLE_R) * treeDir;
            return {
                treeDir: treeDir,
                linkType: linkType,
                points: __spreadArray(__spreadArray([], anchorPoints, true), [{ x: (0, utils_1.last)(anchorPoints).x, y: y }], false),
            };
        });
    };
    KinshipChartRenderer.prototype.getLinkY = function (node, type) {
        switch (type) {
            case api_1.LinkType.IndiParents:
                return node.data.linkYs.indi;
            case api_1.LinkType.IndiSiblings:
                return node.data.linkYs.indi;
            case api_1.LinkType.SpouseParents:
                return node.data.linkYs.spouse;
            case api_1.LinkType.SpouseSiblings:
                return node.data.linkYs.spouse;
            case api_1.LinkType.Children:
                return node.data.linkYs.children;
        }
    };
    KinshipChartRenderer.prototype.setLinkYs = function (node, isUpTree) {
        var treeDir = isUpTree ? -1 : 1;
        var base = node.y + (node.data.height / 2 + LINKS_BASE_OFFSET) * treeDir;
        var offset = LINKS_SEPARATION * treeDir;
        var _a = this.calcLinkOffsetDirs(node), indiOffsetDir = _a[0], spouseOffsetDir = _a[1];
        node.data.linkYs = {
            indi: base + offset * indiOffsetDir,
            spouse: base + offset * spouseOffsetDir,
            children: base,
        };
    };
    /***
     * Calculates indi (indiParent and indiSiblings) and spouse (spouseParent and spouseSiblings)
     * links offset directions, so they don't merge/collide with children links and with each other.
     ***/
    KinshipChartRenderer.prototype.calcLinkOffsetDirs = function (node) {
        var childNodes = node.data.childNodes;
        if (childNodes.children.length) {
            // Check children-indi and children-spouse links collisions
            var indiParentLinkAnchorX = this.linkAnchorPoints(node, api_1.LinkType.IndiParents, true)[0].x;
            var spouseParentLinkAnchorX = this.linkAnchorPoints(node, api_1.LinkType.SpouseParents, true)[0].x;
            var childrenLinksX = {
                min: this.findMinXOfChildNodesAnchors(node, childNodes.children),
                max: this.findMaxXOfChildNodesAnchors(node, childNodes.children),
            };
            if (childrenLinksX.min < indiParentLinkAnchorX &&
                childrenLinksX.max > spouseParentLinkAnchorX) {
                return [-1, -1]; // This shouldn't happen! It can't happen with start node, because start node have children links going down and other links going up. It can't happen with non-start node, as there can't be outgoing indi, spouse and children links at the same time on non-start node. -- But.. It might be useful to not remove it, so that this function might be used when constructing links for other types of charts.
            }
            else if (childrenLinksX.min < indiParentLinkAnchorX) {
                return [-1, 1];
            }
            else if (childrenLinksX.max > spouseParentLinkAnchorX) {
                return [1, -1];
            }
        }
        else if ((childNodes.indiParents.length || childNodes.indiSiblings.length) &&
            (childNodes.spouseParents.length || childNodes.spouseSiblings.length)) {
            // Check indi-spouse links collision
            var indiParentLinkAnchorX = this.linkAnchorPoints(node, api_1.LinkType.IndiParents, true)[0].x;
            var spouseLinksMinX = this.findMinXOfChildNodesAnchors(node, childNodes.spouseSiblings.concat(childNodes.spouseParents));
            if (spouseLinksMinX < indiParentLinkAnchorX) {
                return [-1, 1];
            }
        }
        return [1, -1];
    };
    KinshipChartRenderer.prototype.findMinXOfChildNodesAnchors = function (parentNode, childNodes) {
        return this.findExtremeXOfChildNodesAnchors(parentNode, childNodes, true);
    };
    KinshipChartRenderer.prototype.findMaxXOfChildNodesAnchors = function (parentNode, childNodes) {
        return this.findExtremeXOfChildNodesAnchors(parentNode, childNodes, false);
    };
    KinshipChartRenderer.prototype.findExtremeXOfChildNodesAnchors = function (parentNode, childNodes, isMin) {
        var extremeFindingFunction = isMin ? d3_array_1.min : d3_array_1.max;
        var dir = isMin ? -1 : 1;
        var childNodesSet = new Set(childNodes);
        return (extremeFindingFunction(parentNode.children.filter(function (n) { return childNodesSet.has(n.data); }), function (n) { return n.x + (dir * n.data.width) / 2; }) +
            dir * SIBLING_LINK_STARTER_LENGTH);
    };
    KinshipChartRenderer.prototype.linkPoints = function (from, to, type) {
        var isUpTree = from.y > to.y;
        var pointsFrom = this.linkAnchorPoints(from, type, isUpTree);
        var pointsTo = this.linkAnchorPoints(to, (0, api_1.otherSideLinkType)(type), !isUpTree).reverse();
        var y = this.getLinkY(from, type);
        return __spreadArray(__spreadArray(__spreadArray([], pointsFrom, true), [
            { x: pointsFrom[pointsFrom.length - 1].x, y: y },
            { x: pointsTo[0].x, y: y }
        ], false), pointsTo, true);
    };
    KinshipChartRenderer.prototype.additionalMarriageLinkPoints = function (node) {
        var nodeIndex = node.parent.children.findIndex(function (n) { return n.data.id === node.data.id; });
        var prevSiblingNode = node.parent.children[nodeIndex - 1];
        var y = this.indiMidY(node);
        return [
            { x: prevSiblingNode.x, y: y },
            { x: node.x, y: y },
        ];
    };
    KinshipChartRenderer.prototype.linkAnchorPoints = function (node, type, top) {
        var _a = [node.x, node.y], x = _a[0], y = _a[1];
        var _b = [node.data.width, node.data.height], w = _b[0], h = _b[1];
        var leftEdge = x - w / 2;
        var rightEdge = x + w / 2;
        var _c = [
            node.data.indi,
            node.data.spouse,
            node.data.family,
        ].map(function (e) { return (e ? e.width : 0); }), indiW = _c[0], spouseW = _c[1], familyW = _c[2];
        var indisW = indiW + spouseW;
        var indisLeftEdge = x - w / 2 + (familyW > indisW ? (familyW - indisW) / 2 : 0);
        var indisRightEdge = indisLeftEdge + indisW;
        var siblingAnchorY = this.indiMidY(node) + SIBLING_LINK_ANCHOR_Y_OFFSET * (top ? -1 : 1);
        switch (type) {
            case api_1.LinkType.IndiParents:
                return [
                    { x: indisLeftEdge + PARENT_LINK_ANCHOR_X_OFFSET, y: y - h / 2 },
                ];
            case api_1.LinkType.SpouseParents:
                return [
                    { x: indisRightEdge - PARENT_LINK_ANCHOR_X_OFFSET, y: y - h / 2 },
                ];
            case api_1.LinkType.IndiSiblings:
                return [
                    { x: indisLeftEdge, y: siblingAnchorY },
                    {
                        x: (familyW > indisW && !top ? leftEdge : indisLeftEdge) -
                            SIBLING_LINK_STARTER_LENGTH,
                        y: siblingAnchorY,
                    },
                ];
            case api_1.LinkType.SpouseSiblings:
                return [
                    { x: indisRightEdge, y: siblingAnchorY },
                    {
                        x: (familyW > indisW && !top ? rightEdge : indisRightEdge) +
                            SIBLING_LINK_STARTER_LENGTH,
                        y: siblingAnchorY,
                    },
                ];
            case api_1.LinkType.Children:
                return [
                    { x: indisLeftEdge + (node.data.spouse ? indiW : indiW / 2), y: y },
                ];
        }
    };
    KinshipChartRenderer.prototype.indiMidY = function (node) {
        return node.y - node.data.height / 2 + node.data.indi.height / 2;
    };
    KinshipChartRenderer.prototype.renderRootDummyAdditionalMarriageLinkStub = function (root) {
        var svgg = this.util.getSvgForRendering().select('g');
        var y = this.indiMidY(root);
        var x = root.data.width / 2 + 20;
        var r = 3;
        svgg.selectAll('.root-dummy-additional-marriage').remove();
        svgg
            .insert('g', 'g')
            .attr('class', 'root-dummy-additional-marriage')
            .call(function (g) {
            return g
                .append('path')
                .attr('d', "M 0 ".concat(y, " L ").concat(x, " ").concat(y))
                .attr('class', 'link additional-marriage');
        })
            .call(function (g) {
            return g
                .append('circle')
                .attr('transform', "translate(".concat(x + r, ", ").concat(y, ")"))
                .attr('r', r)
                .style('stroke', 'black')
                .style('fill', 'black');
        });
    };
    return KinshipChartRenderer;
}());
exports.KinshipChartRenderer = KinshipChartRenderer;
