import { Chart, ChartInfo, ChartOptions, Fam, Indi } from './api';
import { ChartUtil } from './chart-util';
/**
 * Renders an hourglass chart. It consists of an ancestor chart and
 * a descendant chart for a family.
 */
export declare class HourglassChart<IndiT extends Indi, FamT extends Fam> implements Chart {
    readonly options: ChartOptions;
    readonly util: ChartUtil;
    constructor(options: ChartOptions);
    render(): ChartInfo;
}
