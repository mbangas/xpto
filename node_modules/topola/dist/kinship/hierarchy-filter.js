"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HierarchyFilter = void 0;
var HierarchyFilter = /** @class */ (function () {
    function HierarchyFilter(overrides) {
        if (overrides === void 0) { overrides = {}; }
        this.indiParents = true;
        this.indiSiblings = true;
        this.spouseParents = true;
        this.spouseSiblings = true;
        this.children = true;
        this.modify(overrides);
    }
    HierarchyFilter.allAccepting = function () {
        return new HierarchyFilter();
    };
    HierarchyFilter.allRejecting = function () {
        return new HierarchyFilter().modify({
            indiParents: false,
            indiSiblings: false,
            spouseParents: false,
            spouseSiblings: false,
            children: false,
        });
    };
    HierarchyFilter.prototype.modify = function (overrides) {
        Object.assign(this, overrides);
        return this;
    };
    return HierarchyFilter;
}());
exports.HierarchyFilter = HierarchyFilter;
