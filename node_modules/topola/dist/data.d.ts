import { DataProvider, Fam, Indi } from './api';
export interface Date {
    qualifier?: string;
    day?: number;
    month?: number;
    year?: number;
    text?: string;
}
export interface DateRange {
    from?: Date;
    to?: Date;
}
export interface DateOrRange {
    date?: Date;
    dateRange?: DateRange;
}
export interface JsonEvent extends DateOrRange {
    type?: string;
    place?: string;
    confirmed?: boolean;
    notes?: string[];
}
export interface JsonImage {
    url: string;
    title?: string;
}
/** Json representation of an individual. */
export interface JsonIndi {
    id: string;
    firstName?: string;
    lastName?: string;
    maidenName?: string;
    famc?: string;
    fams?: string[];
    numberOfChildren?: number;
    numberOfMarriages?: number;
    birth?: JsonEvent;
    death?: JsonEvent;
    sex?: string;
    images?: JsonImage[];
    notes?: string[];
    events?: JsonEvent[];
    hideId?: boolean;
    hideSex?: boolean;
}
/** Json representation of a family. */
export interface JsonFam {
    id: string;
    children?: string[];
    wife?: string;
    husb?: string;
    marriage?: JsonEvent;
}
/** Json representation of Gedcom data. */
export interface JsonGedcomData {
    indis: JsonIndi[];
    fams: JsonFam[];
}
/** Details of an individual record. */
export interface IndiDetails extends Indi {
    getFirstName(): string | null;
    getLastName(): string | null;
    getMaidenName(): string | null;
    getNumberOfChildren(): number | null;
    getNumberOfMarriages(): number | null;
    getMaidenName(): string | null;
    getBirthDate(): DateOrRange | null;
    getBirthPlace(): string | null;
    getDeathDate(): DateOrRange | null;
    getDeathPlace(): string | null;
    isConfirmedDeath(): boolean;
    getSex(): string | null;
    getImageUrl(): string | null;
    getImages(): JsonImage[] | null;
    getNotes(): string[] | null;
    getEvents(): JsonEvent[] | null;
    showId(): boolean;
    showSex(): boolean;
}
/** Details of a family record. */
export interface FamDetails extends Fam {
    getMarriageDate(): DateOrRange | null;
    getMarriagePlace(): string | null;
}
/** Implementation of the DataProvider interface based on Json input. */
export declare class JsonDataProvider implements DataProvider<IndiDetails, FamDetails> {
    readonly json: JsonGedcomData;
    readonly indis: Map<string, IndiDetails>;
    readonly fams: Map<string, FamDetails>;
    constructor(json: JsonGedcomData);
    getIndi(id: string): IndiDetails | null;
    getFam(id: string): FamDetails | null;
}
