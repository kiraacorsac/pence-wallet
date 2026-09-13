import { TFile } from 'obsidian'

/**
 * Create an in-memory Obsidian App mock backed by a simple Map.
 * Pass initial files as { 'path/to/file.md': 'content' }.
 */
export function createMockApp(initialFiles: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initialFiles))

  const makeTFile = (path: string) => Object.assign(new TFile(), {
    path,
    basename: path.split('/').pop()!.replace(/\.[^.]+$/, ''),
    extension: path.includes('.') ? path.split('.').pop()! : '',
  })

  const vault = {
    getAbstractFileByPath: (path: string) => store.has(path) ? makeTFile(path) : null,
    getFileByPath: (path: string) => store.has(path) ? makeTFile(path) : null,
    getFolderByPath: (path: string) => {
      const children = [...store.keys()]
        .filter(p => {
          if (!p.startsWith(path + '/')) return false
          // direct children only (no nested slashes after the folder path)
          return !p.slice(path.length + 1).includes('/')
        })
        .map(p => makeTFile(p))
      const hasAny = [...store.keys()].some(p => p.startsWith(path + '/'))
      return hasAny ? { path, children } : null
    },
    getMarkdownFiles: () =>
      [...store.keys()]
        .filter(p => p.endsWith('.md'))
        .map(p => makeTFile(p)),
    read: async (file: InstanceType<typeof TFile>) => store.get(file.path) ?? '',
    modify: async (file: InstanceType<typeof TFile>, content: string) => {
      store.set(file.path, content)
    },
    process: async (file: InstanceType<typeof TFile>, fn: (data: string) => string) => {
      const content = fn(store.get(file.path) ?? '')
      store.set(file.path, content)
      return content
    },
    create: async (path: string, content: string) => {
      if (store.has(path)) throw new Error(`File already exists: ${path}`)
      store.set(path, content)
      return makeTFile(path)
    },
    createFolder: async () => {},
    adapter: {
      exists: async (path: string) => store.has(path),
      read: async (path: string) => store.get(path) ?? '',
      write: async (path: string, content: string) => { store.set(path, content) },
      remove: async (path: string) => { store.delete(path) },
    },
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app: { vault } as any,
    store, // expose for assertions
  }
}
