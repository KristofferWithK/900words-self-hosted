import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import { holdNextClue } from './casey-justification-fixture.mjs'

test('next clue remains unanswered through reveal and is released on context teardown', async () => {
  const context = new EventEmitter()
  const actions = []
  const route = Object.fromEntries(['fulfill', 'abort', 'continue', 'fallback'].map((action) =>
    [action, async (...args) => { actions.push({ action, args }) }]))
  let settled = false
  const pending = holdNextClue(route, context).then(() => { settled = true })
  try {
    await setImmediate()
    assert.deepEqual(actions, [], 'no error response or external request during the held reveal')
    assert.equal(settled, false, 'the following clue is still waiting')
  } finally {
    context.emit('close')
    await pending
  }
  assert.equal(settled, true, 'context teardown releases the handler')
  assert.deepEqual(actions, [], 'closing the context cancels the request without a fixture response')
  assert.equal(context.listenerCount('close'), 0)
})
