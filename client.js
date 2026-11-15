/** Local-only, manual notes. The Host owns validation, authorization and SQLite. */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-local-memory',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useRef, useSyncExternalStore } = React;
    const NS = 'localMemory';
    const CHANNEL = '/local-memory';
    const PAGE = 20;
    const dictionaries = {
      en: {
        reviewed: 'I checked the current state',
        ackConfirm: 'Have you refreshed the list and inspected the current note? Continuing does not cancel the earlier request. Repeating a new-note save may create a duplicate; stale updates/deletes will be refused.',
        nav: 'Local memory', title: 'Local memory', description: 'Small, manual notes for one workspace at a time.',
        privacy: 'Manual only: this plugin does not automatically upload, summarize or extract chats, and makes no extra model/API calls. The database is plaintext on this machine; saved notes are independent of chat deletion. If the assistant retrieves a note into a cloud-model conversation, that content is sent to the model provider.',
        uncertainOrigin: 'Unconfirmed operation: {operation}; workspace: {workspace}; note: {title}',
        workspace: 'Workspace', choose: 'Choose a workspace…', missingProject: 'Workspace is no longer registered',
        refreshProjects: 'Refresh workspaces', loading: 'Loading…', refresh: 'Refresh list', search: 'Search', searchPlaceholder: 'Search notes in this workspace',
        newNote: 'New note', edit: 'Edit note', untitled: 'Untitled note', noProject: 'Choose a registered workspace to view or save notes. Notes are never searched across all projects.',
        noWorkspaces: 'No registered workspaces. Add a workspace from the sidebar, then refresh this page’s workspace list.',
        empty: 'No notes in this workspace yet.', noMatches: 'No notes match your search.', selectNote: 'Select a note or create a new one.',
        count: '{count} notes', results: '{count} matching notes', previous: 'Previous', next: 'Next', page: 'Page {page}',
        noteTitle: 'Title', body: 'Note', tags: 'Tags', tagsHint: 'Optional; separate with commas. Up to 8 tags, 24 characters each.',
        titleHint: 'Up to 120 characters', bodyHint: '{count}/8000 characters', save: 'Save note', saving: 'Saving…',
        closeEditor: 'Close editor', delete: 'Delete', deleting: 'Deleting…', saved: 'Note saved.', deleted: 'Note deleted.',
        discard: 'Discard the unsaved changes to this note?',
        deleteConfirm: 'Permanently delete “{title}” from workspace “{workspace}”? This cannot be undone. Deleting this note does not remove copies already in chats, backups or cloud-model systems.',
        deleteDraft: 'The unsaved draft for this note will also be discarded.',
        reloadLatest: 'Reload latest version', unsaved: 'Unsaved changes', created: 'Created', updated: 'Updated', source: 'Source session',
        storage: 'Local database', manual: 'Manual notes only', projectPath: 'Workspace directory',
        invalidTitle: 'Enter a title of 1–120 characters.', invalidBody: 'Enter a note of 1–8000 characters.', invalidTags: 'Use at most 8 tags, each 1–24 characters.',
        BAD_REQUEST: 'The request was not valid. Check the note’s fields and limits.',
        NO_PROJECT: 'This workspace is not available. Refresh the workspace list; your draft is retained.',
        NOT_FOUND: 'This note no longer exists. Your draft is retained; refresh the list to check its current state.',
        CONFLICT: 'This note changed elsewhere. Your draft has NOT been overwritten. Copy anything you need, then reload the latest version before saving or deleting again.',
        SECRET_DETECTED: 'The note was not saved because it appears to contain a credential or secret. Remove sensitive values before trying again.',
        LIMIT: 'A note or workspace limit was reached. Check the field limits (maximum 1000 notes per workspace).',
        STORE_BUSY: 'The local database is busy. Your draft is retained. Try again when the other operation has finished.',
        STORE_UNAVAILABLE: 'The local database is unavailable. Your draft is retained; do not assume it has been saved.',
        FORBIDDEN: 'Only the DSH device owner may manage local memory.',
        TRANSPORT: 'The connection to the DSH Host failed. Your draft is retained.',
        PROTOCOL: 'The Host returned an unexpected response. Your draft is retained.',
        UNKNOWN: 'The operation failed. Your draft is retained.',
        uncertain: 'The save/delete result is unconfirmed because the connection or response failed. Do not immediately repeat it: refresh the list and inspect the note first. Your draft is retained.',
      },
      zh: {
        reviewed: '我已检查，了解风险，允许继续',
        ackConfirm: '你是否已刷新列表并检查当前笔记？继续操作不表示上一次请求失败或已取消；重试新建可能生成重复笔记，旧版本的更新/删除会被拒绝。',
        nav: '本地记忆', title: '本地记忆', description: '按工作区分别管理的轻量手动笔记。',
        privacy: '仅手动记忆：本插件不自动上传、总结或提炼聊天，也不额外调用模型/API。数据库以明文保存在本机，独立笔记不会随聊天删除而清理。如果智能体将笔记检索到云端模型的对话上下文中，笔记内容仍会发送给模型服务商。',
        uncertainOrigin: '尚未确认的操作：{operation}；工作区：{workspace}；笔记：{title}',
        workspace: '工作区', choose: '请选择工作区…', missingProject: '此工作区已不在注册列表中',
        refreshProjects: '刷新工作区', loading: '正在加载…', refresh: '刷新列表', search: '搜索', searchPlaceholder: '搜索当前工作区的笔记',
        newNote: '新建笔记', edit: '编辑笔记', untitled: '未命名笔记', noProject: '请先选择已注册的工作区，再查看或保存笔记。不会跨所有项目搜索。',
        noWorkspaces: '暂无已注册的工作区。请先从侧栏添加工作区，然后刷新此页的工作区列表。',
        empty: '此工作区暂无笔记。', noMatches: '没有匹配的笔记。', selectNote: '请选择一条笔记，或新建笔记。',
        count: '共 {count} 条笔记', results: '匹配 {count} 条笔记', previous: '上一页', next: '下一页', page: '第 {page} 页',
        noteTitle: '标题', body: '笔记正文', tags: '标签', tagsHint: '可选，用逗号分隔；最多 8 个，每个最多 24 字符。',
        titleHint: '最多 120 字符', bodyHint: '{count}/8000 字符', save: '保存笔记', saving: '正在保存…',
        closeEditor: '关闭编辑', delete: '删除', deleting: '正在删除…', saved: '笔记已保存。', deleted: '笔记已删除。',
        discard: '要放弃这条笔记尚未保存的修改吗？',
        deleteConfirm: '确定永久删除工作区“{workspace}”中的笔记“{title}”吗？此操作不可撤销。删除笔记不会撤回聊天、备份或云端模型系统中已经存在的副本。',
        deleteDraft: '此笔记尚未保存的草稿也将被放弃。',
        reloadLatest: '重新载入最新版本', unsaved: '有未保存的修改', created: '创建时间', updated: '更新时间', source: '来源会话',
        storage: '本地数据库', manual: '仅手动笔记', projectPath: '工作区目录',
        invalidTitle: '请输入 1–120 字符的标题。', invalidBody: '请输入 1–8000 字符的笔记正文。', invalidTags: '最多 8 个标签，每个须为 1–24 字符。',
        BAD_REQUEST: '请求无效，请检查笔记字段与长度限制。',
        NO_PROJECT: '此工作区不可用。请刷新工作区列表；你的草稿会保留。',
        NOT_FOUND: '此笔记已不存在。你的草稿会保留，请刷新列表检查当前状态。',
        CONFLICT: '此笔记已在别处更新，未覆盖你的草稿。请先复制需要保留的内容，再重新载入最新版本，然后保存或删除。',
        SECRET_DETECTED: '笔记疑似包含凭据或密钥，尚未保存。请移除敏感值后重试。',
        LIMIT: '已达到笔记或工作区限制。请检查字段长度（每个工作区最多 1000 条笔记）。',
        STORE_BUSY: '本地数据库正忙。你的草稿会保留，请待其他操作结束后重试。',
        STORE_UNAVAILABLE: '本地数据库不可用。你的草稿会保留，请勿认为已经保存。',
        FORBIDDEN: '只有 DSH 设备所有者可以管理本地记忆。',
        TRANSPORT: '与 DSH Host 的连接失败。你的草稿会保留。',
        PROTOCOL: 'Host 返回了意外格式的数据。你的草稿会保留。',
        UNKNOWN: '操作失败。你的草稿会保留。',
        uncertain: '连接或响应异常，无法确认保存/删除是否成功。请勿立即重复提交，应先刷新列表并查看笔记。你的草稿会保留。',
      },
    };

    function createController(ctx) {
      let state = { workspaces: [], workspacesLoading: false, initialized: false, workspaceId: '', storagePath: '',
        items: [], total: 0, hasMore: false, offset: 0, query: '', queryDraft: '', listLoading: false, listFailed: false,
        recordLoading: false, editor: null, draft: null, pending: '', conflict: false, uncertain: null, error: null, message: null };
      let disposed = false;
      let mutation = false;
      let activeWrite = null;
      let key = 0;
      let projectsPromise = null;
      const reads = {};
      const listeners = new Set();
      const publish = changes => {
        if (disposed) return;
        state = { ...state, ...changes };
        for (const listener of [...listeners]) listener();
      };
      const blank = () => ({ title: '', body: '', tagText: '' });
      const draftOf = record => ({ title: record.title, body: record.body, tagText: record.tags.join(', ') });
      const dirty = () => !!state.draft && JSON.stringify(state.draft) !== JSON.stringify(state.editor?.baseline);
      const project = () => state.workspaces.find(item => item.id === state.workspaceId);
      const t = (name, values) => ctx.locale.bind(NS)(name, values);
      const failure = (code = 'UNKNOWN') => Object.assign(new Error(code), { code });
      const report = (error, writing = false) => {
        const unknownWrite = writing && ['TRANSPORT', 'PROTOCOL'].includes(error?.code);
        publish({ error: unknownWrite ? 'uncertain' : typeof error?.code === 'string' && Object.hasOwn(dictionaries.en, error.code) ? error.code : 'UNKNOWN',
          uncertain: state.uncertain || (unknownWrite ? activeWrite : null), message: writing ? null : state.message });
      };
      const rpc = async (endpoint, payload, signal) => {
        let result, deadline;
        try { result = await Promise.race([ctx.connection.rpc.call(CHANNEL, endpoint, payload, signal),
          new Promise((_, reject) => { deadline = setTimeout(() => reject(failure('TRANSPORT')), 20000); })]); }
        catch { throw failure('TRANSPORT'); }
        finally { clearTimeout(deadline); }
        if (!result || typeof result.ok !== 'boolean') throw failure('PROTOCOL');
        if (!result.ok) throw failure(result.error?.code);
        return result.value;
      };
      const stopRead = kind => { reads[kind]?.abort(); delete reads[kind]; };
      const beginRead = kind => { stopRead(kind); return (reads[kind] = new AbortController()); };
      const current = (kind, request) => !disposed && reads[kind] === request && !request.signal.aborted;
      const cancelNoteReads = () => { stopRead('list'); stopRead('get'); };
      const validRecord = (record, full = false) => record && typeof record.id === 'string' && record.id.length > 0
        && typeof record.title === 'string' && Array.isArray(record.tags) && record.tags.every(tag => typeof tag === 'string')
        && Number.isSafeInteger(record.version) && record.version > 0 && (!full || typeof record.body === 'string');
      const acceptRecord = record => {
        if (!validRecord(record, true)) throw failure('PROTOCOL');
        const draft = draftOf(record);
        publish({ editor: { ...record, baseline: draft, key: ++key }, draft, conflict: false });
      };
      const canDiscard = () => !dirty() || window.confirm(t('discard'));

      async function loadList() {
        if (disposed || !state.workspaceId || !project()) return;
        const workspaceId = state.workspaceId;
        const request = beginRead('list');
        publish({ listLoading: true, listFailed: false });
        try {
          const value = await rpc('list', { workspaceId, query: state.query, limit: PAGE, offset: state.offset }, request.signal);
          if (!current('list', request) || state.workspaceId !== workspaceId) return;
          if (!value || !Array.isArray(value.items) || !value.items.every(item => validRecord(item))
            || !Number.isSafeInteger(value.total) || value.total < 0 || typeof value.hasMore !== 'boolean') throw failure('PROTOCOL');
          publish({ items: value.items, total: value.total, hasMore: value.hasMore });
        } catch (error) { if (current('list', request)) { publish({ listFailed: true }); report(error); } }
        finally { if (current('list', request)) { delete reads.list; publish({ listLoading: false }); } }
      }

      const controller = {
        getSnapshot: () => state,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        isDirty: dirty,
        async ensure() { if (!state.initialized && !projectsPromise) await controller.loadWorkspaces(); },
        async loadWorkspaces() {
          if (disposed || mutation) return;
          if (projectsPromise) return projectsPromise;
          const request = beginRead('projects');
          publish({ workspacesLoading: true });
          projectsPromise = (async () => {
            try {
              const value = await rpc('workspaces', {}, request.signal);
              if (!current('projects', request)) return;
              if (!value || !Array.isArray(value.workspaces) || !value.workspaces.every(item => item && typeof item.id === 'string'
                && item.id && typeof item.title === 'string' && typeof item.path === 'string')
                || new Set(value.workspaces.map(item => item.id)).size !== value.workspaces.length) throw failure('PROTOCOL');
              publish({ workspaces: value.workspaces, storagePath: typeof value.storagePath === 'string' ? value.storagePath : '', initialized: true });
              if (state.workspaceId && !project()) { cancelNoteReads(); publish({ items: [], total: 0, hasMore: false,
                listLoading: false, listFailed: true, recordLoading: false, error: 'NO_PROJECT' }); }
            } catch (error) { if (current('projects', request)) report(error); }
            finally { if (current('projects', request)) { delete reads.projects; publish({ workspacesLoading: false }); } projectsPromise = null; }
          })();
          return projectsPromise;
        },
        selectProject(id) {
          if (disposed || mutation || state.workspacesLoading || id === state.workspaceId) return;
          if (id && !state.workspaces.some(item => item.id === id)) return;
          if (!canDiscard()) { publish({}); return; }
          cancelNoteReads();
          publish({ workspaceId: id, items: [], total: 0, hasMore: false, offset: 0, query: '', queryDraft: '',
            editor: null, draft: null, conflict: false, error: null, message: null, recordLoading: false, listLoading: false, listFailed: false });
          void loadList();
        },
        setQuery(value) { if (!disposed) publish({ queryDraft: String(value).slice(0, 120) }); },
        search() {
          if (disposed || mutation || !project()) return;
          publish({ query: state.queryDraft.trim(), offset: 0, error: null, message: null });
          void loadList();
        },
        page(direction) {
          if (disposed || mutation || state.listLoading || !project()) return;
          const offset = state.offset + direction * PAGE;
          if (offset < 0 || offset > 10000 || (direction > 0 && !state.hasMore)) return;
          publish({ offset, error: null, message: null }); void loadList();
        },
        refresh() { if (!mutation && !disposed) { publish({ error: null, message: null }); void loadList(); } },
        newNote() {
          if (disposed || mutation || !project() || !canDiscard()) return;
          stopRead('get'); const draft = blank();
          publish({ editor: { id: null, key: ++key, baseline: draft }, draft, recordLoading: false, conflict: false, error: null, message: null });
        },
        async open(id) {
          if (disposed || mutation || !project() || !canDiscard()) return;
          const workspaceId = state.workspaceId;
          const request = beginRead('get');
          publish({ editor: null, draft: null, conflict: false, recordLoading: true, error: null, message: null });
          try {
            const value = await rpc('get', { workspaceId, id }, request.signal);
            if (!current('get', request) || workspaceId !== state.workspaceId) return;
            if (!validRecord(value?.record, true) || value.record.id !== id) throw failure('PROTOCOL');
            acceptRecord(value.record);
          } catch (error) { if (current('get', request)) report(error); }
          finally { if (current('get', request)) { delete reads.get; publish({ recordLoading: false }); } }
        },
        edit(field, value) {
          if (disposed || mutation || !state.editor || !['title', 'body', 'tagText'].includes(field)) return;
          publish({ draft: { ...state.draft, [field]: value }, message: null });
        },
        closeEditor() {
          if (disposed || mutation || !canDiscard()) return;
          stopRead('get'); publish({ editor: null, draft: null, conflict: false, recordLoading: false, error: null, message: null });
        },
        async save() {
          if (disposed || mutation || state.uncertain || !state.editor || state.conflict) return;
          if (!project()) { report(failure('NO_PROJECT')); return; }
          const title = state.draft.title.trim(); const body = state.draft.body;
          const tags = [...new Set(state.draft.tagText.split(/[,，]/u).map(tag => tag.trim()).filter(Boolean))];
          if (!title || title.length > 120) { publish({ error: 'invalidTitle', message: null }); return; }
          if (!body.trim() || body.length > 8000) { publish({ error: 'invalidBody', message: null }); return; }
          if (tags.length > 8 || tags.some(tag => tag.length > 24)) { publish({ error: 'invalidTags', message: null }); return; }
          const workspaceId = state.workspaceId; const editor = state.editor;
          activeWrite = { action: editor.id ? 'update' : 'save', workspace: project().path, title, id: editor.id };
          mutation = true; cancelNoteReads(); publish({ pending: 'save', recordLoading: false, listLoading: false, error: null, message: null });
          let success = false;
          try {
            const value = await rpc(editor.id ? 'update' : 'save', { workspaceId, title, body, tags,
              ...(editor.id ? { id: editor.id, expectedVersion: editor.version } : {}) });
            if (disposed) return;
            if (!validRecord(value?.record, true) || (editor.id && value.record.id !== editor.id)) throw failure('PROTOCOL');
            acceptRecord(value.record); publish({ message: 'saved' }); success = true;
          } catch (error) {
            if (!disposed) { if (error?.code === 'CONFLICT') publish({ conflict: true }); report(error, true); }
          } finally {
            mutation = false;
            if (!disposed) { publish({ pending: '' }); if (success) void loadList(); }
          }
        },
        async remove(record) {
          if (disposed || mutation || state.uncertain || !validRecord(record) || !project()) return;
          const workspaceId = state.workspaceId;
          const losesDraft = state.editor?.id === record.id && dirty();
          const text = t('deleteConfirm', { title: record.title || t('untitled'), workspace: project().title || project().path })
            + (losesDraft ? `\n\n${t('deleteDraft')}` : '');
          if (!window.confirm(text)) return;
          // The lock is synchronous and rechecked after the native confirmation.
          if (disposed || mutation || workspaceId !== state.workspaceId) return;
          activeWrite = { action: 'delete', workspace: project().path, title: record.title, id: record.id };
          mutation = true; cancelNoteReads(); publish({ pending: `delete:${record.id}`, listLoading: false, recordLoading: false, error: null, message: null });
          let success = false;
          try {
            const value = await rpc('delete', { workspaceId, id: record.id, expectedVersion: record.version });
            if (disposed) return;
            if (value?.deleted !== true || value.id !== record.id) throw failure('PROTOCOL');
            if (state.editor?.id === record.id) publish({ editor: null, draft: null, conflict: false });
            publish({ items: state.items.filter(item => item.id !== record.id), message: 'deleted' }); success = true;
          } catch (error) {
            if (!disposed) { if (error?.code === 'CONFLICT' && state.editor?.id === record.id) publish({ conflict: true }); report(error, true); }
          } finally {
            mutation = false;
            if (!disposed) { publish({ pending: '' }); if (success) { if (state.offset && state.items.length === 0) publish({ offset: state.offset - PAGE }); void loadList(); } }
          }
        },
        acknowledgeUncertain() {
          if (!disposed && !mutation && state.uncertain && window.confirm(t('ackConfirm'))) publish({ uncertain: null, error: null });
        },
        dispose() { disposed = true; for (const kind of Object.keys(reads)) stopRead(kind); listeners.clear(); },
      };
      return controller;
    }

    const css = `
.lm-root{color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55;max-width:1000px;min-width:0;padding:22px 24px;box-sizing:border-box}
.lm-root *{box-sizing:border-box}.lm-title{font-size:20px;font-weight:600;margin:0 0 4px}.lm-desc{color:var(--dsw-alias-label-secondary);margin:0 0 16px}
.lm-notice{padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;color:var(--dsw-alias-label-secondary);font-size:12px;margin-bottom:18px}
.lm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.lm-project{flex:1;min-width:180px}.lm-label{display:block;font-size:12px;font-weight:600;margin-bottom:5px}.lm-field{margin-bottom:13px}
.lm-root input,.lm-root select,.lm-root textarea{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;max-width:100%;width:100%}
.lm-root textarea{resize:vertical;min-height:210px;line-height:1.6}.lm-root button{font:inherit;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:8px;padding:7px 11px;cursor:pointer;white-space:normal}
.lm-root button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}.lm-root button:disabled,.lm-root input:disabled,.lm-root select:disabled,.lm-root textarea:disabled{opacity:.5;cursor:not-allowed}
.lm-root :is(button,input,select,textarea):focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.lm-root button.lm-primary{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:600}
.lm-root button.lm-danger{color:var(--dsw-alias-state-error-primary)}.lm-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}.lm-path{margin:7px 0 14px;overflow-wrap:anywhere}
.lm-search{margin:16px 0 10px}.lm-search input{flex:1;min-width:130px}.lm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:18px;margin-top:12px}
.lm-card{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px;background:var(--dsw-alias-bg-base)}.lm-card h3{font-size:14px;font-weight:600;margin:0 0 12px}
.lm-list{list-style:none;padding:0;margin:0}.lm-item{display:flex;align-items:flex-start;gap:5px;padding:8px 0;border-top:1px solid var(--dsw-alias-border-l1)}.lm-item:first-child{border-top:0;padding-top:0}
.lm-root button.lm-open{text-align:left;flex:1;min-width:0;display:block;border-color:transparent;background:transparent;padding:7px 8px}.lm-root button.lm-open[aria-current=true]{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l2)}
.lm-note-title{display:block;font-size:13px;font-weight:600;overflow-wrap:anywhere}.lm-preview{display:block;font-size:12px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;margin-top:4px}
.lm-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.lm-tag{padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font-size:10px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.lm-empty{color:var(--dsw-alias-label-secondary);padding:15px 0}.lm-error{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:10px 12px;margin:12px 0;overflow-wrap:anywhere}.lm-success{color:var(--dsw-alias-state-success-primary);margin:10px 0}
.lm-pages{justify-content:space-between;border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;margin-top:12px}.lm-dirty{color:var(--dsw-alias-state-warn-primary);font-size:11px}.lm-metadata{margin:16px 0 0;border-top:1px solid var(--dsw-alias-border-l1);padding-top:10px}.lm-metadata div{margin-top:4px}.lm-actions{justify-content:space-between;margin-top:15px}
@media(max-width:640px){.lm-root{padding:16px 12px}.lm-grid{grid-template-columns:1fr}.lm-row{align-items:stretch}.lm-project{min-width:100%;width:100%}}
`;

    function createSection(ctx, controller) {
      const localeSubscribe = listener => ctx.locale.subscribe(listener);
      const localeSnapshot = () => ctx.locale.getSnapshot().revision;
      return function LocalMemorySection() {
        const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
        useSyncExternalStore(localeSubscribe, localeSnapshot, localeSnapshot);
        const t = ctx.locale.bind(NS);
        const titleRef = useRef(null);
        const newRef = useRef(null);
        const previousEditor = useRef(null);
        useEffect(() => { void controller.ensure(); }, []);
        useEffect(() => {
          if (state.editor) titleRef.current?.focus();
          else if (previousEditor.current !== null) newRef.current?.focus();
          previousEditor.current = state.editor?.key ?? null;
        }, [state.editor?.key]);
        const busy = !!state.pending;
        const project = state.workspaces.find(item => item.id === state.workspaceId);
        const locked = busy || !project;
        const dirty = controller.isDirty();
        const date = value => {
          const parsed = new Date(value);
          return ((typeof value === 'string' && value.trim() !== '') || (typeof value === 'number' && Number.isFinite(value))) && Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : '—';
        };
        const meta = state.editor?.id ? h('div', { className: 'lm-meta lm-metadata' },
          h('div', null, `${t('created')}: ${date(state.editor.createdAt)}`),
          h('div', null, `${t('updated')}: ${date(state.editor.updatedAt)}`),
          state.editor.sourceSessionId ? h('div', null, `${t('source')}: ${state.editor.sourceSessionId}`) : null) : null;
        const input = (field, label, maxLength, options = {}) => h('div', { className: 'lm-field' },
          h('label', { className: 'lm-label', htmlFor: `lm-${field}` }, label),
          h(field === 'body' ? 'textarea' : 'input', { id: `lm-${field}`, value: state.draft?.[field] || '', maxLength,
            disabled: busy, ref: field === 'title' ? titleRef : undefined, spellCheck: field !== 'tagText',
            onChange: event => controller.edit(field, event.target.value), ...options }));
        return h('section', { className: 'lm-root', 'aria-label': t('title') },
          h('style', null, css),
          h('h2', { className: 'lm-title' }, t('title')),
          h('p', { className: 'lm-desc' }, t('description')),
          h('div', { className: 'lm-notice' }, t('privacy')),
          h('div', { className: 'lm-row' },
            h('div', { className: 'lm-project' },
              h('label', { className: 'lm-label', htmlFor: 'lm-workspace' }, t('workspace')),
              h('select', { id: 'lm-workspace', value: state.workspaceId, disabled: busy || state.workspacesLoading,
                onChange: event => controller.selectProject(event.target.value) },
              h('option', { value: '' }, t('choose')),
              state.workspaceId && !project ? h('option', { value: state.workspaceId, disabled: true }, t('missingProject')) : null,
              ...state.workspaces.map(item => h('option', { key: item.id, value: item.id }, item.title ? `${item.title} — ${item.path}` : item.path)))),
            h('button', { type: 'button', disabled: busy || state.workspacesLoading, onClick: () => { void controller.loadWorkspaces(); } }, t(state.workspacesLoading ? 'loading' : 'refreshProjects'))),
          project ? h('div', { className: 'lm-meta lm-path' }, `${t('projectPath')}: ${project.path}`) : null,
          state.initialized && state.workspaces.length === 0 ? h('p', { className: 'lm-empty' }, t('noWorkspaces')) : null,
          state.error ? h('div', { className: 'lm-error', role: 'alert' }, t(state.error)) : null,
          state.message ? h('div', { className: 'lm-success', role: 'status' }, t(state.message)) : null,
          state.uncertain ? h('div', { className: 'lm-notice', role: 'status' },
            h('div', null, t('uncertainOrigin', { ...state.uncertain, operation: state.uncertain.action, title: `${state.uncertain.title}${state.uncertain.id ? ` (${state.uncertain.id})` : ''}` })),
            h('button', { type: 'button', disabled: busy, onClick: () => controller.acknowledgeUncertain() }, t('reviewed'))) : null,
          !state.workspaceId ? h('p', { className: 'lm-empty' }, t('noProject')) : h(React.Fragment, null,
            h('form', { className: 'lm-row lm-search', onSubmit: event => { event.preventDefault(); controller.search(); } },
              h('input', { type: 'search', value: state.queryDraft, maxLength: 120, placeholder: t('searchPlaceholder'), 'aria-label': t('searchPlaceholder'), disabled: locked,
                onChange: event => controller.setQuery(event.target.value) }),
              h('button', { type: 'submit', disabled: locked }, t('search')),
              h('button', { type: 'button', disabled: locked || state.listLoading, onClick: () => controller.refresh() }, t('refresh')),
              h('button', { ref: newRef, type: 'button', className: 'lm-primary', disabled: locked, onClick: () => controller.newNote() }, t('newNote'))),
            h('div', { className: 'lm-grid' },
              h('div', { className: 'lm-card', 'aria-busy': state.listLoading },
                h('h3', null, t(state.query ? 'results' : 'count', { count: state.total })),
                state.listLoading ? h('div', { className: 'lm-meta', role: 'status' }, t('loading')) : null,
                !state.listLoading && !state.listFailed && state.items.length === 0 ? h('div', { className: 'lm-empty' }, t(state.query ? 'noMatches' : 'empty')) : null,
                h('ul', { className: 'lm-list' }, ...state.items.map(item => h('li', { key: item.id, className: 'lm-item' },
                  h('button', { type: 'button', className: 'lm-open', disabled: locked, 'aria-current': state.editor?.id === item.id ? 'true' : undefined,
                    onClick: () => { void controller.open(item.id); } },
                  h('span', { className: 'lm-note-title' }, item.title || t('untitled')),
                  h('span', { className: 'lm-preview' }, typeof item.preview === 'string' ? item.preview.slice(0, 180) : ''),
                  item.tags.length ? h('span', { className: 'lm-tags' }, ...item.tags.map((tag, index) => h('span', { key: index, className: 'lm-tag' }, tag))) : null,
                  h('span', { className: 'lm-meta' }, date(item.updatedAt))),
                  h('button', { type: 'button', className: 'lm-danger', disabled: locked || !!state.uncertain, 'aria-label': `${t('delete')}: ${item.title}`,
                    onClick: () => { void controller.remove(item); } }, t(state.pending === `delete:${item.id}` ? 'deleting' : 'delete'))))),
                h('div', { className: 'lm-row lm-pages' },
                  h('button', { type: 'button', disabled: locked || state.listLoading || state.offset === 0, onClick: () => controller.page(-1) }, t('previous')),
                  h('span', { className: 'lm-meta' }, t('page', { page: Math.floor(state.offset / PAGE) + 1 })),
                  h('button', { type: 'button', disabled: locked || state.listLoading || !state.hasMore, onClick: () => controller.page(1) }, t('next')))),
              h('div', { className: 'lm-card', 'aria-busy': state.recordLoading },
                state.recordLoading ? h('div', { className: 'lm-meta', role: 'status' }, t('loading')) : state.editor ? h('form', { onSubmit: event => { event.preventDefault(); void controller.save(); } },
                  h('div', { className: 'lm-row', style: { justifyContent: 'space-between', marginBottom: 12 } },
                    h('h3', { style: { margin: 0 } }, t(state.editor.id ? 'edit' : 'newNote')),
                    dirty ? h('span', { className: 'lm-dirty' }, t('unsaved')) : null),
                  input('title', t('noteTitle'), 120, { placeholder: t('titleHint'), required: true }),
                  input('body', t('body'), 8000, { required: true, 'aria-describedby': 'lm-body-hint' }),
                  h('div', { id: 'lm-body-hint', className: 'lm-meta', style: { marginTop: -8, marginBottom: 13 } }, t('bodyHint', { count: state.draft.body.length })),
                  input('tagText', t('tags'), 224, { 'aria-describedby': 'lm-tags-hint' }),
                  h('div', { id: 'lm-tags-hint', className: 'lm-meta', style: { marginTop: -8 } }, t('tagsHint')),
                  meta,
                  state.conflict && state.editor.id ? h('button', { type: 'button', style: { marginTop: 12 }, disabled: busy || !project,
                    onClick: () => { void controller.open(state.editor.id); } }, t('reloadLatest')) : null,
                  h('div', { className: 'lm-row lm-actions' },
                    h('button', { type: 'button', disabled: busy, onClick: () => controller.closeEditor() }, t('closeEditor')),
                    h('div', { className: 'lm-row' },
                      state.editor.id ? h('button', { type: 'button', className: 'lm-danger', disabled: locked || !!state.uncertain || state.conflict,
                        onClick: () => { void controller.remove(state.editor); } }, t(state.pending === `delete:${state.editor.id}` ? 'deleting' : 'delete')) : null,
                      h('button', { type: 'submit', className: 'lm-primary', disabled: locked || !!state.uncertain || state.conflict || !dirty }, t(state.pending === 'save' ? 'saving' : 'save')))))
                  : h('div', { className: 'lm-empty' }, t('selectNote'))))),
          state.storagePath ? h('div', { className: 'lm-meta lm-path', style: { marginTop: 18 } }, `${t('storage')}: ${state.storagePath}`) : null);
      };
    }

    return {
      inject: ['slots', 'locale', 'connection'],
      apply(ctx) {
        const controller = createController(ctx);
        const Section = createSection(ctx, controller);
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'local-memory: dictionaries');
        ctx.effect(() => () => controller.dispose(), 'local-memory: controller');
        ctx.effect(() => {
          const warn = event => {
            if (!controller.isDirty() && !controller.getSnapshot().pending) return;
            event.preventDefault(); event.returnValue = '';
          };
          window.addEventListener('beforeunload', warn);
          return () => window.removeEventListener('beforeunload', warn);
        }, 'local-memory: draft warning');
        ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'local-memory', order: 14,
          label: () => ctx.locale.bind(NS)('nav') }, Section));
      },
    };
  },
});
