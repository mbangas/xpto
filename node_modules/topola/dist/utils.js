"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nonEmpty = nonEmpty;
exports.last = last;
exports.zip = zip;
exports.points2pathd = points2pathd;
function nonEmpty(array) {
    return !!(array && array.length);
}
function last(array) {
    return array[array.length - 1];
}
function zip(a, b) {
    return a.map(function (e, i) { return [e, b[i]]; });
}
function points2pathd(points) {
    var result = "M ".concat(points[0].x, " ").concat(points[0].y, " L");
    for (var _i = 0, _a = points.slice(1); _i < _a.length; _i++) {
        var s = _a[_i];
        result += " ".concat(s.x, " ").concat(s.y);
    }
    return result;
}
