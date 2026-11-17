import { Type, type Static } from 'typebox'
import { PASSING_DISTANCE, PRESETS, type PresetName, type Zone } from './zones.js'

const ZoneSchema = Type.Object({
  level: Type.Enum(['alert', 'warn', 'alarm', 'emergency'], {
    type: 'string',
    title: 'Level',
    default: 'warn'
  }),
  cpa: Type.Number({
    title: 'Crossing ahead of your bow within (m)',
    minimum: 0,
    default: 926
  }),
  tcpa: Type.Number({ title: 'Within (s)', minimum: 0, default: 720 })
})

export const ConfigSchema = Type.Object({
  // A plain string enum, not a union of literals: the admin UI's form renders
  // `enum` as a dropdown but shows no control for `anyOf` of `const`s.
  preset: Type.Enum(['harbour', 'coastal', 'offshore', 'custom'], {
    type: 'string',
    title: 'Alert sensitivity',
    description:
      'A boat raises when it will cross your course ahead of your bow within a distance, or come within a passing distance of you. Boats passing on either side, or crossing behind you, stay quiet. Harbour: warn when crossing within 100 m ahead in 5 min, alarm within 50 m in 2 min, passing distance 15 m. Coastal: 0.5 NM in 12 min, 0.25 NM in 6 min, 50 m. Offshore: 1 NM in 20 min, 0.5 NM in 10 min, 100 m.',
    default: 'coastal'
  }),
  harbourZones: Type.Array(ZoneSchema, {
    title: 'Harbour zones',
    description:
      'Default: warn 100 m / 300 s, alarm 50 m / 120 s. Also used for slow and stopped boats, whatever the sensitivity.',
    minItems: 1,
    default: PRESETS.harbour
  }),
  harbourPassingDistance: Type.Number({
    title: 'Harbour passing distance (m)',
    description: 'Default: 15 m. Also used for slow and stopped boats, whatever the sensitivity.',
    minimum: 0,
    default: PASSING_DISTANCE.harbour
  }),
  coastalZones: Type.Array(ZoneSchema, {
    title: 'Coastal zones',
    description: 'Default: warn 926 m / 720 s, alarm 463 m / 360 s.',
    minItems: 1,
    default: PRESETS.coastal
  }),
  coastalPassingDistance: Type.Number({
    title: 'Coastal passing distance (m)',
    description: 'Default: 50 m.',
    minimum: 0,
    default: PASSING_DISTANCE.coastal
  }),
  offshoreZones: Type.Array(ZoneSchema, {
    title: 'Offshore zones',
    description: 'Default: warn 1852 m / 1200 s, alarm 926 m / 600 s.',
    minItems: 1,
    default: PRESETS.offshore
  }),
  offshorePassingDistance: Type.Number({
    title: 'Offshore passing distance (m)',
    description: 'Default: 100 m.',
    minimum: 0,
    default: PASSING_DISTANCE.offshore
  }),
  customZones: Type.Array(ZoneSchema, {
    title: 'Custom zones',
    description: 'Default: the Coastal values.',
    default: PRESETS.coastal
  }),
  customPassingDistance: Type.Number({
    title: 'Custom passing distance (m)',
    description: 'Default: 50 m.',
    minimum: 0,
    default: PASSING_DISTANCE.coastal
  }),
  slowSpeed: Type.Number({
    title: 'Use Harbour limits when both boats are slower than (kn)',
    description:
      'A boat gets the Harbour limits while you and it are both slower than this. A boat you overtake with less than this speed between you, coming up on it from more than 22.5° abaft its beam and faster than it along its course, raises only within the Harbour distances, though as early as the normal limits once it has been inside them about 30 s, and at once inside the Harbour alarm limits; it stays overtaken until the speed between you rises half a knot above this, it is too far off for the normal limits to raise anything, or there has been no usable data on it or on your boat for more than a minute. Otherwise the boats at anchor you motor past in a harbour, or a boat you overtake 0.2 NM off, would fall inside the Coastal or Offshore limits. Boats that are stopped get the Harbour limits at any speed of yours. While you are stopped, a boat faster than this raises only within the Harbour passing distance, though as early as the normal limits; one at 6 kn or faster raises while an error of 3° in its course could bring it within that distance. Any other boat overtaking you or crossing at a fine angle keeps the normal limits, and a boat already warned or alarmed is held by the strictest limits it was judged by until it clears, though only the limits it gets now raise it further. 0 turns this off.',
    minimum: 0,
    default: 3
  }),
  harbourLimitsWhenMoored: Type.Boolean({
    title: 'Use Harbour limits for every boat while moored',
    description:
      'While you are stopped and your navigation.state is moored, every boat gets the Harbour limits, whatever its speed: in a marina boats slow and turn for their berths a few boat lengths off, and fast ones would otherwise raise by your chosen limits from a kilometre or more. A boat heading for you then warns only about 5 min and alarms 2 min before its closest approach. Turn this on only if moored on your boat means lying at a berth: signalk-autostate also reports moored at anchor while no anchor position is set, on a buoy, and while drifting slowly at sea. Has no effect while the Harbour-limits speed is 0.',
    default: false
  }),
  maxAlarms: Type.Integer({
    title: 'Alarm for at most this many targets at once',
    description:
      'Only the most urgent targets alarm: the highest level first, then the soonest closest approach. Others alarm when they become one of the most urgent. A target cleared to make room for a more urgent one is held back for 2 minutes while below alarm level, unless it reaches a higher level than it had, or leaves every zone or the range and comes back; an alarm is never held back.',
    minimum: 1,
    maximum: 5,
    default: 3
  }),
  maxRange: Type.Number({
    title: 'Ignore targets farther than (NM)',
    minimum: 0,
    default: 12
  }),
  maxAge: Type.Number({
    title: 'Ignore target data older than (s)',
    description:
      'The default rides out two missed reports from an anchored Class A vessel (3 min interval) while still dropping vessels that left.',
    minimum: 1,
    default: 360
  }),
  interval: Type.Number({ title: 'Evaluate every (s)', minimum: 1, default: 2 }),
  publishClosestApproach: Type.Boolean({
    title: 'Publish navigation.closestApproach for each target',
    default: true
  })
})

export type Config = Static<typeof ConfigSchema>

type Preset = Config['preset']

const LIMIT_FIELDS: Record<Preset, [keyof Config, keyof Config]> = {
  harbour: ['harbourZones', 'harbourPassingDistance'],
  coastal: ['coastalZones', 'coastalPassingDistance'],
  offshore: ['offshoreZones', 'offshorePassingDistance'],
  custom: ['customZones', 'customPassingDistance']
}

/** The zones and passing distance of a sensitivity, as the user set them. */
export function limitsFor(
  config: Config,
  preset: Preset | PresetName = config.preset
): { zones: Zone[]; passingDistance: number } {
  const [zones, passingDistance] = LIMIT_FIELDS[preset]
  return {
    zones: config[zones] as Zone[],
    passingDistance: config[passingDistance] as number
  }
}

/**
 * The schema the admin form gets: only the chosen sensitivity's limits show,
 * right below it, with their defaults filled in when switching. The form
 * appends a `dependencies` branch's fields after the others and rejects a
 * `ui:order` naming a field it does not show, so every branch carries all the
 * other fields too, in schema order, each branch its own copy: the server
 * stores the schema as JSON, and the plugin CI rejects an object reachable
 * twice. Hidden fields keep their values.
 */
export function formSchema(): object {
  const schema = JSON.parse(JSON.stringify(ConfigSchema)) as {
    properties: Record<string, unknown>
  }
  const properties = schema.properties
  const limits = new Set<string>(Object.values(LIMIT_FIELDS).flat())
  const others = Object.entries(properties).filter(([key]) => key !== 'preset' && !limits.has(key))
  return {
    ...schema,
    required: ['preset'],
    properties: { preset: properties.preset },
    dependencies: {
      preset: {
        oneOf: Object.entries(LIMIT_FIELDS).map(([preset, keys]) => ({
          properties: {
            preset: { enum: [preset] },
            ...Object.fromEntries(keys.map((key) => [key, properties[key]])),
            ...structuredClone(Object.fromEntries(others))
          }
        }))
      }
    }
  }
}

// The server only uses schema defaults to seed the admin form; start()
// receives `{}` for a plugin that has never been configured.
export const DEFAULTS: Config = {
  preset: 'coastal',
  harbourZones: PRESETS.harbour,
  harbourPassingDistance: PASSING_DISTANCE.harbour,
  coastalZones: PRESETS.coastal,
  coastalPassingDistance: PASSING_DISTANCE.coastal,
  offshoreZones: PRESETS.offshore,
  offshorePassingDistance: PASSING_DISTANCE.offshore,
  customZones: PRESETS.coastal,
  customPassingDistance: PASSING_DISTANCE.coastal,
  slowSpeed: 3,
  harbourLimitsWhenMoored: false,
  maxAlarms: 3,
  maxRange: 12,
  maxAge: 360,
  interval: 2,
  publishClosestApproach: true
}
