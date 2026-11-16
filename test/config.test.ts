import { describe, expect, it } from 'vitest'
import { Value } from 'typebox/value'
import { ConfigSchema, DEFAULTS, formSchema } from '../src/config.js'

describe('config schema', () => {
  // The admin UI renders a dropdown only for `enum`; `anyOf` of `const`s shows no control.
  it('offers the sensitivity and zone level as dropdown choices', () => {
    expect(ConfigSchema.properties.preset).toMatchObject({
      type: 'string',
      enum: ['harbour', 'coastal', 'offshore', 'custom']
    })
    expect(ConfigSchema.properties.customZones.items.properties.level).toMatchObject({
      type: 'string',
      enum: ['alert', 'warn', 'alarm', 'emergency']
    })
  })

  it('accepts the defaults and rejects an unknown sensitivity', () => {
    expect(Value.Check(ConfigSchema, DEFAULTS)).toBe(true)
    expect(Value.Check(ConfigSchema, { ...DEFAULTS, preset: 'river' })).toBe(false)
  })

  // The admin form picks the dependencies branch whose preset matches.
  interface Branch {
    properties: { preset: { enum: string[] } } & Record<string, unknown>
  }
  const fieldsFor = (preset: string): string[] => {
    const { dependencies } = formSchema() as { dependencies: { preset: { oneOf: Branch[] } } }
    const branch = dependencies.preset.oneOf.find((b) => b.properties.preset.enum[0] === preset)
    return Object.keys(branch?.properties ?? {}).filter((key) => key !== 'preset')
  }

  it('shows only the limits of the chosen sensitivity, right below it', () => {
    expect((formSchema() as { properties: unknown }).properties).toEqual({
      preset: ConfigSchema.properties.preset
    })
    for (const preset of ['harbour', 'coastal', 'offshore', 'custom']) {
      const fields = fieldsFor(preset)
      expect(fields.slice(0, 2)).toEqual([`${preset}Zones`, `${preset}PassingDistance`])
      expect(
        fields.filter((f) => f.endsWith('Zones') || f.endsWith('PassingDistance'))
      ).toHaveLength(2)
      expect(fields).toContain('maxAlarms')
    }
  })
})
