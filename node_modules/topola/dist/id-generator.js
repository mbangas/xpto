"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdGenerator = void 0;
/** Provides unique identifiers. */
var IdGenerator = /** @class */ (function () {
    function IdGenerator() {
        this.ids = new Map();
    }
    /**
     * Returns the given identifier if it wasn't used before. Otherwise, appends
     * a number to the given identifier to make it unique.
     */
    IdGenerator.prototype.getId = function (id) {
        if (this.ids.has(id)) {
            var num = this.ids.get(id);
            this.ids.set(id, num + 1);
            return "".concat(id, ":").concat(num);
        }
        this.ids.set(id, 1);
        return id;
    };
    return IdGenerator;
}());
exports.IdGenerator = IdGenerator;
