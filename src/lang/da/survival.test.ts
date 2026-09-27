import { describe, expect, it } from 'vitest'
import { danishCurriculumContent } from './curriculum-content'
import { danishCurriculum } from './curriculum'
import { danishSurvivalGuide } from './survival'
import { survivalAudioLineId, survivalAudioSource } from './survival-audio'
import { validateSurvivalGuide } from '../survival'

async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('Danish Survival Guide', () => {
  it('projects every existing authored situation exactly once into four translated dialogue turns', () => {
    const targets = danishCurriculumContent.cities.flatMap((city) => city.exchanges.map((exchange) => exchange.id)).sort()
    const projected = danishSurvivalGuide.cities.flatMap((city) => city.exchanges.map((exchange) => exchange.targetActivityId)).sort()
    expect(projected).toEqual(targets)
    expect(projected).toHaveLength(36)
    expect(validateSurvivalGuide(danishSurvivalGuide, danishCurriculum.cities.map((city) => city.cityId))).toEqual([])
  })

  it('pins the owner-approved Sønderborg exemplar', () => {
    const exemplar = danishSurvivalGuide.cities[0]!.exchanges[0]
    expect(exemplar.titleEn).toBe('Say your name')
    expect(exemplar.phrases.map((phrase) => phrase.da)).toContain('hej')
    expect(exemplar.phrases.map((phrase) => phrase.da)).toContain('Jeg hedder Mia. / Mit navn er Mia.')
    expect(exemplar.dialogue).toHaveLength(4)
    expect(exemplar.dialogue.every((line) => Boolean(line.en))).toBe(true)
  })

  it('pins every authored phrase, translation, role, and dialogue turn', async () => {
    const fingerprint = await sha256(danishSurvivalGuide)
    expect(fingerprint).toBe('bc91d63a7b7d6279d6bced0849cdb91be77050d63c3fc30779323e86be36ad22')
  })

  it('freezes every dialogue turn once for the Survival audio bake', async () => {
    const expected = danishSurvivalGuide.cities.flatMap((city) => city.exchanges.flatMap((exchange) =>
      exchange.dialogue.map((line, lineIndex) => ({
        id: survivalAudioLineId(exchange.targetActivityId, lineIndex),
        activityId: exchange.targetActivityId,
        lineIndex,
        textDa: line.da,
      })),
    ))
    expect(survivalAudioSource.entries).toHaveLength(144)
    expect(survivalAudioSource.entries.map(({ id, activityId, lineIndex, textDa }) => ({ id, activityId, lineIndex, textDa }))).toEqual(expected)
    await Promise.all(survivalAudioSource.entries.map(async (entry) => {
      expect(entry.sourceHash).toBe(await sha256Text(entry.textDa))
    }))
  })
})
