"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleRenderer = void 0;
var d3_selection_1 = require("d3-selection");
var composite_renderer_1 = require("./composite-renderer");
var MIN_HEIGHT = 27;
var MIN_WIDTH = 50;
/** Calculates the length of the given text in pixels when rendered. */
function getLength(text) {
    var g = (0, d3_selection_1.select)('svg').append('g').attr('class', 'simple node');
    var x = g.append('text').attr('class', 'name').text(text);
    var w = x.node().getComputedTextLength();
    g.remove();
    return w;
}
function getName(indi) {
    return [indi.getFirstName() || '', indi.getLastName() || ''].join(' ');
}
function getYears(indi) {
    var birthDate = indi.getBirthDate();
    var birthYear = birthDate && birthDate.date && birthDate.date.year;
    var deathDate = indi.getDeathDate();
    var deathYear = deathDate && deathDate.date && deathDate.date.year;
    if (!birthYear && !deathYear) {
        return '';
    }
    return "".concat(birthYear || '', " \u2013 ").concat(deathYear || '');
}
/**
 * Simple rendering of an individual box showing only the person's name and
 * years of birth and death.
 */
var SimpleRenderer = /** @class */ (function (_super) {
    __extends(SimpleRenderer, _super);
    function SimpleRenderer(options) {
        var _this = _super.call(this, options) || this;
        _this.options = options;
        return _this;
    }
    SimpleRenderer.prototype.getPreferredIndiSize = function (id) {
        var indi = this.options.data.getIndi(id);
        var years = getYears(indi);
        var width = Math.max(getLength(getName(indi)) + 8, getLength(years), MIN_WIDTH);
        var height = years ? MIN_HEIGHT + 14 : MIN_HEIGHT;
        return [width, height];
    };
    SimpleRenderer.prototype.render = function (enter, update) {
        var _this = this;
        var selection = enter.merge(update).append('g').attr('class', 'simple');
        this.renderIndi(selection, function (node) { return node.indi; });
        var spouseSelection = selection
            .filter(function (node) { return !!node.data.spouse; })
            .append('g')
            .attr('transform', function (node) {
            return _this.options.horizontal
                ? "translate(0, ".concat(node.data.indi.height, ")")
                : "translate(".concat(node.data.indi.width, ", 0)");
        });
        this.renderIndi(spouseSelection, function (node) { return node.spouse; });
    };
    SimpleRenderer.prototype.getCss = function () {
        return "\n.simple text {\n  font: 12px sans-serif;\n}\n\n.simple .name {\n  font-weight: bold;\n}\n\n.simple rect {\n  fill: #fff;\n  stroke: black;\n}\n\n.link {\n  fill: none;\n  stroke: #000;\n  stroke-width: 1px;\n}\n\n.additional-marriage {\n  stroke-dasharray: 2;\n}";
    };
    SimpleRenderer.prototype.renderIndi = function (selection, indiFunc) {
        var _this = this;
        // Optionally add a link.
        var group = this.options.indiHrefFunc
            ? selection
                .append('a')
                .attr('href', function (node) {
                return _this.options.indiHrefFunc(indiFunc(node.data).id);
            })
            : selection;
        // Box.
        group
            .append('rect')
            .attr('width', function (node) { return indiFunc(node.data).width; })
            .attr('height', function (node) { return indiFunc(node.data).height; });
        // Text.
        group
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('class', 'name')
            .attr('transform', function (node) { return "translate(".concat(indiFunc(node.data).width / 2, ", 17)"); })
            .text(function (node) {
            return getName(_this.options.data.getIndi(indiFunc(node.data).id));
        });
        group
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('class', 'details')
            .attr('transform', function (node) { return "translate(".concat(indiFunc(node.data).width / 2, ", 33)"); })
            .text(function (node) {
            return getYears(_this.options.data.getIndi(indiFunc(node.data).id));
        });
    };
    return SimpleRenderer;
}(composite_renderer_1.CompositeRenderer));
exports.SimpleRenderer = SimpleRenderer;
