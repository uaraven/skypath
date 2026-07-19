/**
 * Chart geometry and data models.
 *
 * The Svelte chart components live in `src/components/`; only their pure
 * inputs live here, so they can be tested in Node alongside the astronomy.
 */

export {
  altitudeToY,
  timeToX,
  polylinePath,
  areaPath,
  hourTicks,
  altitudeTicks,
  plotBottom,
  plotRight,
  clamp,
  MAX_ALTITUDE,
  type PlotArea,
  type Point,
} from './scales'
export {
  skyBands,
  phaseAt,
  PHASES,
  PHASE_FLOOR,
  type SkyBand,
  type SkyPhase,
} from './sky-bands'
export {
  altitudeChartModel,
  everVisible,
  type AltitudeChartModel,
  type AltitudeChartInput,
  type HorizonSample,
} from './model'
export {
  altitudeRadius,
  polarPoint,
  radialPoint,
  ringAltitudes,
  spokeAzimuths,
  azimuthLabel,
  compassPoint,
  closedPath,
  obstructionPath,
  type PolarDial,
} from './polar'
export {
  allSkyChartModel,
  aboveHorizonArcs,
  HORIZON_STEP_DEGREES,
  type AllSkyChartModel,
  type AllSkyChartInput,
  type HourMark,
} from './all-sky'
