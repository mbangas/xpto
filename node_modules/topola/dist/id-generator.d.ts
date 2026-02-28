/** Provides unique identifiers. */
export declare class IdGenerator {
    readonly ids: Map<string, number>;
    /**
     * Returns the given identifier if it wasn't used before. Otherwise, appends
     * a number to the given identifier to make it unique.
     */
    getId(id: string): string;
}
