import { Date as GedcomDate, DateOrRange } from './data';
/** Simple date formatter. */
export declare function formatDate(date: GedcomDate, locale?: string): string;
/** Formats a DateOrRange object. */
export declare function formatDateOrRange(dateOrRange: DateOrRange, locale?: string): string;
