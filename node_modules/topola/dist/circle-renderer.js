"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircleRenderer = void 0;
/** Renders person or married couple inside a sircle. */
var CircleRenderer = /** @class */ (function () {
    function CircleRenderer(options) {
        this.options = options;
    }
    CircleRenderer.prototype.getFamilyAnchor = function (node) {
        return [0, 0];
    };
    CircleRenderer.prototype.getIndiAnchor = function (node) {
        return [0, 0];
    };
    CircleRenderer.prototype.getSpouseAnchor = function (node) {
        return [0, 0];
    };
    CircleRenderer.prototype.updateNodes = function (nodes) {
        nodes.forEach(function (node) {
            var _a;
            _a = node.data.family
                ? [120, 120]
                : [80, 80], node.data.width = _a[0], node.data.height = _a[1];
        });
    };
    CircleRenderer.prototype.getName = function (entry) {
        if (!entry) {
            return '';
        }
        var indi = this.options.data.getIndi(entry.id);
        var firstName = indi.getFirstName();
        return firstName ? firstName.split(' ')[0] : '';
    };
    CircleRenderer.prototype.render = function (enter, update) {
        var _this = this;
        enter = enter.append('g').attr('class', 'circle');
        update = update.select('g');
        enter
            .append('circle')
            .attr('r', function (node) { return node.data.width / 2; })
            .attr('cx', function (node) { return node.data.width / 2; })
            .attr('cy', function (node) { return node.data.height / 2; });
        enter
            .filter(function (node) { return !!node.data.family; })
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('transform', function (node) {
            return "translate(".concat(node.data.width / 2, ", ").concat(node.data.height / 2 - 4, ")");
        })
            .text(function (node) { return _this.getName(node.data.indi); });
        enter
            .filter(function (node) { return !!node.data.family; })
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('transform', function (node) {
            return "translate(".concat(node.data.width / 2, ", ").concat(node.data.height / 2 + 14, ")");
        })
            .text(function (node) { return _this.getName(node.data.spouse); });
        enter
            .filter(function (node) { return !node.data.family; })
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('transform', function (node) {
            return "translate(".concat(node.data.width / 2, ", ").concat(node.data.height / 2 + 4, ")");
        })
            .text(function (node) { return _this.getName(node.data.indi); });
    };
    CircleRenderer.prototype.getCss = function () {
        return "\n    circle {\n      fill: white;\n      stroke: #040;\n      stroke-width: 5px;\n    }\n    .circle text {\n      font-family: verdana, arial, sans-serif;\n      font-size: 12px;\n    }\n    .background {\n      stroke: none;\n    }\n    ";
    };
    return CircleRenderer;
}());
exports.CircleRenderer = CircleRenderer;
