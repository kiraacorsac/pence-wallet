import { t } from '../i18n'
import { validateTag, TAG_MAX_LEN } from '../utils'
import type { WalletFile } from '../io/WalletFile'

export const TAG_LIMIT = 3

export function filterTagsByQuery(tags: readonly string[], query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...tags]
  return tags.filter(tag => tag.toLowerCase().includes(needle))
}

export function toggleStagedTag(staged: ReadonlySet<string>, tag: string): Set<string> {
  const next = new Set(staged)
  if (next.has(tag)) next.delete(tag)
  else next.add(tag)
  return next
}

export type AddRowState =
  | { kind: 'empty' }                       // search empty — row prompts to focus search
  | { kind: 'invalid'; name: string }       // search has chars but fails validateTag (e.g. ,|)
  | { kind: 'too-long'; name: string }      // exceeds the TAG_MAX_LEN length cap
  | { kind: 'duplicate'; name: string }     // exact match against existing tag
  | { kind: 'limit'; name: string }         // would exceed 3-tag staged cap
  | { kind: 'addable'; name: string }       // ready to add

export function getAddRowState(
  query: string,
  existingTags: readonly string[],
  stagedCount: number,
): AddRowState {
  const normalized = query.trim().replace(/^#/, '').trim()
  if (!normalized) return { kind: 'empty' }
  if ([...normalized].length > TAG_MAX_LEN) return { kind: 'too-long', name: normalized }
  if (!validateTag(normalized)) return { kind: 'invalid', name: normalized }
  if (existingTags.includes(normalized)) return { kind: 'duplicate', name: normalized }
  if (stagedCount >= TAG_LIMIT) return { kind: 'limit', name: normalized }
  return { kind: 'addable', name: normalized }
}

// ── UI ────────────────────────────────────────────────────────────────────────

interface TagPickerParams {
  containerEl: HTMLElement
  walletFile: WalletFile
  initialSelected: readonly string[]
  onCommit: (selected: string[]) => void
}

export function openTagPicker(params: TagPickerParams): () => void {
  const { containerEl, walletFile, initialSelected, onCommit } = params
  let staged = new Set<string>(initialSelected)
  let query = ''
  let closeTimer: number | null = null

  const backdrop = containerEl.createDiv('pw-bottom-sheet-backdrop')
  const sheet = backdrop.createDiv('pw-bottom-sheet pw-tag-picker')
  document.body.addClass('pw-bottom-sheet-lock')
  containerEl.addClass('pw-bottom-sheet-active')

  const close = () => {
    if (closeTimer !== null) return
    backdrop.addClass('is-closing')
    document.body.removeClass('pw-bottom-sheet-lock')
    containerEl.removeClass('pw-bottom-sheet-active')
    containerEl.removeClass('pw-mobile-text-focus')
    closeTimer = window.setTimeout(() => {
      backdrop.remove()
      closeTimer = null
    }, 200)
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })

  // Top bar
  sheet.createDiv('pw-bottom-sheet-handle')
  const bar = sheet.createDiv('pw-bottom-sheet-bar')
  const cancelBtn = bar.createEl('button', { cls: 'pw-bottom-sheet-btn', text: t('ui.cancel') })
  cancelBtn.dataset['testid'] = 'tag-picker-cancel'
  bar.createEl('span', { cls: 'pw-bottom-sheet-title', text: t('tagPicker.title') })
  const doneBtn = bar.createEl('button', {
    cls: 'pw-bottom-sheet-btn pw-bottom-sheet-btn--done',
    text: t('modal.done'),
  })
  doneBtn.dataset['testid'] = 'tag-picker-done'
  cancelBtn.addEventListener('click', close)
  doneBtn.addEventListener('click', () => {
    onCommit([...staged])
    close()
  })

  // Search row — sized via shared .pw-bottom-sheet-search
  const searchInput = sheet.createEl('input', {
    type: 'text',
    cls: 'pw-bottom-sheet-search',
    placeholder: t('tagPicker.search'),
  })
  searchInput.dataset['testid'] = 'tag-picker-search'

  // Inline add button — sits directly below search (always above the
  // keyboard when it rises). Hidden when search is empty.
  const inlineAdd = sheet.createEl('button', { cls: 'pw-tag-picker-inline-add' })
  inlineAdd.hide()

  // Chip area
  const chipArea = sheet.createDiv('pw-tag-picker-chips')

  // Bottom add row — only visible when search is empty (keyboard is down,
  // so it's reachable). Acts as a hint that tapping focuses search.
  const addRow = sheet.createEl('button', {
    cls: 'pw-tag-picker-add-row',
    text: t('tagPicker.addTag'),
  })

  const renderChips = () => {
    chipArea.empty()
    const all = walletFile.getConfig().tags
    const visible = filterTagsByQuery(all, query)

    if (visible.length === 0 && query.trim() !== '') {
      chipArea.createDiv({
        cls: 'pw-tag-picker-empty',
        text: t('tagPicker.noResults').replace('{searchTerm}', query.trim()),
      })
      return
    }

    const atLimit = staged.size >= TAG_LIMIT

    for (const tag of visible) {
      const isSelected = staged.has(tag)
      const isDisabled = !isSelected && atLimit
      const chip = chipArea.createEl('button', {
        cls: 'pw-pill pw-pill-color-neutral',
        text: `#${tag}`,
      })
      chip.dataset['testid'] = 'tag-picker-chip'
      chip.dataset['tag'] = tag
      chip.toggleClass('is-active', isSelected)
      chip.toggleClass('is-disabled', isDisabled)

      chip.addEventListener('click', () => {
        if (isDisabled) return
        staged = toggleStagedTag(staged, tag)
        renderChips()
      })
    }
  }

  // NOTE: do not mutate `searchInput.value` from the input handler. iOS
  // 注音 keyboard does not fire compositionstart/end consistently and
  // overwriting the value mid-input breaks the IME session (chars are
  // dropped). Length / illegal-char enforcement is done via getAddRowState
  // (too-long / invalid) and validateTag at submit.

  const renderAddUI = () => {
    const state = getAddRowState(query, walletFile.getConfig().tags, staged.size)

    // Bottom row only when search is empty (keyboard down → reachable).
    if (state.kind === 'empty') {
      addRow.show()
      inlineAdd.hide()
      return
    }
    addRow.hide()

    // Inline (above-fold) row reflects state when search has content.
    inlineAdd.removeAttribute('disabled')
    inlineAdd.removeClass('is-disabled')
    switch (state.kind) {
      case 'addable':
        inlineAdd.show()
        inlineAdd.setText(t('tagPicker.addNamed').replace('{name}', state.name))
        break
      case 'duplicate':
        // Existing chip will appear in chip area for the user to tap; no
        // need for a separate add affordance.
        inlineAdd.hide()
        break
      case 'limit':
        inlineAdd.show()
        inlineAdd.setText(t('tagPicker.tagLimit'))
        inlineAdd.setAttribute('disabled', 'true')
        inlineAdd.addClass('is-disabled')
        break
      case 'too-long':
        inlineAdd.show()
        inlineAdd.setText(t('tagPicker.tooLong').replace('{max}', String(TAG_MAX_LEN)))
        inlineAdd.setAttribute('disabled', 'true')
        inlineAdd.addClass('is-disabled')
        break
      case 'invalid':
        inlineAdd.show()
        inlineAdd.setText(t('tagPicker.addNamed').replace('{name}', state.name))
        inlineAdd.setAttribute('disabled', 'true')
        inlineAdd.addClass('is-disabled')
        break
    }
  }

  const submitNewTag = async () => {
    const state = getAddRowState(query, walletFile.getConfig().tags, staged.size)
    if (state.kind !== 'addable') return
    const result = await walletFile.addTag(state.name)
    if (!result.ok) return // race: another path added it; silent
    staged.add(state.name)
    searchInput.value = ''
    query = ''
    renderChips()
    renderAddUI()
  }

  searchInput.addEventListener('input', () => {
    query = searchInput.value
    renderChips()
    renderAddUI()
  })
  searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    close()
  })

  // Bottom row is only visible when search is empty; tapping it focuses
  // search to invite typing (the actual add happens via inline button).
  addRow.addEventListener('click', () => {
    searchInput.focus()
  })

  inlineAdd.addEventListener('click', () => {
    void submitNewTag()
  })

  renderChips()
  renderAddUI()
  requestAnimationFrame(() => backdrop.addClass('is-open'))

  return close
}
