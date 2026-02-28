import { Renderer, RendererOptions, TreeNodeSelection } from './api';
import { FamDetails, IndiDetails } from './data';
import { CompositeRenderer } from './composite-renderer';
/**
 * Simple rendering of an individual box showing only the person's name and
 * years of birth and death.
 */
export declare class SimpleRenderer extends CompositeRenderer implements Renderer {
    readonly options: RendererOptions<IndiDetails, FamDetails>;
    constructor(options: RendererOptions<IndiDetails, FamDetails>);
    getPreferredIndiSize(id: string): [number, number];
    render(enter: TreeNodeSelection, update: TreeNodeSelection): void;
    getCss(): string;
    private renderIndi;
}
