import { ipcRenderer, contextBridge } from 'electron';
// import Elements from './renderer/elements';
// import { renderMarkdown } from './renderer/markdown';

// ipcRenderer.on('file-opened', (_, content: string, filePath: string) => {
//   // console.log({ content, filePath });
//   Elements.MarkdownView.value = content;
//   renderMarkdown(content);
// });

contextBridge.exposeInMainWorld('api', {
  onFileOpen: (callback: (content: string) => void) => {
    ipcRenderer.on('file-opened', (_, content: string) => {
      callback(content);
    });
  },
  showOpenDialog: () => {
    ipcRenderer.send('show-open-dialog');
  },
  showExportHtmlDialog: (html: string) => {
    ipcRenderer.send('show-export-html-dialog', html);
  },
  saveFile: async (content: string) => {
    ipcRenderer.send('save-file', content);
  },
  checkForUnsavedChanges: async (content: string) => {
    const result = await ipcRenderer.invoke('has-changes', content);
    console.log({ result });
    return result;
  },
  showInFolder: async () => {
    ipcRenderer.send('show-in-folder');
  },
  openInDefaultApplication: () => {
    ipcRenderer.send('open-in-default-application');
  },
});
