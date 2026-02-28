export type Direction = -1 | 0 | 1;
export interface Vec2 {
    x: number;
    y: number;
}
export declare function nonEmpty<T>(array: T[]): boolean;
export declare function last<T>(array: T[]): T;
export declare function zip<A, B>(a: A[], b: B[]): Array<[A, B]>;
export declare function points2pathd(points: Vec2[]): string;
