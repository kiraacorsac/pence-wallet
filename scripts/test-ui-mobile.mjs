#!/usr/bin/env node
/**
 * Mobile UI integration checks for PennyWallet.
 *
 * Prerequisites:
 *   - Obsidian is running with demo-vault open
 *   - Plugin is built: npm run dev
 *
 * Usage:
 *   npm run test:ui:mobile
 *   npm run test:ui:mobile -- --vault "my-vault"
 */

import { execSync } from 'node:child_process'
import process from 'node:process'

const { console } = globalThis

const args = process.argv.slice(2)
const vaultArg = args.find(a => a.startsWith('--vault='))?.split('=')[1]
             ?? args[args.indexOf('--vault') + 1]
const VAULT = vaultArg ?? 'demo-vault'
const MOBILE_TAG = 'essential'
const MOBILE_EDIT_TAG = 'work'
const mobileTagNote = `Mobile Tag E2E ${Date.now()}`

let passed = 0
let failed = 0
const failures = []

function obs(...parts) {
  const cmd = `obsidian vault="${VAULT}" ${parts.join(' ')}`
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 10_000 }).trim()
  } catch {
    return null
  }
}

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`)
    passed++
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
    failed++
    failures.push(name)
  }
}

function section(title) {
  console.log(`\n▶ ${title}`)
}

function wait(ms = 400) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function evalJs(code) {
  const escaped = code.replace(/"/g, '\\"')
  const raw = obs(`eval code="${escaped}"`)
  if (raw === null) return null
  return raw.startsWith('=> ') ? raw.slice(3) : raw
}

function parseEval(raw) {
  if (raw == null) return null
  try { return JSON.parse(raw) } catch { return raw }
}

function count(selector) {
  const result = evalJs(`document.querySelectorAll(${JSON.stringify(selector)}).length`)
  if (result === null) return -1
  const n = parseInt(result, 10)
  return isNaN(n) ? -1 : n
}

function text(selector) {
  return parseEval(evalJs(`JSON.stringify(document.querySelector(${JSON.stringify(selector)})?.textContent ?? '')`))
}

function digits(selector) {
  return (text(selector) ?? '').replace(/\D/g, '')
}

function cdp(method, params) {
  const json = JSON.stringify(params)
  return obs(`dev:cdp method=${method} params='${json}'`)
}

function clickAt(point) {
  if (!point) return false
  const ok = evalJs(`(()=>{const el=document.elementFromPoint(${point.x},${point.y});if(!(el instanceof HTMLElement))return false;el.click();return true;})()`)
  wait(300)
  return ok === 'true'
}

function tapAt(point) {
  if (!point) return false
  cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  wait(80)
  cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  wait(500)
  return true
}

function click(selector, predicate = '() => true') {
  const ok = evalJs(`(() => {
    const pred = ${predicate};
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(pred);
    if (!el) return false;
    el.click();
    return true;
  })()`)
  wait(300)
  return ok === 'true'
}

function centerOf(selector, predicate = '() => true') {
  return parseEval(evalJs(`(() => {
    const pred = ${predicate};
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(pred);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) });
  })()`))
}

function metric(selector) {
  return parseEval(evalJs(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return JSON.stringify({
      display: style.display,
      visibility: style.visibility,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height)
    });
  })()`))
}

function activeMatches(selector) {
  return evalJs(`String(document.activeElement?.matches(${JSON.stringify(selector)}))`) === 'true'
}

function setInputValue(selector, value) {
  evalJs(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) return false;
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  wait(200)
}

function setDetailSearch(value) {
  setInputValue('[data-testid=detail-search]', value)
  wait(400)
}

function rowHasTag(note, tag) {
  return evalJs(`String((() => {
    const input = document.querySelector('[data-testid=detail-search]');
    if (!input) return false;
    input.value = ${JSON.stringify(note)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const row = document.querySelector('[data-testid=tx-row]');
    return !!row && [...row.querySelectorAll('[data-testid=tx-tag-chip]')]
      .some(chip => chip.dataset.tag === ${JSON.stringify(tag)});
  })())`) === 'true'
}

function countTagged(testid, tag) {
  const result = evalJs(`String([...document.querySelectorAll('[data-testid=${testid}]')]
    .filter(el => el.dataset.tag === ${JSON.stringify(tag)}).length)`)
  const n = parseInt(result ?? '', 10)
  return isNaN(n) ? -1 : n
}

function clickEditForRow(note) {
  setDetailSearch(note)
  evalJs(`(() => {
    document.querySelector('[data-testid=tx-row]')?.click();
  })()`)
  wait(600)
}

function openAddModal() {
  cleanupUiState()
  obs('command id="penny-wallet:add-transaction"')
  wait(500)
}

function setMobileViewport() {
  evalJs("const {remote} = require('electron'); const win = remote.getCurrentWindow(); win.setSize(430, 932);")
  wait(800)
}

function openDashboard() {
  obs('command id="penny-wallet:open-dashboard"')
  wait(700)
}

function openDetail() {
  obs('command id="penny-wallet:open-detail"')
  wait(700)
  click('[data-testid=detail-clear-filters]')
  setInputValue('[data-testid=detail-search]', '')
  wait(300)
}

function openAsset() {
  obs('command id="penny-wallet:open-asset"')
  wait(700)
}

function openCalculator() {
  const opened = click('.pw-mobile-amount-area')
  wait(300)
  return opened && count('.pw-mobile-calculator-pad') === 1
}

function tapCalculator(value) {
  return click('.pw-mobile-calculator-btn', `(el) => el.textContent?.trim() === ${JSON.stringify(value)}`)
}

function submitMobileModal() {
  return click('.pw-mobile-top-confirm')
}

function closeCalculatorSheet() {
  const ok = evalJs(`(() => {
    const backdrop = [...document.querySelectorAll('.pw-bottom-sheet-backdrop:not(.is-closing)')]
      .find(el => el.querySelector('.pw-mobile-calculator-pad'));
    if (!backdrop) return false;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  })()`)
  wait(700)
  return ok === 'true'
}

function openBottomSheetRow(index) {
  if (count('.pw-mobile-calculator-pad') > 0) closeCalculatorSheet()
  return click('.pw-mobile-bottom-sheet-row', `(_el, i) => i === ${index}`)
}

function clickActiveBottomSheetCancel() {
  const ok = evalJs(`(() => {
    const btns = [...document.querySelectorAll('.pw-bottom-sheet-backdrop:not(.is-closing) .pw-bottom-sheet-btn')];
    const btn = btns.find(el => el.getBoundingClientRect().height > 0);
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  })()`)
  wait(700)
  return ok === 'true'
}

function clickActiveTagPickerCancel() {
  const ok = evalJs(`(() => {
    const btn = [...document.querySelectorAll('.pw-bottom-sheet-backdrop:not(.is-closing) [data-testid=tag-picker-cancel]')]
      .find(el => el.getBoundingClientRect().height > 0);
    if (!btn) return false;
    btn.click();
    return true;
  })()`)
  wait(700)
  return ok === 'true'
}

function selectFirstSheetOption() {
  const before = text('.pw-bottom-sheet-option.is-selected') ?? ''
  const point = centerOf(
    '.pw-bottom-sheet-option',
    "(el) => !el.classList.contains('is-selected') && el.dataset.value && el.textContent?.trim().length > 0",
  )
  const selected = tapAt(point)
  wait(400)
  const after = text('.pw-mobile-bottom-sheet-row .pw-mobile-row-value') ?? ''
  return { selected, before, after }
}

function selectTagPickerTag(tag) {
  return click('[data-testid=tag-picker-chip]', `(el) => el.dataset.tag === ${JSON.stringify(tag)}`)
}

function closeModal() {
  evalJs(`(() => {
    document.querySelector('.pw-mobile-top-btn:not(.pw-mobile-top-confirm)')?.click();
    document.querySelector('.modal-close-button')?.click();
  })()`)
  wait(500)
}

function cleanupUiState() {
  evalJs(`(() => {
    document.querySelectorAll('.pw-bottom-sheet-backdrop').forEach(el => el.remove());
    document.body.classList.remove('pw-bottom-sheet-lock');
    document.querySelectorAll('.pw-mobile-top-btn:not(.pw-mobile-top-confirm)').forEach(el => el.click());
    document.querySelectorAll('.modal-close-button').forEach(el => el.click());
  })()`)
  wait(500)
}

section('Mobile environment')

obs('dev:mobile on')
obs('dev:debug on')
evalJs('app.emulateMobile(true)')
setMobileViewport()
cleanupUiState()

const reloadResult = obs('plugin:reload id=penny-wallet')
wait(800)
setMobileViewport()
obs('dev:debug on')
wait(300)
assert('Plugin reloads without error', reloadResult !== null, reloadResult ?? 'command failed')

const env = parseEval(evalJs("JSON.stringify({ width: window.innerWidth, height: window.innerHeight, isPhone: document.body.classList.contains('is-phone'), classes: [...document.body.classList] })"))
assert('Viewport is 430x932', env?.width === 430 && env?.height === 932, env ? `${env.width}x${env.height}` : 'unavailable')
assert('Obsidian phone class is active', env?.isPhone === true, env?.classes?.join(' ') ?? 'classes unavailable')

section('Mobile dashboard')

openDashboard()
assert('Dashboard view opens', count('.pw-dashboard') > 0)
assert('Month label is present', count('.pw-month-label') > 0)
assert('Metrics row rendered', count('.pw-metrics') > 0)
assert('Category chart column renders', count('.pw-grid-right') > 0)
const monthBefore = text('.pw-month-label')
click('.pw-nav-btn')
wait(600)
const monthAfter = text('.pw-month-label')
assert('Prev button navigates back one month', monthBefore !== monthAfter, `${monthBefore} -> ${monthAfter}`)
click('.pw-nav-btn', '(_el, i) => i === 1')
wait(600)
assert('Next button returns to current month', text('.pw-month-label') === monthBefore)

section('Mobile assets')

openAsset()
assert('Asset view opens', count('.pw-asset') > 0)
assert('Range selector present', count('.pw-range-btn') > 0)
assert('Account rows render', count('.pw-asset-wallet-row') > 0)
click('.pw-range-btn', "(el) => el.textContent?.includes('6')")
wait(600)
assert('6M range button clickable', count('.pw-range-btn.is-active') > 0)
assert('Asset canvas chart renders', count('canvas') > 0)

section('Mobile detail')

openDetail()
assert('Detail view opens', count('.pw-detail') > 0)
assert('Type filter pills present', count('.pw-filter-pill, .pw-pill') > 0 || count('.pw-type-filter') > 0 || count('[data-testid=detail-filter-btn]') > 0)
assert('Transaction rows rendered', count('.pw-tx-row, .pw-detail-row, table tr') > 0)
click('.pw-filter-pill, .pw-pill', "(el) => el.textContent?.toLowerCase().includes('expense')")
wait(400)
assert('Expense filter applies without crash', count('.pw-detail') > 0)
click('.pw-filter-pill, .pw-pill', "(el) => el.textContent?.toLowerCase().includes('all')")
wait(300)

section('Mobile transaction modal')

openAddModal()
assert('Mobile modal opens', count('.pw-mobile-content') > 0)
assert('Mobile type tabs render', count('.pw-mobile-tab') >= 3)
assert('Mobile picker rows render', count('.pw-mobile-bottom-sheet-row') >= 2)
assert('Calculator hidden by default', count('.pw-mobile-calculator-pad') === 0)
assert('Calculator opens from amount display', openCalculator())

section('Bottom sheet picker')

assert('Category picker row has tap target', openBottomSheetRow(0))
wait(500)
assert('Bottom sheet opens', count('.pw-bottom-sheet-backdrop') === 1)
assert('Bottom sheet search is present', count('.pw-bottom-sheet-search') === 1)
assert('Calculator hidden while picker is open', count('.pw-mobile-calculator-pad') === 0)

section('Bottom sheet keyboard coexistence')

const searchPoint = centerOf('.pw-bottom-sheet-search')
assert('Search input has tap target', tapAt(searchPoint))
assert('Search input is focused after tap', activeMatches('.pw-bottom-sheet-search'))
cdp('Input.insertText', { text: 'zzzz-no-match' })
wait(500)

const searchMetric = metric('.pw-bottom-sheet-search')
const emptyMetric = metric('.pw-bottom-sheet-empty')
assert('No-results state renders', count('.pw-bottom-sheet-empty') === 1)
assert('Focused search remains above viewport bottom', searchMetric !== null && searchMetric.bottom < 932, searchMetric ? `bottom=${searchMetric.bottom}` : 'missing')
assert('No-results message remains above viewport bottom', emptyMetric !== null && emptyMetric.bottom < 932, emptyMetric ? `bottom=${emptyMetric.bottom}` : 'missing')
assert('Calculator stays hidden during search focus', count('.pw-mobile-calculator-pad') === 0)

clickActiveBottomSheetCancel()
assert('Bottom sheet closes from cancel', count('.pw-bottom-sheet-backdrop:not(.is-closing)') === 0)

section('Bottom sheet selection')

const rowValueBefore = text('.pw-mobile-bottom-sheet-row .pw-mobile-row-value')
assert('Category picker opens again', openBottomSheetRow(0))
const optionResult = selectFirstSheetOption()
assert('Bottom sheet option can be selected', optionResult.selected)
const rowValueAfter = text('.pw-mobile-bottom-sheet-row .pw-mobile-row-value')
assert('Picker row value updates after selection', rowValueAfter !== rowValueBefore, `${rowValueBefore} -> ${rowValueAfter}`)

section('Tag picker keyboard coexistence')

assert('Tag row has tap target', clickAt(centerOf('[data-testid=mobile-tag-row]')))
assert('Tag picker opens', count('.pw-tag-picker') === 1)
assert('Fixed tag options render', countTagged('tag-picker-chip', MOBILE_TAG) === 1)
const tagSearchPoint = centerOf('[data-testid=tag-picker-search]')
assert('Tag search input has tap target', tapAt(tagSearchPoint))
assert('Tag search input is focused after tap', activeMatches('[data-testid=tag-picker-search]'))
cdp('Input.insertText', { text: 'zzzznomat' })
wait(500)
const tagSearchMetric = metric('[data-testid=tag-picker-search]')
const tagEmptyMetric = metric('.pw-tag-picker-empty')
assert('Tag picker no-results state renders', count('.pw-tag-picker-empty') === 1)
assert('Focused tag search remains above viewport bottom', tagSearchMetric !== null && tagSearchMetric.bottom < 932, tagSearchMetric ? `bottom=${tagSearchMetric.bottom}` : 'missing')
assert('Tag picker no-results remains above viewport bottom', tagEmptyMetric !== null && tagEmptyMetric.bottom < 932, tagEmptyMetric ? `bottom=${tagEmptyMetric.bottom}` : 'missing')
assert('Calculator stays hidden during tag search focus', count('.pw-mobile-calculator-pad') === 0)
clickActiveTagPickerCancel()
assert('Tag picker closes from cancel', count('.pw-tag-picker') === 0)

section('Text input keyboard coexistence')

const notePoint = centerOf('.pw-mobile-note-input')
assert('Note input has tap target', tapAt(notePoint))
assert('Note input is focused after tap', activeMatches('.pw-mobile-note-input'))
assert('Text focus class is applied', count('.pw-mobile-content.pw-mobile-text-focus') === 1)
assert('Calculator hidden while note input is focused', count('.pw-mobile-calculator-pad') === 0)

evalJs("document.querySelector('.modal-close-button')?.click()")
wait(300)

section('Mobile add expense transaction')

closeModal()
openDetail()
const rowsBeforeAdd = count('.pw-tx-row')
openAddModal()
assert('Calculator opens for amount entry', openCalculator())
tapCalculator('1')
tapCalculator('5')
tapCalculator('0')
assert('Calculator updates amount display', (text('.pw-mobile-amount-display') ?? '').includes('150'))

assert('Category row opens for selection', openBottomSheetRow(0))
assert('Category option selected', selectFirstSheetOption().selected)
assert('Wallet row opens for selection', openBottomSheetRow(1))
assert('Wallet option selected', selectFirstSheetOption().selected)
assert('Tag row opens for selection', clickAt(centerOf('[data-testid=mobile-tag-row]')))
assert('Tag option selected', selectTagPickerTag(MOBILE_TAG))
click('[data-testid=tag-picker-done]')
assert('Selected tag appears on mobile form', countTagged('mobile-tag-chip', MOBILE_TAG) === 1)
setInputValue('.pw-mobile-note-input', mobileTagNote)

submitMobileModal()
wait(900)
const addError = text('.pw-error')
assert('Mobile add modal closes after submit', count('.pw-mobile-content') === 0)
openDetail()
assert('Mobile add increases row count', count('.pw-tx-row') === rowsBeforeAdd + 1, `${rowsBeforeAdd} -> ${count('.pw-tx-row')}; error=${addError}`)
assert('Mobile added transaction keeps tag in detail', rowHasTag(mobileTagNote, MOBILE_TAG))

section('Mobile edit transaction')

closeModal()
openDetail()
const rowsBeforeEdit = count('.pw-tx-row')
clickEditForRow(mobileTagNote)
assert('Mobile edit modal opens', count('.pw-mobile-content') > 0)
assert('Mobile edit amount prefilled', (text('.pw-mobile-amount-display') ?? '').trim().length > 0)
assert('Mobile edit pre-fills tag', countTagged('mobile-tag-chip', MOBILE_TAG) === 1)
assert('Mobile edit tag row opens', clickAt(centerOf('[data-testid=mobile-tag-row]')))
assert('Mobile edit can remove existing tag', selectTagPickerTag(MOBILE_TAG))
assert('Mobile edit can select replacement tag', selectTagPickerTag(MOBILE_EDIT_TAG))
click('[data-testid=tag-picker-done]')
assert('Mobile edit shows replacement tag on form', countTagged('mobile-tag-chip', MOBILE_EDIT_TAG) === 1)
assert('Calculator opens for edit amount', openCalculator())
tapCalculator('C')
tapCalculator('9')
tapCalculator('9')
tapCalculator('9')
submitMobileModal()
wait(900)
const editError = text('.pw-error')
assert('Mobile edit modal closes after submit', count('.modal-content') === 0, editError ?? '')
openDetail()
assert('Mobile edit keeps row count unchanged', count('.pw-tx-row') === rowsBeforeEdit)
assert('Mobile edited transaction shows updated tag', rowHasTag(mobileTagNote, MOBILE_EDIT_TAG))
setInputValue('[data-testid=detail-search]', MOBILE_EDIT_TAG)
assert('Mobile detail search finds edited transaction by tag', rowHasTag(mobileTagNote, MOBILE_EDIT_TAG))
setInputValue('[data-testid=detail-search]', '')

section('Mobile delete transaction')

closeModal()
openDetail()
const rowsBeforeDelete = count('.pw-tx-row')
clickEditForRow(mobileTagNote)
click('.pw-mobile-delete-row')
wait(400)
assert('Mobile delete confirm dialog appears', count('.modal-content') > 0)
click('.modal-content [data-action="cancel"]')
wait(400)
closeModal()
openDetail()
assert('Mobile delete cancel keeps row count', count('.pw-tx-row') === rowsBeforeDelete)
clickEditForRow(mobileTagNote)
click('.pw-mobile-delete-row')
wait(400)
click('.modal-content [data-action="confirm"]')
wait(800)
openDetail()
assert('Mobile delete confirm decreases row count', count('.pw-tx-row') === rowsBeforeDelete - 1)

section('Mobile settings wallet flow')

closeModal()
obs('plugin:reload id=penny-wallet')
wait(800)
setMobileViewport()
obs('dev:debug on')
wait(300)
obs('command id="app:open-settings"')
wait(500)
click('.vertical-tab-nav-item', "(el) => el.textContent?.includes('PennyWallet')")
wait(500)
assert('Settings tab opens on mobile', count('.vertical-tab-content') > 0)
assert('Mobile settings wallet rows render', count('.pw-wallet-row') > 0)

const testWalletName = `Mobile-UI-${Date.now().toString().slice(-6)}`
evalJs(`const n = document.querySelector('.pw-add-wallet-input[type=text]'); if(n){ n.value='${testWalletName}'; n.dispatchEvent(new Event('input',{bubbles:true})); }`)
evalJs("const b = document.querySelector('.pw-add-wallet-input[type=number]'); if(b){ b.value='500'; b.dispatchEvent(new Event('input',{bubbles:true})); }")
click('.pw-add-wallet-submit button')
wait(700)
assert('Mobile settings add wallet works', evalJs(`[...document.querySelectorAll('.pw-wallet-row-name')].some(el => el.textContent?.includes('${testWalletName}'))`) === 'true')

click('.pw-wallet-row [data-action=edit]')
wait(400)
assert('Mobile settings edit wallet modal opens', count('.modal-content input[type=text]') > 0 && count('.modal-content input[type=number]') > 0)
click('.modal [data-action="cancel"]')
wait(300)

evalJs(`const item = [...document.querySelectorAll('.pw-wallet-row')].find(el => el.querySelector('.pw-wallet-row-name')?.textContent?.includes('${testWalletName}')); item?.querySelector('[data-action="delete"]')?.click()`)
wait(400)
assert('Mobile settings delete confirm appears', count('.modal-content') > 0)
click('.modal-content [data-action="confirm"]')
wait(700)
assert('Mobile settings delete wallet works', evalJs(`[...document.querySelectorAll('.pw-wallet-row-name')].every(el => !el.textContent?.includes('${testWalletName}'))`) === 'true')

const archiveTargetName = parseEval(evalJs("JSON.stringify((() => { const row = [...document.querySelectorAll('.pw-wallet-row')].find(el => el.querySelector('[data-action=archive]')); return row?.querySelector('.pw-wallet-row-name')?.textContent?.trim() || ''; })())"))
assert('Mobile archive target wallet is found', archiveTargetName.length > 0)
evalJs(`[...document.querySelectorAll('.pw-wallet-row')].find(el => el.querySelector('.pw-wallet-row-name')?.textContent?.trim() === ${JSON.stringify(archiveTargetName)})?.querySelector('[data-action="archive"]')?.click()`)
wait(400)
assert('Mobile archive confirm appears', count('.modal-content') > 0)
click('.modal-content [data-action="confirm"]')
wait(800)
assert('Mobile archived wallet appears in archived list', evalJs(`[...document.querySelectorAll('.pw-wallet-row')].some(el => el.querySelector('[data-action="unarchive"]') && el.querySelector('.pw-wallet-row-name')?.textContent?.trim() === ${JSON.stringify(archiveTargetName)})`) === 'true')
evalJs(`[...document.querySelectorAll('.pw-wallet-row')].find(el => el.querySelector('[data-action="unarchive"]') && el.querySelector('.pw-wallet-row-name')?.textContent?.trim() === ${JSON.stringify(archiveTargetName)})?.querySelector('[data-action="unarchive"]')?.click()`)
wait(400)
assert('Mobile unarchive confirm appears', count('.modal-content') > 0)
click('.modal-content [data-action="confirm"]')
wait(800)
assert('Mobile unarchive restores wallet', evalJs(`[...document.querySelectorAll('.pw-wallet-row')].some(el => el.querySelector('[data-action="archive"]') && el.querySelector('.pw-wallet-row-name')?.textContent?.trim() === ${JSON.stringify(archiveTargetName)})`) === 'true')
evalJs("document.querySelector('.modal-close-button')?.click()")
wait(300)

section('Mobile URI handler')

try {
  execSync(`open "obsidian://penny-wallet?vault=${VAULT}&type=income&amount=5000&note=MobileURI"`, { timeout: 5000 })
} catch { /* ignore */ }
wait(900)
assert('Mobile URI opens transaction modal', count('.pw-mobile-content') > 0)
assert('Mobile URI pre-fills amount', digits('.pw-mobile-amount-display') === '5000', text('.pw-mobile-amount-display') ?? '')
evalJs("document.querySelector('.modal-close-button')?.click()")
wait(300)

console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)

if (failures.length > 0) {
  console.log('\nFailed tests:')
  for (const f of failures) console.log(`  • ${f}`)
  process.exit(1)
} else {
  console.log('\nAll mobile UI checks passed.')
}
