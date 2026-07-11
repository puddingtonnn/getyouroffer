// In-memory hand-off for a resume dropped on the landing hero window: File
// objects cannot go through history state, so the landing stashes the file
// here and the «Новый отклик» form picks it up on mount. Lost on full page
// reload — acceptable for a courtesy shortcut.
let stashed: File | null = null

export function stashResume(file: File) {
  stashed = file
}

export function takeStashedResume(): File | null {
  const file = stashed
  stashed = null
  return file
}
