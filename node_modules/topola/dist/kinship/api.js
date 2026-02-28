"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkType = exports.ChildNodes = void 0;
exports.otherSideLinkType = otherSideLinkType;
var ChildNodes = /** @class */ (function () {
    function ChildNodes(overrides) {
        if (overrides === void 0) { overrides = {}; }
        this.indiParents = [];
        this.indiSiblings = [];
        this.spouseParents = [];
        this.spouseSiblings = [];
        this.children = [];
        Object.assign(this, overrides);
    }
    ChildNodes.prototype.get = function (type) {
        switch (type) {
            case LinkType.IndiParents:
                return this.indiParents;
            case LinkType.IndiSiblings:
                return this.indiSiblings;
            case LinkType.SpouseParents:
                return this.spouseParents;
            case LinkType.SpouseSiblings:
                return this.spouseSiblings;
            case LinkType.Children:
                return this.children;
        }
    };
    ChildNodes.prototype.getAll = function () {
        return [].concat(this.indiSiblings, this.indiParents, this.children, this.spouseParents, this.spouseSiblings);
    };
    ChildNodes.EMPTY = new ChildNodes();
    return ChildNodes;
}());
exports.ChildNodes = ChildNodes;
var LinkType;
(function (LinkType) {
    LinkType[LinkType["IndiParents"] = 0] = "IndiParents";
    LinkType[LinkType["IndiSiblings"] = 1] = "IndiSiblings";
    LinkType[LinkType["SpouseParents"] = 2] = "SpouseParents";
    LinkType[LinkType["SpouseSiblings"] = 3] = "SpouseSiblings";
    LinkType[LinkType["Children"] = 4] = "Children";
})(LinkType || (exports.LinkType = LinkType = {}));
function otherSideLinkType(type) {
    switch (type) {
        case LinkType.IndiParents:
            return LinkType.Children;
        case LinkType.IndiSiblings:
            return LinkType.IndiSiblings;
        case LinkType.SpouseParents:
            return LinkType.Children;
        case LinkType.SpouseSiblings:
            return LinkType.IndiSiblings;
        case LinkType.Children:
            return LinkType.IndiParents;
    }
}
