import type {
  Editor,
  EditorPosition,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';
import { remote } from 'electron';
import {
  Notice,
  Plugin,
} from 'obsidian';

// Interfaces
interface CustomCommandsSettings {
  [key: string]: any
}

const DEFAULT_SETTINGS: CustomCommandsSettings = {};

// Helper functions
function onElement(
  el: EventTarget,
  event: string,
  selector: string,
  listener: (this: HTMLElement, ev: any, delegateTarget: HTMLElement) => any,
  options?: boolean | AddEventListenerOptions,
) {
  (el as any).on(event, selector, listener, options);
  return () => (el as any).off(event, selector, listener, options);
}

async function sleepUntil(
  f: () => any,
  timeoutMs: number = 2000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeWas = new Date();
    const wait = setInterval(() => {
      const _f = f();
      if (_f) {
        clearInterval(wait);
        resolve(_f);
      } else if (new Date().getTime() - timeWas.getTime() > timeoutMs) {
        clearInterval(wait);
        reject(new Error('timed out'));
      }
    }, 20);
  });
}

// Main plugin class
export default class CustomCommands extends Plugin {
  settings: CustomCommandsSettings;

  async onload() {
    // hide window buttons on macOS
    const w = remote.getCurrentWindow() as any;
    if (w.setWindowButtonVisibility) {
      w.setWindowButtonVisibility(false);
    }

    this.registerMarkdownPostProcessor((el) => {
      el.findAll('a.footnote-link').forEach((footnote) => {
        // remove brackets around footnote links
        const text = footnote.textContent || '';
        if (text.startsWith('[') && text.endsWith(']')) {
          footnote.textContent = text.slice(1, -1);
        }
      });
    });

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (l: WorkspaceLeaf | null) => {
        if (l && l.view.getViewType() === 'outline') {
          // sync focused item in outline with cursor position
          const { tree, cachedHeadingDom } = l.view as any;
          const { focusedItem } = tree;
          const activeItem = cachedHeadingDom.find((h: any) =>
            h.selfEl.classList.contains('is-active'),
          );
          if (focusedItem !== activeItem)
            tree.setFocusedItem(activeItem);
        }
      }),
    );

    this.register(
      onElement(
        document as any,
        'click',
        `.markdown-rendered button.copy-code-button,
        .markdown-source-view .cm-line .cm-indent`,
        this.clickListener.bind(this),
      ),
    );
    this.register(
      onElement(
        document as any,
        'mouseover',
        '.markdown-source-view .cm-line .cm-indent',
        this.mouseListener.bind(this),
      ),
    );
    this.register(
      onElement(
        document as any,
        'mouseout',
        '.markdown-source-view .cm-line .cm-indent',
        this.mouseListener.bind(this),
      ),
    );

    document.addEventListener('keydown', this.keydownListener.bind(this));

    await this.loadSettings();

    this.addCommand({
      id: 'bold',
      name: 'Toggle bold',
      editorCallback: editor => this.toggleStyle(editor, 'strong'),
    });
    this.addCommand({
      id: 'italic',
      name: 'Toggle italic',
      editorCallback: editor => this.toggleStyle(editor, 'em'),
    });
    this.addCommand({
      id: 'strikethrough',
      name: 'Toggle strikethrough',
      editorCallback: editor => this.toggleStyle(editor, 'strikethrough'),
    });
    this.addCommand({
      id: 'code',
      name: 'Toggle code',
      editorCallback: editor => this.toggleStyle(editor, 'inline-code'),
    });
    this.addCommand({
      id: 'html-comment',
      name: 'Toggle HTML comment',
      editorCallback: editor => this.toggleStyle(editor, 'comment'),
    });
    this.addCommand({
      id: 'highlight',
      name: 'Toggle highlight',
      editorCallback: editor => this.toggleStyle(editor, 'highlight'),
    });
    this.addCommand({
      id: 'html-underline',
      name: 'Underline',
      editorCallback: editor => this.toggleTag(editor, 'u'),
    });
    this.addCommand({
      id: 'link',
      name: 'Toggle link',
      editorCallback: editor => this.toggleLink(editor),
    });
    this.addCommand({
      id: 'heading-0',
      name: 'Unset heading',
      editorCallback: editor => this.toggleHeading(editor),
    });
    this.addCommand({
      id: 'heading-1',
      name: 'Toggle heading 1',
      editorCallback: editor => this.toggleHeading(editor, 1),
    });
    this.addCommand({
      id: 'heading-2',
      name: 'Toggle heading 2',
      editorCallback: editor => this.toggleHeading(editor, 2),
    });
    this.addCommand({
      id: 'heading-3',
      name: 'Toggle heading 3',
      editorCallback: editor => this.toggleHeading(editor, 3),
    });
    this.addCommand({
      id: 'heading-4',
      name: 'Toggle heading 4',
      editorCallback: editor => this.toggleHeading(editor, 4),
    });
    this.addCommand({
      id: 'heading-5',
      name: 'Toggle heading 5',
      editorCallback: editor => this.toggleHeading(editor, 5),
    });
    this.addCommand({
      id: 'heading-6',
      name: 'Toggle heading 6',
      editorCallback: editor => this.toggleHeading(editor, 6),
    });
    this.addCommand({
      id: 'copy-path',
      name: 'Copy file full path',
      editorCallback: () => this.copyPath(),
    });
    this.addCommand({
      id: 'delete-file',
      name: 'Delete current file',
      callback: () => this.deleteFile(),
    });
    this.addCommand({
      id: 'navigate-top',
      name: 'Navigate to top',
      callback: () => this.navigate('top'),
    });
    this.addCommand({
      id: 'navigate-bottom',
      name: 'Navigate to bottom',
      callback: () => this.navigate('bottom'),
    });
    this.addCommand({
      id: 'navigate-left',
      name: 'Navigate to left',
      callback: () => this.navigate('left'),
    });
    this.addCommand({
      id: 'navigate-right',
      name: 'Navigate to right',
      callback: () => this.navigate('right'),
    });
    this.addCommand({
      id: 'close',
      name: 'Close',
      callback: () => this.closeEditor(),
    });
    this.addCommand({
      id: 'new-file-in-path',
      name: 'Create new file in path',
      callback: () => this.newFileInPath(),
    });
    this.addCommand({
      id: 'new-tab',
      name: 'New tab',
      callback: () => {
        (this.app as any).commands.executeCommandById('workspace:new-tab');
        (this.app as any).commands.executeCommandById(
          'obsidian-another-quick-switcher:search-command_floating-search',
        );
      },
    });

    console.log('Custom Commands Plugin loaded.');
  }

  async onunload() {
    const w = remote.getCurrentWindow() as any;
    if (w.setWindowButtonVisibility)
      w.setWindowButtonVisibility(true);
    document.removeEventListener('keydown', this.keydownListener);
    console.log('Custom Commands Plugin unloaded.');
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
    );
  }

  /* wrap selection with prefix and suffix strings */
  wrapSelection(
    beforeStr: string,
    afterStr: string,
    editor: Editor,
  ): { anchor: EditorPosition, head: EditorPosition } | void {
    const pos = editor.getCursor();
    let selection: [EditorPosition, EditorPosition] = [
      editor.getCursor('from'),
      editor.getCursor('to'),
    ];
    let selectedText = editor.getSelection();
    if (!editor.somethingSelected()) {
      const wordAt = editor.wordAt(pos);
      pos.ch += beforeStr.length;
      if (wordAt) {
        selection = [wordAt.from, wordAt.to];
        selectedText = editor.getRange(wordAt.from, wordAt.to);
      }
    }
    editor.replaceRange(beforeStr + selectedText + afterStr, ...selection);
    if (!editor.somethingSelected())
      return { anchor: pos, head: pos };
  }

  /* toggle HTML tag under cursor */
  toggleTag(editor: Editor, tagName: string) {
    let endSelection;
    const pos = editor.getCursor();
    const line = editor.getLine(pos.line);
    const checkTagOpen = new RegExp(`<${tagName}>(?!.*</${tagName}>)`);
    const checkTagClose = new RegExp(`(?!<${tagName}>.*)</${tagName}>`);
    let tagOpen, tagClose;
    tagOpen = line.slice(0, pos.ch + tagName.length + 1).match(checkTagOpen);
    tagClose = line.slice(pos.ch + tagName.length + 1).match(checkTagClose);
    if (tagOpen && tagClose) {
      const newStr = editor
        .getLine(pos.line)
        .slice(
          tagOpen.index! + tagOpen[0].length,
          pos.ch + tagName.length + 1 + tagClose.index!,
        );
      editor.replaceRange(
        newStr,
        { line: pos.line, ch: tagOpen.index! },
        {
          line: pos.line,
          ch: pos.ch + tagName.length + 1 + tagClose.index! + tagClose[0].length,
        },
      );
      pos.ch -= Math.min(pos.ch - tagOpen.index!, tagOpen[0].length);
      endSelection = { anchor: pos, head: pos };
    } else {
      tagOpen = line.slice(0, pos.ch - tagName.length - 1).match(checkTagOpen);
      tagClose = line.slice(pos.ch - tagName.length - 1).match(checkTagClose);
      if (tagOpen && tagClose) {
        const newStr = editor
          .getLine(pos.line)
          .slice(
            tagOpen.index! + tagOpen[0].length,
            pos.ch - tagName.length - 1 + tagClose.index!,
          );
        editor.replaceRange(
          newStr,
          { line: pos.line, ch: tagOpen.index! },
          {
            line: pos.line,
            ch: pos.ch - tagName.length - 1 + tagClose.index! + tagClose[0].length,
          },
        );
        pos.ch -= Math.max(0, tagName.length + 1 - tagClose.index!) + tagOpen[0].length;
        endSelection = { anchor: pos, head: pos };
      } else {
        endSelection = this.wrapSelection(
          `<${tagName}>`,
          `</${tagName}>`,
          editor,
        );
      }
    }
    if (endSelection)
      editor.setSelection(endSelection.anchor, endSelection.head);
  }

  /* toggle markdown style under cursor */
  toggleStyle(editor: Editor, style: string) {
    const map: { [key: string]: [string, string] } = {
      'strong': ['**', '**'],
      'em': ['*', '*'],
      'comment': ['<!-- ', ' -->'],
      'strikethrough': ['~~', '~~'],
      'highlight': ['==', '=='],
      'inline-code': ['`', '`'],
    };
    let cursor: EditorPosition | undefined;
    const selection = (editor as any).cm.root.getSelection();
    const positions: EditorPosition[] = [];
    if (selection.type === 'Caret') {
      cursor = editor.getCursor();
      const node = selection.focusNode.parentNode?.closest(`.cm-${style}`);
      if (node) {
        const range: any[] = [node.cmView];
        if (style === 'comment') {
          positions.push(
            editor.offsetToPos(node.cmView.posAtStart),
            editor.offsetToPos(node.cmView.posAtEnd),
          );
          const text = editor
            .getRange(...(positions as [EditorPosition, EditorPosition]))
            .replace(/^<!-- *| *-->$/g, '');
          editor.replaceRange(
            text,
            ...(positions as [EditorPosition, EditorPosition]),
          );
          return;
        } else if (node.matches('.cm-formatting')) {
          if (
            node.nextElementSibling?.matches(`.cm-${style}:not(.cm-formatting)`)
            && node.nextElementSibling.nextElementSibling?.matches(`.cm-${style}.cm-formatting`)
          ) {
            range.push(
              node.nextElementSibling.cmView,
              node.nextElementSibling.nextElementSibling.cmView,
            );
          } else if (
            node.previousElementSibling?.matches(`.cm-${style}:not(.cm-formatting)`)
            && node.previousElementSibling.previousElementSibling?.matches(`.cm-${style}.cm-formatting`)
          ) {
            range.push(
              node.previousElementSibling.cmView,
              node.previousElementSibling.previousElementSibling.cmView,
            );
          }
        } else if (
          node.previousElementSibling?.matches(`.cm-${style}.cm-formatting`)
          && node.nextElementSibling?.matches(`.cm-${style}.cm-formatting`)
        ) {
          range.push(
            node.previousElementSibling.cmView,
            node.nextElementSibling.cmView,
          );
        }
        if (range.length === 3) {
          range.sort((a, b) => a.posAtStart - b.posAtStart);
          positions.push(
            editor.offsetToPos(range[0].posAtStart),
            editor.offsetToPos(range[2].posAtEnd),
          );
          let newOffset = Math.max(
            editor.posToOffset(cursor) - range[0].dom.textContent.length,
            range[0].posAtStart,
          );
          newOffset = Math.min(
            newOffset,
            range[2].posAtStart - range[0].dom.textContent.length,
          );
          editor.replaceRange(
            range[1].dom.textContent,
            ...(positions as [EditorPosition, EditorPosition]),
          );
          editor.setCursor(editor.offsetToPos(newOffset));
          return;
        }
      }
      const wordAt = editor.wordAt(cursor);
      if (!wordAt)
        return;
      positions.push(wordAt.from, wordAt.to);
      cursor.ch += map[style][0].length;
    } else {
      positions.push(editor.getCursor('from'), editor.getCursor('to'));
    }
    const text = editor.getRange(
      ...(positions as [EditorPosition, EditorPosition]),
    );
    editor.replaceRange(
      map[style][0] + text + map[style][1],
      ...(positions as [EditorPosition, EditorPosition]),
    );
    if (cursor)
      editor.setCursor(cursor);
  }

  /* toggle link under cursor */
  toggleLink(editor: Editor) {
    let endPos: EditorPosition | undefined;
    const pos = editor.getCursor();
    const line = editor.getLine(pos.line);
    const selection = (editor as any).cm.root.getSelection();
    if (selection.focusNode.parentElement.closest('.cm-link, .cm-url')) {
      const re = /\[([^\]]*)\]\([^)]*\)/;
      let x = 0;
      let match = re.exec(line.slice(x));
      while (match) {
        if (
          (pos.ch >= x + match.index && pos.ch < x + match.index + match[0].length)
          || (pos.ch > x + match.index && pos.ch <= x + match.index + match[0].length)
        ) {
          editor.replaceRange(
            match[1],
            { line: pos.line, ch: x + match.index },
            { line: pos.line, ch: x + match.index + match[0].length },
          );
          if (pos.ch >= x + match.index + match[1].length) {
            pos.ch = x + match.index + match[1].length - 1;
          } else if (pos.ch > x + match.index + 1) {
            pos.ch -= 1;
          } else {
            pos.ch = x + match.index;
          }
          endPos = pos;
          break;
        } else {
          x += match.index + match[0].length;
          match = re.exec(line.slice(x));
        }
      }
    } else if (selection.focusNode.parentElement.closest('.cm-hmd-internal-link')) {
      const re = /\[\[(.*?)\]\]/;
      let x = 0;
      let match = re.exec(line.slice(x));
      while (match) {
        if (
          pos.ch >= x + match.index
          && pos.ch < x + match.index + match[0].length
        ) {
          if (match[1].includes('|'))
            match[1] = match[1].split('|')[1];
          editor.replaceRange(
            match[1],
            { line: pos.line, ch: x + match.index },
            { line: pos.line, ch: x + match.index + match[0].length },
          );
          if (pos.ch >= x + match.index + match[1].length) {
            pos.ch = x + match.index + match[1].length - 1;
          } else if (pos.ch > x + match.index + 2) {
            pos.ch -= 2;
          } else {
            pos.ch = x + match.index;
          }
          endPos = pos;
          break;
        } else {
          x += match.index + match[0].length;
          match = re.exec(line.slice(x));
        }
      }
    } else {
      if (selection.type === 'Caret') {
        const wordAt = editor.wordAt(pos);
        if (wordAt)
          editor.setSelection(wordAt.from, wordAt.to);
      }
      (this.app as any).commands.executeCommandById('editor:insert-link');
    }
    if (endPos)
      editor.setCursor(endPos);
  }

  /* toggle heading level */
  toggleHeading(editor: Editor, level?: number) {
    const line = editor.getLine(editor.getCursor().line);
    (editor as any).setHeading(
      !level || new RegExp(`^#{${level}} `).test(line) ? 0 : level,
    );
  }

  /* show notification */
  notify(message: string, timeout: number = 1000) {
    // eslint-disable-next-line no-new
    new Notice(message, timeout);
  }

  /* copy current file full path to clipboard */
  copyPath() {
    const file = this.app.workspace.getActiveFile();
    if (!file)
      return;
    const path = `${(this.app.vault.adapter as any).basePath}/${file.path}`;
    navigator.clipboard.writeText(path);
    this.notify('Path copied to clipboard!');
  }

  /* navigate between panes, tabs, or splits */
  navigate(direction: 'top' | 'bottom' | 'left' | 'right') {
    const { workspace, commands } = this.app as any;
    if (
      (document.activeElement?.matches('.prompt-input') || document.querySelector('.suggestion-container'))
      && ['top', 'bottom'].includes(direction)
    ) { // navigate up/down in command palette or quick switcher
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: direction === 'top' ? 'p' : 'n',
          ctrlKey: true,
        }),
      );
    } else if (workspace.getAdjacentLeafInDirection(workspace.activeLeaf, direction)) { // navigate to adjacent leaf
      commands.executeCommandById(`editor:focus-${direction}`);
    } else if (direction === 'right') {
      if (workspace.activeTabGroup.currentTab < workspace.activeTabGroup.children.length - 1) { // navigate to next tab, if any
        commands.executeCommandById(`workspace:next-tab`);
      } else if (!workspace.rightSplit.collapsed) { // navigate to sidebar, if opened
        const split = workspace.rightSplit.children[0] as any;
        workspace.setActiveLeaf(split.children[split.currentTab], {
          focus: true,
        });
      } else {
        const header = workspace.activeLeaf.tabHeaderEl;
        if (header?.matches(".is-active.mod-active"))
          header.click();
      }
    } else if (direction === 'left') {
      if (workspace.activeTabGroup.currentTab > 0) {
        commands.executeCommandById(`workspace:previous-tab`);
      } else if (!workspace.leftSplit.collapsed) {
        const split = workspace.leftSplit.children[0] as any;
        workspace.setActiveLeaf(split.children[split.currentTab], {
          focus: true,
        });
      } else {
        const header = workspace.activeLeaf.tabHeaderEl;
        if (header?.matches(".is-active.mod-active"))
          header.click();
      }
    }
  }

  /* create new file in current file's folder */
  newFileInPath() {
    const activeLeaf = this.app.workspace.getLeaf();
    if (!activeLeaf || !(activeLeaf.view as any).file)
      return;
    const { parent } = (activeLeaf.view as any).file;
    (this.app.fileManager as any)
      .createNewMarkdownFile(parent)
      .then((file: TFile) => activeLeaf.openFile(file));
  }

  /* smart close */
  closeEditor() {
    const activeLeaf = this.app.workspace.getLeaf();
    if (!activeLeaf)
      return;
    const { view, history } = activeLeaf as any;
    const onlyOne
      = (this.app.workspace.rootSplit as any).children.length === 1
        && (this.app.workspace.rootSplit as any).children[0].children.length === 1
        && (this.app.workspace as any).activeTabGroup.children.length === 1;
    if (onlyOne && (view as any).emptyStateEl) { // if only one empty tab, close window
      window.close();
    } else if (onlyOne && history.backHistory.length > 0) { // if only one tab with history, go back
      (this.app as any).commands.executeCommandById('app:go-back');
    } else { // close current tab
      (this.app as any).commands.executeCommandById('workspace:close');
    }
  }

  /* move file to trash and close current tab */
  deleteFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file)
      return;
    this.closeEditor();
    this.app.fileManager.trashFile(file);
  }

  /* fold/unfold sublists under current indent level */
  foldSublists(target: HTMLElement) {
    const getLevel = (el: HTMLElement) =>
      el?.querySelector('span[class*="cm-list-"]')
        ? el.querySelectorAll('.cm-indent').length + 1
        : 0;
    const indent = target;
    if (!indent.parentElement)
      return;
    const level = Array.from(indent.parentElement.children).indexOf(indent) + 1;
    const currentLine = target.closest('.cm-line');
    if (!currentLine)
      return;
    const subLists: HTMLElement[] = [];
    let line = currentLine.previousElementSibling as HTMLElement;
    while (line && getLevel(line) > level) {
      if (line.querySelector('.cm-fold-indicator'))
        subLists.unshift(line.querySelector('.cm-fold-indicator') as HTMLElement);
      line = line.previousElementSibling as HTMLElement;
    }
    line = currentLine as HTMLElement;
    while (line && getLevel(line) > level) {
      if (line.querySelector('.cm-fold-indicator'))
        subLists.push(line.querySelector('.cm-fold-indicator') as HTMLElement);
      line = line.nextElementSibling as HTMLElement;
    }
    if (subLists.length === 0)
      return;
    const shouldFold = subLists.some(l => !l.classList.contains('is-collapsed'));
    subLists.forEach((l) => {
      const isCollapsed = l.classList.contains('is-collapsed');
      if (shouldFold !== isCollapsed)
        l.click();
    });
  }

  clickListener(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.matches('.markdown-source-view .cm-line .cm-indent')) {
      // click on indent to fold/unfold sublists
      event.preventDefault();
      this.foldSublists(target);
    } else if (target.closest('.markdown-rendered button.copy-code-button')) {
      // show animation after clicking copy code button
      const button = target.closest('.markdown-rendered button.copy-code-button');
      if (!button)
        return;
      button.classList.add('copied');
      setTimeout(() => button.classList.remove('copied'), 2000);
    }
  }

  mouseListener(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.matches('.markdown-source-view .cm-line .cm-indent')) {
      // highlight indent line on hover
      event.preventDefault();
      const indent = target;
      if (!indent.parentElement)
        return;
      const level = Array.from(indent.parentElement.children).indexOf(indent) + 1;
      const selector = `span.cm-indent:nth-child(${level})`;
      const currentLine = target.closest('.cm-line');
      if (!currentLine)
        return;
      const line = currentLine as HTMLElement;
      const idt: (HTMLElement | null)[] = [line.querySelector(selector)];
      let nextLine = line.previousElementSibling as HTMLElement;
      while (nextLine && nextLine.querySelector(selector)) {
        idt.push(nextLine.querySelector(selector));
        nextLine = nextLine.previousElementSibling as HTMLElement;
      }
      nextLine = line.nextElementSibling as HTMLElement;
      while (nextLine && nextLine.querySelector(selector)) {
        idt.push(nextLine.querySelector(selector));
        nextLine = nextLine.nextElementSibling as HTMLElement;
      }
      idt.forEach(i =>
        i?.classList[event.type === 'mouseover' ? 'add' : 'remove']('cm-active-indent'),
      );
    }
  }

  keydownListener(e: KeyboardEvent) {
    // NOTE: getLeaf() only returns editor leaf, not sidebar leaf
    // so activeLeaf is still needed
    const { activeLeaf } = this.app.workspace;
    if (!activeLeaf)
      return;
    const view = activeLeaf.view as any;
    const type = view.getViewType();
    const { tree, containerEl: pane } = view;
    if (e.metaKey && e.key === 'c' && type === 'file-explorer') {
      const basePath = (this.app.vault.adapter as any).basePath;
      const text = `${basePath}/${tree.focusedItem.file.path}`;
      navigator.clipboard.writeText(text);
      return;
    }
    if (
      document.activeElement?.matches('.prompt-input')
      && ['j', 'k'].includes(e.key)
      && e.ctrlKey
    ) {
      // navigate up/down in command palette or quick switcher
      e.preventDefault();
      const map = { j: 'arrowdown', k: 'arrowup' };
      const key = map[e.key as 'j' | 'k'];
      document.dispatchEvent(new KeyboardEvent('keydown', { key }));
      return;
    } else if (
      pane?.closest('.mod-sidedock')
      && ['n', 'p'].includes(e.key)
      && e.ctrlKey
    ) {
      // navigate next/previous tab in side dock
      const tab = (activeLeaf as any).tabHeaderEl;
      if (e.key === 'p') {
        (tab.previousElementSibling || tab.parentElement.lastElementChild).click();
      } else {
        (tab.nextElementSibling || tab.parentElement.firstElementChild).click();
      }
      return;
    } else if (
      ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement).tagName)
      || document.activeElement?.matches('[class*="metadata-input"], [role="textbox"], [contenteditable="true"]')
      || document.querySelector('.jl.popover, .vimium-marker')
      || !pane
      || pane.querySelector('.has-focus.is-being-renamed')
      || e.ctrlKey
      || e.altKey
      || e.metaKey
    ) {
      return;
    }
    if (view.metadataEditor?.hasPropertyFocused()) {
      if (e.key === 'd') {
        // delete selected properties in metadata editor
        const properties: any[] = [];
        const editor = view.metadataEditor;
        if (editor.selectedLines.size) {
          editor.selectedLines.values().forEach((p: any) => properties.push(p));
        } else {
          const focused = editor.rendered.find(
            (p: any) => p.containerEl === document.activeElement,
          );
          properties.push(focused);
        }
        editor.removeProperties(properties);
      }
      return;
    } else if (document.activeElement?.matches('.metadata-properties-heading')) {
      if (e.key === 'l' || e.key === 'o') // collapse/expand properties
        (document.activeElement as HTMLElement).click();
      return;
    }
    if (!['markdown', 'kanban', 'canvas', 'lineage', 'pdf', 'empty', 'bases'].includes(type)) { // sidebars
      e.preventDefault();
      switch (e.key) {
        case 'h': // navigate to parent
          tree?.onKeyArrowLeft(e);
          break;
        case 'j':
        case 'J': // navigate down
          tree?.onKeyArrowDown(e);
          break;
        case 'k':
        case 'K': // navigate up
          tree?.onKeyArrowUp(e);
          break;
        case 'l':
        case 'o':
          if (tree) {
            const focused = tree.focusedItem;
            if (focused.collapsible) {
              if (e.key === 'o' || type === 'file-explorer') { // toggle collapse
                focused.toggleCollapsed();
              } else { // open
                tree.onKeyOpen(e);
              }
            } else { // open file and close sidebar
              tree.onKeyOpen(e);
              if (type === 'file-explorer')
                (this.app as any).commands.executeCommandById('app:toggle-left-sidebar');
            }
          }
          break;
        case 'L':
        case 'O': // open file in new tab
          pane.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Enter',
              metaKey: true,
              shiftKey: false,
            }),
          );
          if (type === 'file-explorer')
            (this.app as any).commands.executeCommandById('app:toggle-left-sidebar');
          break;
        case 'd':
          if (type === 'file-explorer') {
            if (document.querySelector('.mod-confirmation')) { // confirm delete
              (document.querySelector('.mod-confirmation button.mod-warning') as HTMLElement).click();
            } else { // delete file/folder
              tree.handleDeleteSelectedItems(e);
            }
          }
          break;
        case 'r':
          if (type === 'file-explorer') // rename file/folder
            tree.handleRenameFocusedItem(e);
          break;
        case 'a':
        case 'A':
          if (type === 'file-explorer') { // create new file/folder
            let target = tree.focusedItem.file;
            if (target) {
              target = target.children ? target : target.parent;
              const func = `createNew${e.shiftKey ? 'Folder' : 'MarkdownFile'}`;
              (this.app.fileManager as any)[func](target).then(
                (file: TFile) => {
                  const folderItem = pane.querySelector(`.tree-item-self[data-path="${target.path}"]`);
                  if (folderItem?.parentElement?.matches('.is-collapsed'))
                    (folderItem as HTMLElement).click();
                  sleepUntil(
                    () => view.fileItems[file.path],
                    1000,
                  ).then((item) => {
                    tree.setFocusedItem(item);
                    tree.handleRenameFocusedItem(e);
                  });
                },
              );
            }
          }
          break;
        case 'P':
          if (type === 'file-explorer') {
            const hoverEditor = (this.app as any).plugins.plugins['obsidian-hover-editor'];
            const { activePopovers } = hoverEditor;
            if (activePopovers.length === 1) {
              const p = activePopovers[0];
              const l = p.leaves()[0];
              if (l.view.file.path === tree.focusedItem.file.path) {
                this.app.workspace.setActiveLeaf(l, { focus: true });
                return;
              } else {
                p.hide();
              }
            } else {
              hoverEditor.activePopovers.forEach((p: any) => p.hide());
            }
            hoverEditor
              .spawnPopover()
              .openFile(tree.focusedItem.file);
          }
          break;
        case 'y': {
          let text: string;
          if (type === 'file-explorer') {
            text = tree.focusedItem.file.path.replace(/\.md$/, '');
          } else {
            text = tree.focusedItem.innerEl.textContent;
          }
          navigator.clipboard.writeText(text);
          this.notify(`Yanked: ${text}`);
          break;
        }
        case 'Y':
          if (type === 'file-explorer') {
            const basePath = (this.app.vault.adapter as any).basePath;
            const text = `${basePath}/${tree.focusedItem.file.path}`;
            navigator.clipboard.writeText(text);
            this.notify(`Yanked: ${text}`);
          }
          break;
        case 'g':
          tree.containerEl.scrollTo({ top: 0 });
          tree.setFocusedItem(tree.infinityScroll.rootEl.vChildren._children[0]);
          break;
        case 'G':
          tree.containerEl.scrollTo({ top: tree.containerEl.scrollHeight });
          tree.setFocusedItem(tree.infinityScroll.rootEl.vChildren._children.at(-1));
          break;
        case 'q':
          if (pane.closest('.mod-left-split')) {
            (this.app as any).commands.executeCommandById('app:toggle-left-sidebar');
          } else if (pane.closest('.mod-right-split')) {
            (this.app as any).commands.executeCommandById('app:toggle-right-sidebar');
          }
          break;
        case 'S':
          (
            pane.querySelector('.nav-action-button[aria-label*="Change sort order"]') as HTMLElement
          )?.click();
          break;
        case '/':
          (
            pane.querySelector('.nav-action-button[aria-label*="Show search filter"]') as HTMLElement
          )?.click();
          break;
        case '{':
          (
            pane.querySelector('.nav-action-button[aria-label="Collapse all"]') as HTMLElement
          )?.click();
          break;
        case '}':
          (
            pane.querySelector('.nav-action-button[aria-label="Expand all"]') as HTMLElement
          )?.click();
          break;
      }
    } else if (type === 'empty') { // empty view
      const commands: { [key: string]: string } = {
        e: 'file-explorer:new-file',
        f: 'obsidian-another-quick-switcher:search-command_recommended-search',
        g: 'omnisearch:show-modal',
        r: 'obsidian-another-quick-switcher:search-command_recent-search',
        q: 'obsidian-custom-commands:close',
      };
      if (commands[e.key]) {
        e.preventDefault();
        (this.app as any).commands.executeCommandById(commands[e.key]);
      }
    } else if (type === 'canvas') { // canvas
      let command: string | undefined;
      switch (e.key) {
        case 'j':
        case 'k':
        case 'h':
        case 'l':
        case 't':
        case 'f':
        case 'z': { // navigate, create node, zoom
          if (view.canvas.selection.size === 0) {
            const node = [...view.canvas.nodes.values()][0];
            view.canvas.select(node);
          }
          const map: { [key: string]: string } = {
            j: 'navigate-down',
            k: 'navigate-up',
            h: 'navigate-left',
            l: 'navigate-right',
            t: 'create-text-node',
            f: 'create-file-node',
            z: 'zoom-to-selection',
          };
          command = `advanced-canvas:${map[e.key]}`;
          break;
        }
        case 'J':
        case 'K':
        case 'H':
        case 'L': { // scroll canvas
          view.canvas.canvasEl.style.transform = view.canvas.canvasEl.style.transform.replace(
            /\(([-.0-9]+)px, ([-.0-9]+)px\)$/,
            (...x: any[]) => {
              switch (e.key) {
                case 'J':
                  x[2] = Number.parseFloat(x[2]) - 10;
                  break;
                case 'K':
                  x[2] = Number.parseFloat(x[2]) + 10;
                  break;
                case 'H':
                  x[1] = Number.parseFloat(x[1]) + 10;
                  break;
                case 'L':
                  x[1] = Number.parseFloat(x[1]) - 10;
                  break;
              }
              return `(${x[1]}px, ${x[2]}px)`;
            },
          );
          break;
        }
        case 'd': { // delete node
          view.canvas.deleteSelection();
          break;
        }
        case 'i': { // edit text node
          const node = [...view.canvas.selection][0];
          if (node)
            node.startEditing();
          break;
        }
        case '/': // open search
          (
            pane.querySelector('.nav-action-button[aria-label*="Show search filter"]') as HTMLElement
          )?.click();
          break;
      }
      if (command) {
        e.preventDefault();
        (this.app as any).commands.executeCommandById(command);
      }
    } else if (
      (type === 'markdown' && view.getMode() === 'preview')
      || ['pdf', 'kanban', 'bases'].includes(type)
    ) { // markdown preview, pdf, kanban, bases
      let v: HTMLElement | undefined | null;
      switch (type) {
        case 'markdown':
          v = view.previewMode.renderer.previewEl;
          break;
        case 'pdf':
          v = view.viewer.child.pdfViewer.pdfViewer.container;
          break;
        case 'kanban':
          if (document.activeElement?.matches('.cm-content'))
            return;
          v = view.contentEl.querySelector('.kanban-plugin__scroll-container');
          break;
        case 'bases':
          v = view.contentEl.querySelector('.bases-view');
          break;
      }
      let top: number | undefined, left: number | undefined, command: string | undefined, event: KeyboardEvent | undefined;
      switch (e.key) {
        case 'j':
          top = 5;
          break;
        case 'k':
          top = -5;
          break;
        case 'd':
          top = 200;
          break;
        case 'u':
          top = -200;
          break;
        case 'f':
          event = new KeyboardEvent('keydown', { key: 'PageDown' });
          break;
        case 'b':
          event = new KeyboardEvent('keydown', { key: 'PageUp' });
          break;
        case 'g':
          top = -v!.scrollTop;
          break;
        case 'G':
          top = v!.scrollHeight;
          break;
        case 'h':
          left = -15;
          break;
        case 'H':
          left = -v!.scrollWidth;
          break;
        case 'l':
          left = 15;
          break;
        case 'L':
          left = v!.scrollWidth;
          break;
        case 'q':
        case 'i': // enter edit mode in markdown preview
          if (type === 'markdown')
            command = 'markdown:toggle-preview';
          break;
        case '[': // back in history
          command = 'app:go-back';
          break;
        case ']': // forward in history
          command = 'app:go-forward';
          break;
        case '/': // open search
          command = 'editor:open-search';
          break;
        case '+': // zoom in in pdf
          if (type === 'pdf')
            (view.viewer.child.pdfViewer.toolbar.zoomInEl as HTMLElement).click();
          break;
        case '-': // zoom out in pdf
          if (type === 'pdf')
            (view.viewer.child.pdfViewer.toolbar.zoomOutEl as HTMLElement).click();
          break;
      }
      if (top) {
        e.preventDefault();
        v?.scrollBy({ top });
      } else if (left) {
        e.preventDefault();
        v?.scrollBy({ left });
      } else if (command) {
        e.preventDefault();
        (this.app as any).commands.executeCommandById(command);
      } else if (event) {
        e.preventDefault();
        v?.dispatchEvent(event);
      }
    }
  }
}
