"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = formatDate;
exports.formatDateOrRange = formatDateOrRange;
/** Month in English is used as fallback if a requested translation is not found. */
var MONTHS_EN = new Map([
    [1, 'Jan'],
    [2, 'Feb'],
    [3, 'Mar'],
    [4, 'Apr'],
    [5, 'May'],
    [6, 'Jun'],
    [7, 'Jul'],
    [8, 'Aug'],
    [9, 'Sep'],
    [10, 'Oct'],
    [11, 'Nov'],
    [12, 'Dec'],
]);
/** Translations of the GEDCOM date qualifiers. */
var QUALIFIERS_I18N = new Map([
    [
        'bg',
        new Map([
            ['cal', 'прибл.'],
            ['abt', 'ок.'],
            ['est', 'оц.'],
            ['before', 'преди'],
            ['after', 'след'],
        ]),
    ],
    [
        'cs',
        new Map([
            ['cal', 'vypočt.'],
            ['abt', 'okolo'],
            ['est', 'odhadem'],
            ['before', 'před'],
            ['after', 'po'],
        ]),
    ],
    [
        'de',
        new Map([
            ['cal', 'errech.'],
            ['abt', 'etwa'],
            ['est', 'geschät.'],
            ['before', 'vor'],
            ['after', 'nach'],
        ]),
    ],
    [
        'fr',
        new Map([
            ['cal', 'calc.'],
            ['abt', 'vers'],
            ['est', 'est.'],
            ['before', 'avant'],
            ['after', 'après'],
        ]),
    ],
    [
        'it',
        new Map([
            ['cal', 'calc.'],
            ['abt', 'circa il'],
            ['est', 'stim.'],
            ['before', 'prima del'],
            ['after', 'dopo del'],
        ]),
    ],
    [
        'pl',
        new Map([
            ['cal', 'wyl.'],
            ['abt', 'ok.'],
            ['est', 'szac.'],
            ['before', 'przed'],
            ['after', 'po'],
        ]),
    ],
    [
        'ru',
        new Map([
            ['cal', 'выч.'],
            ['abt', 'ок.'],
            ['est', 'оцен.'],
            ['before', 'до'],
            ['after', 'после'],
        ]),
    ],
]);
var shortMonthCache = new Map();
function getShortMonth(month, locale) {
    if (!Intl || !Intl.DateTimeFormat) {
        return MONTHS_EN.get(month);
    }
    var cacheKey = "".concat(month, "|").concat(locale || '');
    if (shortMonthCache.has(cacheKey)) {
        return shortMonthCache.get(cacheKey);
    }
    var result = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2000, month - 1));
    shortMonthCache.set(cacheKey, result);
    return result;
}
function getQualifier(qualifier, locale) {
    var language = locale && locale.split(/[-_]/)[0];
    var languageMap = language && QUALIFIERS_I18N.get(language);
    return languageMap ? languageMap.get(qualifier) : qualifier;
}
/**
 * Formats the date consisting of day, month and year.
 * All parts of the date are optional.
 */
function formatDateOnly(day, month, year, locale) {
    if (!day && !month && !year) {
        return '';
    }
    // Fall back to formatting the date manually in case of
    // - locale not provided
    // - English (to avoid formatting like 'Oct 11, 2009')
    // - Lack of i18n support in the browser
    if (!Intl || !Intl.DateTimeFormat || !locale || locale === 'en') {
        return [day, month && getShortMonth(month, locale), year].join(' ');
    }
    var format = {
        day: day ? 'numeric' : undefined,
        month: month ? 'short' : undefined,
        year: year ? 'numeric' : undefined,
    };
    return new Intl.DateTimeFormat(locale, format).format(new Date(year !== null && year !== void 0 ? year : 2000, month ? month - 1 : 1, day !== null && day !== void 0 ? day : 1));
}
/** Simple date formatter. */
function formatDate(date, locale) {
    return [
        date.qualifier && getQualifier(date.qualifier, locale),
        formatDateOnly(date.day, date.month, date.year, locale),
        date.text,
    ].join(' ');
}
/** Formats a DateOrRange object. */
function formatDateOrRange(dateOrRange, locale) {
    if (dateOrRange.date) {
        return formatDate(dateOrRange.date, locale);
    }
    if (!dateOrRange.dateRange) {
        return '';
    }
    var from = dateOrRange.dateRange.from &&
        formatDate(dateOrRange.dateRange.from, locale);
    var to = dateOrRange.dateRange.to && formatDate(dateOrRange.dateRange.to, locale);
    if (from && to) {
        return "".concat(from, " .. ").concat(to);
    }
    if (from) {
        return "".concat(getQualifier('after', locale), " ").concat(from);
    }
    if (to) {
        return "".concat(getQualifier('before', locale), " ").concat(to);
    }
    return '';
}
