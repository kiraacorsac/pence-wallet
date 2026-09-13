/**
 * In-memory stand-in for Obsidian's plugin settings store (loadData/saveData,
 * backed by .obsidian/plugins/<id>/data.json). Pass the seeded config, or
 * nothing to simulate a first launch.
 */
export function createMockStore(initial: unknown = null) {
  let data: unknown = initial

  return {
    store: {
      loadData: async () => data,
      saveData: async (d: unknown) => { data = d },
    },
    read: () => data,
    set: (d: unknown) => { data = d },
  }
}

/** A store whose read fails, for the unreadable-config path. */
export function createFailingStore() {
  return {
    loadData: async () => { throw new Error('unreadable') },
    saveData: async () => {},
  }
}
