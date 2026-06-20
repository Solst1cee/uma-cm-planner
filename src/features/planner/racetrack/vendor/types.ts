import type * as React from 'react';

export const RegionDisplayType = {
  Immediate: 0,
  Regions: 1,
  Textbox: 2,
  Marker: 3
} as const;
export type IRegionDisplayType = (typeof RegionDisplayType)[keyof typeof RegionDisplayType];
export const RegionDisplayTypeLabel: Record<IRegionDisplayType, string> = {
  [RegionDisplayType.Immediate]: 'Immediate',
  [RegionDisplayType.Regions]: 'Regions',
  [RegionDisplayType.Textbox]: 'Textbox',
  [RegionDisplayType.Marker]: 'Marker'
};

export const regionDisplayTypes: IRegionDisplayType[] = Object.values(RegionDisplayType);
export const regionDisplayTypeLabels = Object.values(RegionDisplayTypeLabel);

export namespace RaceTrackDimensions {
  // Viewbox dimensions
  export const ViewWidth = 960;
  export const RankBarHeight = 24;
  export const RankBarY = 2;
  export const OverlayBandHeight = 132; // local mod: space at top for the race-compare overlay
  export const ViewHeight = 240 + OverlayBandHeight; // was 240; overlay band added above the slope viz

  export const marginTop = 16;
  export const marginBottom = 0;
  export const marginLeft = 20;
  export const marginRight = 20;

  // X Offset to show Y Axis numbers
  export const xOffset = 20;
  export const RenderWidth = ViewWidth - marginLeft - marginRight;

  export const xAxisHeight = 20;
  export const xAxisY = ViewHeight - xAxisHeight - marginBottom;

  export const yAxisHeight = ViewHeight - xAxisHeight - marginBottom - marginTop;

  export const SectionNumbersBarHeight = 40; // local mod: was 80; matched to the 40px bars above (ViewHeight reduced 40 to compensate)
  export const SectionNumbersBarY = xAxisY - SectionNumbersBarHeight;

  export const PhaseBarHeight = 40;
  export const PhaseBarY = SectionNumbersBarY - PhaseBarHeight;

  export const SectionTypesBarHeight = 40;
  export const SectionTypesBarY = PhaseBarY - SectionTypesBarHeight;

  export const SlopeLabelBarHeight = 40;
  export const SlopeLabelBarY = SectionTypesBarY - SlopeLabelBarHeight;

  // Slope visualization (background terrain)
  export const SlopeVisualizationHeight = 50;
  export const SlopeVisualizationY = SlopeLabelBarY - SlopeVisualizationHeight;

  // Race-compare overlay band: the new top space [marginTop, SlopeVisualizationY].
  export const OverlayBandY = marginTop;
  export const OverlayBandRenderHeight = SlopeVisualizationY - marginTop;
  export const OverlayGapHeight = 34;                                  // bottom strip = バ身 gap
  export const OverlayVeloHeight = OverlayBandRenderHeight - OverlayGapHeight - 6; // top = velocity/HP

  // Other

  export const UmaSkillSectionHeight = SectionNumbersBarHeight;
  export const UmaSkillSectionRowHeight = UmaSkillSectionHeight / 2;
}

export const slopeConversionValue = 10000;
export const slopeValueToPercentage = (value: number) => {
  return value / slopeConversionValue;
};

export type DragStartHandler = (
  e: React.PointerEvent,
  skillId: string,
  umaIndex: number,
  start: number,
  end: number,
  markerType?: 'skill' | 'debuff' | 'scenario',
  debuffId?: string
) => void;
