"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeRenderer = void 0;
exports.getFamPositionVertical = getFamPositionVertical;
exports.getFamPositionHorizontal = getFamPositionHorizontal;
exports.getVSize = getVSize;
var d3_array_1 = require("d3-array");
/**
 * Common code for tree nodes that are composed of individual and family boxes.
 */
var CompositeRenderer = /** @class */ (function () {
    function CompositeRenderer(options) {
        this.options = options;
    }
    CompositeRenderer.prototype.getPreferredFamSize = function (id) {
        // No family box in the simple renderer.
        return [0, 0];
    };
    CompositeRenderer.prototype.setPreferredIndiSize = function (indi) {
        var _a;
        if (!indi) {
            return;
        }
        _a = this.getPreferredIndiSize(indi.id), indi.width = _a[0], indi.height = _a[1];
    };
    CompositeRenderer.prototype.updateNodes = function (nodes) {
        var _this = this;
        // Calculate individual vertical size per depth.
        var indiVSizePerDepth = new Map();
        nodes.forEach(function (node) {
            var _a;
            _this.setPreferredIndiSize(node.data.indi);
            _this.setPreferredIndiSize(node.data.spouse);
            var family = node.data.family;
            if (family) {
                _a = _this.getPreferredFamSize(family.id), family.width = _a[0], family.height = _a[1];
            }
            var depth = node.depth;
            var maxIndiVSize = (0, d3_array_1.max)([
                getIndiVSize(node.data, !!_this.options.horizontal),
                indiVSizePerDepth.get(depth),
            ]);
            indiVSizePerDepth.set(depth, maxIndiVSize);
        });
        // Set same width for each depth.
        nodes.forEach(function (node) {
            var _a;
            if (_this.options.horizontal) {
                if (node.data.indi) {
                    node.data.indi.width = indiVSizePerDepth.get(node.depth);
                }
                if (node.data.spouse) {
                    node.data.spouse.width = indiVSizePerDepth.get(node.depth);
                }
            }
            else {
                if (node.data.indi) {
                    node.data.indi.height = indiVSizePerDepth.get(node.depth);
                }
                if (node.data.spouse) {
                    node.data.spouse.height = indiVSizePerDepth.get(node.depth);
                }
            }
            var vSize = getVSize(node.data, !!_this.options.horizontal);
            var hSize = getHSize(node.data, !!_this.options.horizontal);
            _a = _this.options.horizontal
                ? [vSize, hSize]
                : [hSize, vSize], node.data.width = _a[0], node.data.height = _a[1];
        });
    };
    CompositeRenderer.prototype.getFamilyAnchor = function (node) {
        if (this.options.horizontal) {
            var x_1 = -node.width / 2 + getIndiVSize(node, this.options.horizontal) / 2;
            var famYOffset = node.family
                ? (0, d3_array_1.max)([-getFamPositionHorizontal(node), 0])
                : 0;
            var y_1 = -(node.indi && node.spouse ? node.height / 2 - node.indi.height : 0) +
                famYOffset;
            return [x_1, y_1];
        }
        var famXOffset = node.family
            ? (0, d3_array_1.max)([-getFamPositionVertical(node), 0])
            : 0;
        var x = -(node.indi && node.spouse ? node.width / 2 - node.indi.width : 0) +
            famXOffset;
        var y = -node.height / 2 + getIndiVSize(node, this.options.horizontal) / 2;
        return [x, y];
    };
    CompositeRenderer.prototype.getSpouseAnchor = function (node) {
        if (this.options.horizontal) {
            var x_2 = -node.width / 2 + getIndiVSize(node, this.options.horizontal) / 2;
            var y_2 = node.indi ? node.indi.height / 2 : 0;
            return [x_2, y_2];
        }
        var x = node.indi ? node.indi.width / 2 : 0;
        var y = -node.height / 2 + getIndiVSize(node, !!this.options.horizontal) / 2;
        return [x, y];
    };
    CompositeRenderer.prototype.getIndiAnchor = function (node) {
        if (this.options.horizontal) {
            var x_3 = -node.width / 2 + getIndiVSize(node, this.options.horizontal) / 2;
            var y_3 = node.spouse ? -node.spouse.height / 2 : 0;
            return [x_3, y_3];
        }
        var x = node.spouse ? -node.spouse.width / 2 : 0;
        var y = -node.height / 2 + getIndiVSize(node, !!this.options.horizontal) / 2;
        return [x, y];
    };
    return CompositeRenderer;
}());
exports.CompositeRenderer = CompositeRenderer;
/**
 * Returns the relative position of the family box for the vertical layout.
 */
function getFamPositionVertical(node) {
    var indiWidth = node.indi ? node.indi.width : 0;
    var spouseWidth = node.spouse ? node.spouse.width : 0;
    var familyWidth = node.family.width;
    if (!node.indi || !node.spouse || indiWidth + spouseWidth <= familyWidth) {
        return (indiWidth + spouseWidth - familyWidth) / 2;
    }
    if (familyWidth / 2 >= spouseWidth) {
        return indiWidth + spouseWidth - familyWidth;
    }
    if (familyWidth / 2 >= indiWidth) {
        return 0;
    }
    return indiWidth - familyWidth / 2;
}
/**
 * Returns the relative position of the family box for the horizontal layout.
 */
function getFamPositionHorizontal(node) {
    var indiHeight = node.indi ? node.indi.height : 0;
    var spouseHeight = node.spouse ? node.spouse.height : 0;
    var familyHeight = node.family.height;
    if (!node.indi || !node.spouse) {
        return (indiHeight + spouseHeight - familyHeight) / 2;
    }
    return indiHeight - familyHeight / 2;
}
/** Returns the horizontal size. */
function getHSize(node, horizontal) {
    if (horizontal) {
        return ((node.indi ? node.indi.height : 0) +
            (node.spouse ? node.spouse.height : 0));
    }
    var indiHSize = (node.indi ? node.indi.width : 0) + (node.spouse ? node.spouse.width : 0);
    return (0, d3_array_1.max)([indiHSize, node.family ? node.family.width : 0]);
}
function getFamVSize(node, horizontal) {
    if (horizontal) {
        return node.family ? node.family.width : 0;
    }
    return node.family ? node.family.height : 0;
}
/** Returns the vertical size of individual boxes. */
function getIndiVSize(node, horizontal) {
    if (horizontal) {
        return (0, d3_array_1.max)([
            node.indi ? node.indi.width : 0,
            node.spouse ? node.spouse.width : 0,
        ]);
    }
    return (0, d3_array_1.max)([
        node.indi ? node.indi.height : 0,
        node.spouse ? node.spouse.height : 0,
    ]);
}
/** Returns the vertical size. */
function getVSize(node, horizontal) {
    return getIndiVSize(node, horizontal) + getFamVSize(node, horizontal);
}
