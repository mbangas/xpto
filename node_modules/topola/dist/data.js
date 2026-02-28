"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonDataProvider = void 0;
/** Details of an individual based on Json input. */
var JsonIndiDetails = /** @class */ (function () {
    function JsonIndiDetails(json) {
        this.json = json;
    }
    JsonIndiDetails.prototype.getId = function () {
        return this.json.id;
    };
    JsonIndiDetails.prototype.getFamiliesAsSpouse = function () {
        return this.json.fams || [];
    };
    JsonIndiDetails.prototype.getFamilyAsChild = function () {
        return this.json.famc || null;
    };
    JsonIndiDetails.prototype.getFirstName = function () {
        return this.json.firstName || null;
    };
    JsonIndiDetails.prototype.getLastName = function () {
        return this.json.lastName || null;
    };
    JsonIndiDetails.prototype.getBirthDate = function () {
        return this.json.birth || null;
    };
    JsonIndiDetails.prototype.getMaidenName = function () {
        return this.json.maidenName || null;
    };
    JsonIndiDetails.prototype.getNumberOfChildren = function () {
        return this.json.numberOfChildren || null;
    };
    JsonIndiDetails.prototype.getNumberOfMarriages = function () {
        return this.json.numberOfMarriages || null;
    };
    JsonIndiDetails.prototype.getBirthPlace = function () {
        return (this.json.birth && this.json.birth.place) || null;
    };
    JsonIndiDetails.prototype.getDeathDate = function () {
        return this.json.death || null;
    };
    JsonIndiDetails.prototype.getDeathPlace = function () {
        return (this.json.death && this.json.death.place) || null;
    };
    JsonIndiDetails.prototype.isConfirmedDeath = function () {
        return !!this.json.death && !!this.json.death.confirmed;
    };
    JsonIndiDetails.prototype.getSex = function () {
        return this.json.sex || null;
    };
    JsonIndiDetails.prototype.getImageUrl = function () {
        return ((this.json.images &&
            this.json.images.length > 0 &&
            this.json.images[0].url) ||
            null);
    };
    JsonIndiDetails.prototype.getImages = function () {
        return this.json.images || null;
    };
    JsonIndiDetails.prototype.getNotes = function () {
        return this.json.notes || null;
    };
    JsonIndiDetails.prototype.getEvents = function () {
        return this.json.events || null;
    };
    JsonIndiDetails.prototype.showId = function () {
        return !this.json.hideId;
    };
    JsonIndiDetails.prototype.showSex = function () {
        return !this.json.hideSex;
    };
    return JsonIndiDetails;
}());
/** Details of a family based on Json input. */
var JsonFamDetails = /** @class */ (function () {
    function JsonFamDetails(json) {
        this.json = json;
    }
    JsonFamDetails.prototype.getId = function () {
        return this.json.id;
    };
    JsonFamDetails.prototype.getFather = function () {
        return this.json.husb || null;
    };
    JsonFamDetails.prototype.getMother = function () {
        return this.json.wife || null;
    };
    JsonFamDetails.prototype.getChildren = function () {
        return this.json.children || [];
    };
    JsonFamDetails.prototype.getMarriageDate = function () {
        return this.json.marriage || null;
    };
    JsonFamDetails.prototype.getMarriagePlace = function () {
        return (this.json.marriage && this.json.marriage.place) || null;
    };
    return JsonFamDetails;
}());
/** Implementation of the DataProvider interface based on Json input. */
var JsonDataProvider = /** @class */ (function () {
    function JsonDataProvider(json) {
        var _this = this;
        this.json = json;
        this.indis = new Map();
        this.fams = new Map();
        json.indis.forEach(function (indi) {
            return _this.indis.set(indi.id, new JsonIndiDetails(indi));
        });
        json.fams.forEach(function (fam) { return _this.fams.set(fam.id, new JsonFamDetails(fam)); });
    }
    JsonDataProvider.prototype.getIndi = function (id) {
        return this.indis.get(id) || null;
    };
    JsonDataProvider.prototype.getFam = function (id) {
        return this.fams.get(id) || null;
    };
    return JsonDataProvider;
}());
exports.JsonDataProvider = JsonDataProvider;
