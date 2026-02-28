import { GedcomEntry } from 'parse-gedcom';
import { DateOrRange, JsonGedcomData } from './data';
/** Parses a GEDCOM date or date range. */
export declare function getDate(gedcomDate: string): DateOrRange | undefined;
/** Parses a GEDCOM file into a JsonGedcomData structure. */
export declare function gedcomToJson(gedcomContents: string): JsonGedcomData;
/** Converts parsed GEDCOM entries into a JsonGedcomData structure. */
export declare function gedcomEntriesToJson(gedcom: GedcomEntry[]): JsonGedcomData;
