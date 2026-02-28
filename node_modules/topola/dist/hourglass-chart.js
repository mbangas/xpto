"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HourglassChart = void 0;
var ancestor_chart_1 = require("./ancestor-chart");
var chart_util_1 = require("./chart-util");
var descendant_chart_1 = require("./descendant-chart");
/**
 * Renders an hourglass chart. It consists of an ancestor chart and
 * a descendant chart for a family.
 */
var HourglassChart = /** @class */ (function () {
    function HourglassChart(options) {
        this.options = options;
        this.util = new chart_util_1.ChartUtil(options);
    }
    HourglassChart.prototype.render = function () {
        var _a, _b, _c, _d;
        var ancestorsRoot = (0, ancestor_chart_1.getAncestorsTree)(this.options);
        var ancestorNodes = this.util.layOutChart(ancestorsRoot, {
            flipVertically: true,
        });
        var descendantNodes = (0, descendant_chart_1.layOutDescendants)(this.options);
        // The first ancestor node and descendant node is the start node.
        if (((_a = ancestorNodes[0].data.indi) === null || _a === void 0 ? void 0 : _a.expander) !== undefined) {
            descendantNodes[0].data.indi.expander =
                (_b = ancestorNodes[0].data.indi) === null || _b === void 0 ? void 0 : _b.expander;
        }
        if (((_c = ancestorNodes[0].data.spouse) === null || _c === void 0 ? void 0 : _c.expander) !== undefined) {
            descendantNodes[0].data.spouse.expander =
                (_d = ancestorNodes[0].data.spouse) === null || _d === void 0 ? void 0 : _d.expander;
        }
        // slice(1) removes the duplicated start node.
        var nodes = ancestorNodes.slice(1).concat(descendantNodes);
        var animationPromise = this.util.renderChart(nodes);
        var info = (0, chart_util_1.getChartInfo)(nodes);
        this.util.updateSvgDimensions(info);
        return Object.assign(info, { animationPromise: animationPromise });
    };
    return HourglassChart;
}());
exports.HourglassChart = HourglassChart;
