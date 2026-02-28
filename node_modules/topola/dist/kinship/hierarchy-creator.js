"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryId = exports.HierarchyCreator = void 0;
exports.getRootsCount = getRootsCount;
var api_1 = require("./api");
var d3_hierarchy_1 = require("d3-hierarchy");
var hierarchy_filter_1 = require("./hierarchy-filter");
var id_generator_1 = require("../id-generator");
var utils_1 = require("../utils");
var HierarchyCreator = /** @class */ (function () {
    function HierarchyCreator(data, startEntryId) {
        var _a;
        this.data = data;
        this.queuedNodesById = new Map();
        this.idGenerator = new id_generator_1.IdGenerator();
        _a = this.expandStartId(startEntryId), this.startEntryId = _a[0], this.startFamIndi = _a[1];
    }
    HierarchyCreator.createHierarchy = function (data, startEntryId) {
        return new HierarchyCreator(data, startEntryId).createHierarchy();
    };
    // Convert entry id to values of startEntryId and startFamIndi fields
    HierarchyCreator.prototype.expandStartId = function (startEntryId) {
        if (startEntryId.isFam)
            return [startEntryId, null];
        var indi = this.data.getIndi(startEntryId.id);
        if (!indi)
            throw new Error('Invalid startId');
        var famsIds = indi.getFamiliesAsSpouse();
        if (famsIds.length)
            return [EntryId.fam(famsIds[0]), startEntryId.id];
        return [startEntryId, null];
    };
    HierarchyCreator.prototype.createHierarchy = function () {
        var upRoot = this.idToNode(this.startEntryId, null, null, false);
        var downRoot = this.idToNode(this.startEntryId, null, null, false);
        if (!upRoot || !downRoot)
            throw new Error('Invalid root node');
        if (this.startFamIndi) {
            upRoot.indi = { id: this.startFamIndi };
            downRoot.indi = { id: this.startFamIndi };
        }
        var queue = [upRoot, downRoot];
        while (queue.length) {
            var node = queue.shift();
            var filter = node === upRoot
                ? HierarchyCreator.UP_FILTER
                : node === downRoot
                    ? HierarchyCreator.DOWN_FILTER
                    : HierarchyCreator.ALL_ACCEPTING_FILTER; //TODO: Filter only on root node?
            this.fillNodeData(node, filter);
            for (var _i = 0, _a = node.childNodes.getAll(); _i < _a.length; _i++) {
                var childNode = _a[_i];
                queue.push(childNode);
            }
        }
        var getChildNodes = function (node) {
            var childNodes = node.childNodes.getAll();
            return childNodes.length ? childNodes : null;
        };
        return {
            upRoot: (0, d3_hierarchy_1.hierarchy)(upRoot, getChildNodes),
            downRoot: (0, d3_hierarchy_1.hierarchy)(downRoot, getChildNodes),
        };
    };
    HierarchyCreator.prototype.fillNodeData = function (node, filter) {
        if (this.isFamNode(node)) {
            var fam = this.data.getFam(node.id);
            var _a = node.indi && node.indi.id === fam.getMother()
                ? [fam.getMother(), fam.getFather()]
                : [fam.getFather(), fam.getMother()], indiId = _a[0], spouseId = _a[1];
            Object.assign(node, {
                id: this.idGenerator.getId(node.id),
                indi: indiId && { id: indiId },
                spouse: spouseId && { id: spouseId },
            });
            if (!node.duplicateOf && !node.duplicated) {
                node.childNodes = this.childNodesForFam(fam, node, filter);
            }
        }
        else {
            var indi = this.data.getIndi(node.id);
            Object.assign(node, {
                id: this.idGenerator.getId(node.id),
                indi: { id: indi.getId() },
            });
            if (!node.duplicateOf && !node.duplicated) {
                node.childNodes = this.childNodesForIndi(indi, node, filter);
            }
        }
        node.linkStubs = this.createLinkStubs(node);
    };
    HierarchyCreator.prototype.childNodesForFam = function (fam, parentNode, filter) {
        var indi = parentNode.indi ? this.data.getIndi(parentNode.indi.id) : null;
        var spouse = parentNode.spouse
            ? this.data.getIndi(parentNode.spouse.id)
            : null;
        var _a = this.getParentsAndSiblings(indi), indiParentsFamsIds = _a[0], indiSiblingsIds = _a[1];
        var _b = this.getParentsAndSiblings(spouse), spouseParentsFamsIds = _b[0], spouseSiblingsIds = _b[1];
        var childrenIds = fam.getChildren();
        return new api_1.ChildNodes({
            indiParents: filter.indiParents
                ? this.famAsSpouseIdsToNodes(indiParentsFamsIds, parentNode, api_1.LinkType.IndiParents)
                : [],
            indiSiblings: filter.indiSiblings
                ? this.indiIdsToFamAsSpouseNodes(indiSiblingsIds, parentNode, api_1.LinkType.IndiSiblings)
                : [],
            spouseParents: filter.spouseParents
                ? this.famAsSpouseIdsToNodes(spouseParentsFamsIds, parentNode, api_1.LinkType.SpouseParents)
                : [],
            spouseSiblings: filter.spouseSiblings
                ? this.indiIdsToFamAsSpouseNodes(spouseSiblingsIds, parentNode, api_1.LinkType.SpouseSiblings)
                : [],
            children: filter.children
                ? this.indiIdsToFamAsSpouseNodes(childrenIds, parentNode, api_1.LinkType.Children)
                : [],
        });
    };
    HierarchyCreator.prototype.childNodesForIndi = function (indi, parentNode, filter) {
        var _a = this.getParentsAndSiblings(indi), indiParentsFamsIds = _a[0], indiSiblingsIds = _a[1];
        return new api_1.ChildNodes({
            indiParents: filter.indiParents
                ? this.famAsSpouseIdsToNodes(indiParentsFamsIds, parentNode, api_1.LinkType.IndiParents)
                : [],
            indiSiblings: filter.indiSiblings
                ? this.indiIdsToFamAsSpouseNodes(indiSiblingsIds, parentNode, api_1.LinkType.IndiSiblings)
                : [],
        });
    };
    HierarchyCreator.prototype.areParentsAndSiblingsPresent = function (indiId) {
        var indi = indiId && this.data.getIndi(indiId);
        var famcId = indi && indi.getFamilyAsChild();
        var famc = famcId && this.data.getFam(famcId);
        if (!famc)
            return [false, false];
        return [
            !!(famc.getFather() || famc.getMother()),
            famc.getChildren().length > 1,
        ];
    };
    HierarchyCreator.prototype.getParentsAndSiblings = function (indi) {
        var indiFamcId = indi && indi.getFamilyAsChild();
        var indiFamc = this.data.getFam(indiFamcId);
        if (!indiFamc)
            return [[], []];
        var father = this.data.getIndi(indiFamc.getFather());
        var mother = this.data.getIndi(indiFamc.getMother());
        var parentFamsIds = []
            .concat(father ? father.getFamiliesAsSpouse() : [], mother ? mother.getFamiliesAsSpouse() : [])
            .filter(function (id) { return id !== indiFamcId; });
        parentFamsIds.unshift(indiFamcId);
        var siblingsIds = Array.from(indiFamc.getChildren());
        siblingsIds.splice(siblingsIds.indexOf(indi.getId()), 1); // Remove indi from indi's siblings
        return [parentFamsIds, siblingsIds];
    };
    HierarchyCreator.prototype.indiIdsToFamAsSpouseNodes = function (indiIds, parentNode, childNodeType) {
        var _this = this;
        return indiIds.flatMap(function (id) {
            return _this.indiIdToFamAsSpouseNodes(id, parentNode, childNodeType);
        });
    };
    HierarchyCreator.prototype.indiIdToFamAsSpouseNodes = function (indiId, parentNode, childNodeType) {
        var _this = this;
        if (this.isChildNodeTypeForbidden(childNodeType, parentNode))
            return [];
        var famsIds = this.data.getIndi(indiId).getFamiliesAsSpouse();
        if (!famsIds.length) {
            var node = this.idToNode(EntryId.indi(indiId), parentNode, childNodeType);
            return node ? [node] : [];
        }
        var famsNodes = famsIds.map(function (id) {
            return {
                id: id,
                indi: { id: indiId },
                family: { id: id },
                parentNode: parentNode,
                linkFromParentType: childNodeType,
                childNodes: api_1.ChildNodes.EMPTY,
                linkStubs: [],
            };
        });
        famsNodes.forEach(function (node, i) {
            if (i !== 0)
                node.primaryMarriage = famsNodes[0];
            var duplicateOf = _this.queuedNodesById.get(node.id);
            if (duplicateOf) {
                node.duplicateOf = duplicateOf;
                duplicateOf.duplicated = true;
            }
            else
                _this.queuedNodesById.set(node.id, node);
        });
        return famsNodes;
    };
    HierarchyCreator.prototype.famAsSpouseIdsToNodes = function (famsIds, parentNode, childNodeType) {
        var nodes = this.idsToNodes(famsIds.map(EntryId.fam), parentNode, childNodeType);
        nodes.slice(1).forEach(function (node) { return (node.primaryMarriage = nodes[0]); });
        return nodes;
    };
    HierarchyCreator.prototype.idsToNodes = function (entryIds, parentNode, childNodeType, duplicateCheck) {
        var _this = this;
        if (duplicateCheck === void 0) { duplicateCheck = true; }
        return entryIds
            .map(function (entryId) {
            return _this.idToNode(entryId, parentNode, childNodeType, duplicateCheck);
        })
            .filter(function (node) { return node != null; });
    };
    HierarchyCreator.prototype.idToNode = function (entryId, parentNode, childNodeType, duplicateCheck) {
        if (duplicateCheck === void 0) { duplicateCheck = true; }
        if (this.isChildNodeTypeForbidden(childNodeType, parentNode))
            return null;
        var id = entryId.id, isFam = entryId.isFam;
        if (isFam) {
            var fam = this.data.getFam(id);
            if (!fam || (!fam.getFather() && !fam.getMother()))
                return null; // Don't create fam nodes that are missing both husband and wife
        }
        var duplicateOf = this.queuedNodesById.get(id);
        var node = {
            id: id,
            parentNode: parentNode,
            linkFromParentType: childNodeType,
            childNodes: api_1.ChildNodes.EMPTY,
            linkStubs: [],
        };
        if (isFam)
            node.family = { id: id };
        if (duplicateCheck && duplicateOf) {
            node.duplicateOf = duplicateOf;
            duplicateOf.duplicated = true;
        }
        if (!duplicateOf)
            this.queuedNodesById.set(id, node);
        return node;
    };
    HierarchyCreator.prototype.createLinkStubs = function (node) {
        var _this = this;
        if (!this.isFamNode(node) ||
            (!node.duplicateOf && !node.duplicated && !node.primaryMarriage)) {
            return [];
        }
        var fam = this.data.getFam(node.family.id);
        var _a = this.areParentsAndSiblingsPresent(node.indi ? node.indi.id : null), indiParentsPresent = _a[0], indiSiblingsPresent = _a[1];
        var _b = this.areParentsAndSiblingsPresent(node.spouse ? node.spouse.id : null), spouseParentsPresent = _b[0], spouseSiblingsPresent = _b[1];
        var childrenPresent = (0, utils_1.nonEmpty)(fam.getChildren());
        return [
            indiParentsPresent ? [api_1.LinkType.IndiParents] : [],
            indiSiblingsPresent ? [api_1.LinkType.IndiSiblings] : [],
            spouseParentsPresent ? [api_1.LinkType.SpouseParents] : [],
            spouseSiblingsPresent ? [api_1.LinkType.SpouseSiblings] : [],
            childrenPresent ? [api_1.LinkType.Children] : [],
        ]
            .flat()
            .filter(function (linkType) {
            return !_this.isChildNodeTypeForbidden(linkType, node) &&
                !node.childNodes.get(linkType).length;
        });
    };
    HierarchyCreator.prototype.isChildNodeTypeForbidden = function (childNodeType, parentNode) {
        if (childNodeType === null || !parentNode)
            return false;
        switch ((0, api_1.otherSideLinkType)(parentNode.linkFromParentType)) {
            case api_1.LinkType.IndiParents:
            case api_1.LinkType.IndiSiblings:
                if (childNodeType === api_1.LinkType.IndiParents ||
                    childNodeType === api_1.LinkType.IndiSiblings) {
                    return true;
                }
                break;
            case api_1.LinkType.Children:
                if (!parentNode.primaryMarriage &&
                    childNodeType === api_1.LinkType.Children) {
                    return true;
                }
                break;
        }
        if (parentNode.primaryMarriage) {
            // Forbid indi/spouse from parentNode that is also indi/spouse in primaryMarriage from having parents and siblings, as they are already added to primaryMarriage node. This prevents drawing parents/siblings of a person for each marriage of this person.
            var indiId = parentNode.indi.id;
            var spouseId = parentNode.spouse.id;
            var pmIndiId = parentNode.primaryMarriage.indi.id;
            var pmSpouseId = parentNode.primaryMarriage.spouse.id;
            if (indiId === pmIndiId || indiId === pmSpouseId) {
                if (childNodeType === api_1.LinkType.IndiParents ||
                    childNodeType === api_1.LinkType.IndiSiblings) {
                    return true;
                }
            }
            else if (spouseId === pmIndiId || spouseId === pmSpouseId) {
                if (childNodeType === api_1.LinkType.SpouseParents ||
                    childNodeType === api_1.LinkType.SpouseSiblings) {
                    return true;
                }
            }
        }
        return false;
    };
    HierarchyCreator.prototype.isFamNode = function (node) {
        return !!node.family;
    };
    HierarchyCreator.UP_FILTER = hierarchy_filter_1.HierarchyFilter.allRejecting().modify({
        indiParents: true,
        spouseParents: true,
        indiSiblings: true,
        spouseSiblings: true,
    });
    HierarchyCreator.DOWN_FILTER = hierarchy_filter_1.HierarchyFilter.allRejecting().modify({
        children: true,
    });
    HierarchyCreator.ALL_ACCEPTING_FILTER = hierarchy_filter_1.HierarchyFilter.allAccepting();
    return HierarchyCreator;
}());
exports.HierarchyCreator = HierarchyCreator;
/* Id of indi or fam */
var EntryId = /** @class */ (function () {
    function EntryId(indiId, famId) {
        if (!indiId && !famId)
            throw new Error('Invalid EntryId');
        this.id = (indiId || famId);
        this.isFam = !!famId;
    }
    EntryId.indi = function (id) {
        return new EntryId(id, null);
    };
    EntryId.fam = function (id) {
        return new EntryId(null, id);
    };
    return EntryId;
}());
exports.EntryId = EntryId;
function getRootsCount(upRoot, data) {
    var upIndi = upRoot.data.indi && data.getIndi(upRoot.data.indi.id);
    var upSpouse = upRoot.data.spouse && data.getIndi(upRoot.data.spouse.id);
    return ((upIndi ? upIndi.getFamiliesAsSpouse().length : 0) +
        (upSpouse ? upSpouse.getFamiliesAsSpouse().length - 1 : 0));
}
