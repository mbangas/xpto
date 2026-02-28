"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartColors = exports.ExpanderDirection = exports.ExpanderState = void 0;
var ExpanderState;
(function (ExpanderState) {
    ExpanderState[ExpanderState["PLUS"] = 0] = "PLUS";
    ExpanderState[ExpanderState["MINUS"] = 1] = "MINUS";
})(ExpanderState || (exports.ExpanderState = ExpanderState = {}));
var ExpanderDirection;
(function (ExpanderDirection) {
    ExpanderDirection[ExpanderDirection["INDI"] = 0] = "INDI";
    ExpanderDirection[ExpanderDirection["SPOUSE"] = 1] = "SPOUSE";
    ExpanderDirection[ExpanderDirection["FAMILY"] = 2] = "FAMILY";
})(ExpanderDirection || (exports.ExpanderDirection = ExpanderDirection = {}));
var ChartColors;
(function (ChartColors) {
    ChartColors[ChartColors["NO_COLOR"] = 0] = "NO_COLOR";
    ChartColors[ChartColors["COLOR_BY_GENERATION"] = 1] = "COLOR_BY_GENERATION";
    ChartColors[ChartColors["COLOR_BY_SEX"] = 2] = "COLOR_BY_SEX";
})(ChartColors || (exports.ChartColors = ChartColors = {}));
