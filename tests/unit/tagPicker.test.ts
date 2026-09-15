import { describe, it, expect } from 'vitest'
import { filterTagsByQuery, toggleStagedTag, getAddRowState } from '../../src/modal/TagPicker'
import { TAG_MAX_LEN } from '../../src/utils'

describe('filterTagsByQuery', () => {
  const tags = ['Coffee_Shop', 'coffee', 'food', 'transport']

  it('returns all tags for empty query', () => {
    expect(filterTagsByQuery(tags, '')).toEqual(tags)
  })

  it('case-insensitive substring match', () => {
    expect(filterTagsByQuery(tags, 'cof')).toEqual(['Coffee_Shop', 'coffee'])
  })

  it('preserves caller-supplied order (no re-sort inside filter)', () => {
    expect(filterTagsByQuery(['zebra', 'apple', 'banana'], 'a'))
      .toEqual(['zebra', 'apple', 'banana'])
  })

  it('returns empty for no match', () => {
    expect(filterTagsByQuery(tags, 'xyz')).toEqual([])
  })
})

describe('toggleStagedTag', () => {
  it('adds tag if not present', () => {
    expect(toggleStagedTag(new Set(['a']), 'b')).toEqual(new Set(['a', 'b']))
  })

  it('removes tag if present', () => {
    expect(toggleStagedTag(new Set(['a', 'b']), 'a')).toEqual(new Set(['b']))
  })

  it('does not mutate input', () => {
    const original = new Set(['a'])
    toggleStagedTag(original, 'b')
    expect(original).toEqual(new Set(['a']))
  })
})

describe('getAddRowState', () => {
  it('returns empty when query has no usable chars', () => {
    expect(getAddRowState('', [], 0)).toEqual({ kind: 'empty' })
    expect(getAddRowState('   ', [], 0)).toEqual({ kind: 'empty' })
    expect(getAddRowState('#', [], 0)).toEqual({ kind: 'empty' })
  })

  it('returns addable for valid unique name below limit', () => {
    expect(getAddRowState('coffee', ['food'], 0))
      .toEqual({ kind: 'addable', name: 'coffee' })
  })

  it('trims and strips # before classifying', () => {
    expect(getAddRowState('  #coffee  ', [], 0))
      .toEqual({ kind: 'addable', name: 'coffee' })
  })

  it('returns duplicate when query matches an existing tag (case-sensitive)', () => {
    expect(getAddRowState('coffee', ['coffee'], 0))
      .toEqual({ kind: 'duplicate', name: 'coffee' })
    expect(getAddRowState('#coffee', ['coffee'], 0))
      .toEqual({ kind: 'duplicate', name: 'coffee' })
  })

  it('returns invalid when validateTag rejects the name', () => {
    expect(getAddRowState('a,b', [], 0))
      .toEqual({ kind: 'invalid', name: 'a,b' })
    expect(getAddRowState('a|b', [], 0))
      .toEqual({ kind: 'invalid', name: 'a|b' })
  })

  it('returns too-long past TAG_MAX_LEN, same cap for CJK and ASCII', () => {
    const cjk = '一'.repeat(TAG_MAX_LEN + 1)
    const ascii = 'a'.repeat(TAG_MAX_LEN + 1)
    expect(getAddRowState(cjk, [], 0)).toEqual({ kind: 'too-long', name: cjk })
    expect(getAddRowState(ascii, [], 0)).toEqual({ kind: 'too-long', name: ascii })
    // boundary: exactly at cap is still addable
    expect(getAddRowState('一'.repeat(TAG_MAX_LEN), [], 0))
      .toEqual({ kind: 'addable', name: '一'.repeat(TAG_MAX_LEN) })
    expect(getAddRowState('a'.repeat(TAG_MAX_LEN), [], 0))
      .toEqual({ kind: 'addable', name: 'a'.repeat(TAG_MAX_LEN) })
  })

  it('accepts names the old 5 CJK / 10 ASCII cap rejected', () => {
    expect(getAddRowState('subscriptions', [], 0))
      .toEqual({ kind: 'addable', name: 'subscriptions' })
    expect(getAddRowState('日常通勤飲食', [], 0))
      .toEqual({ kind: 'addable', name: '日常通勤飲食' })
  })

  it('returns limit when staged count is already at the cap', () => {
    expect(getAddRowState('coffee', [], 3))
      .toEqual({ kind: 'limit', name: 'coffee' })
  })

  it('limit takes precedence after duplicate/invalid checks', () => {
    // duplicate beats limit — user already has the tag, telling them
    // about the limit would be confusing.
    expect(getAddRowState('coffee', ['coffee'], 3))
      .toEqual({ kind: 'duplicate', name: 'coffee' })
  })
})
