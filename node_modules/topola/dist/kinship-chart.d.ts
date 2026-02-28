import { KinshipChartRenderer } from './kinship/renderer';
import { Chart, ChartInfo, ChartOptions } from './api';
export declare class KinshipChart implements Chart {
    readonly options: ChartOptions;
    readonly renderer: KinshipChartRenderer;
    constructor(options: ChartOptions);
    render(): ChartInfo;
    private setChildNodesGenerationNumber;
    private getChildNodesByType;
}
