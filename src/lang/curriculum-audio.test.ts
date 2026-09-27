import { describe, expect, it } from 'vitest'
import taskSource from '../data/curriculum-audio.da.json'
import { danishCurriculumTaskAudio } from './da/curriculum-audio'

describe('the S4 Danish task-audio source manifest', () => {
  it('is a source-hashed projection of every accepted T6 activity utterance', () => {
    expect(danishCurriculumTaskAudio).toHaveLength(144)
    expect(danishCurriculumTaskAudio.filter((line) => line.kind === 'capsule')).toHaveLength(48)
    expect(danishCurriculumTaskAudio.filter((line) => line.kind === 'exchange')).toHaveLength(38)
    expect(danishCurriculumTaskAudio.filter((line) => line.kind === 'due-review')).toHaveLength(9)
    expect(danishCurriculumTaskAudio.filter((line) => line.kind === 'exit-step')).toHaveLength(27)
    expect(danishCurriculumTaskAudio.filter((line) => line.kind === 'checkpoint')).toHaveLength(22)
    expect(new Set(danishCurriculumTaskAudio.map((line) => line.id)).size).toBe(144)
    expect(danishCurriculumTaskAudio.filter((line) => line.kind === 'capsule').map((line) => line.phase)).toEqual(
      expect.arrayContaining(['notice', 'discriminate', 'manipulate', 'listen', 'transfer']),
    )
    expect(new Set(danishCurriculumTaskAudio.filter((line) => line.kind === 'checkpoint').map((line) => line.checkpointId)))
      .toEqual(new Set(['skagen-a1-readiness', 'kobenhavn-a2-readiness']))
    expect(taskSource.entries.map(({ sourceHash: _sourceHash, ...line }) => line)).toEqual(danishCurriculumTaskAudio)
    expect(taskSource.entries.every(({ sourceHash }) => /^[a-f0-9]{64}$/.test(sourceHash))).toBe(true)
  })
})
