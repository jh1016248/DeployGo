import { useEffect, useRef, useState } from "react";
import { useDeploymentEvents } from "./hooks/use-deployment-events";
import { configClient, deploymentClient } from "./lib/tauri";
import type { ProjectConfig, ServerConfig } from "./lib/types";

type Page = "projects" | "servers";

function App() {
  const [page, setPage] = useState<Page>("projects");
  const [notice, setNotice] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [serverFormOpen, setServerFormOpen] = useState(false);
  const [configs, setConfigs] = useState<{ servers: ServerConfig[]; projects: ProjectConfig[] }>({ servers: [], projects: [] });
  const [activeDeployments, setActiveDeployments] = useState<Record<string, string>>({});
  const [editingServer, setEditingServer] = useState<ServerConfig | undefined>();
  const [serverTests, setServerTests] = useState<Record<string, string>>({});
  const [editingProject, setEditingProject] = useState<ProjectConfig | undefined>();
  const [hiddenLogs, setHiddenLogs] = useState<string[]>([]);
  const projects = page === "projects";
  const deployment = useDeploymentEvents();
  const activeDeployment = Object.entries(deployment.progress).at(-1);
  const loadConfigs = async () => { if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) setConfigs(await configClient.get()); };
  useEffect(() => { void loadConfigs().catch(() => undefined); }, []);
  const saveServer = async (server: unknown) => { try { await configClient.saveServer(server); await loadConfigs(); setEditingServer(undefined); setServerFormOpen(false); setNotice(true); } catch { setNotice(true); } };
  const testServer = async (server: ServerConfig) => { setServerTests((current) => ({ ...current, [server.id]: "正在测试…" })); try { await configClient.testConnection(server); setServerTests((current) => ({ ...current, [server.id]: "连接成功" })); } catch (error) { setServerTests((current) => ({ ...current, [server.id]: error instanceof Error ? error.message : "连接失败" })); } };
  const deployProject = async (projectId: string) => { try { const deploymentId = await deploymentClient.start(projectId); setHiddenLogs((current) => current.filter((id) => id !== deploymentId)); setActiveDeployments((current) => ({ ...current, [projectId]: deploymentId })); setNotice(true); } catch { setNotice(true); } };
  const cancelProject = async (projectId: string) => { const deploymentId = activeDeployments[projectId]; if (!deploymentId) return; await deploymentClient.cancel(deploymentId); };
  useEffect(() => { const completeIds = new Set(Object.keys(deployment.completed)); setActiveDeployments((current) => Object.fromEntries(Object.entries(current).filter(([, id]) => !completeIds.has(id)))); }, [deployment.completed]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">↗</span><span>deploy<span>go</span></span></div>
        <nav aria-label="主导航" className="nav">
          <button className={projects ? "nav-item active" : "nav-item"} onClick={() => setPage("projects")}><b>◇</b> 项目</button>
          <button aria-label="服务器" className={!projects ? "nav-item active" : "nav-item"} onClick={() => setPage("servers")}><b>⌁</b> 服务器</button>
        </nav>
        <div className="sidebar-footer"><span className="online-dot"/> 本地服务就绪</div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">DEPLOYMENT CONSOLE</p><h1>{projects ? "项目" : "服务器"}</h1></div>
          <button aria-label={projects ? "添加项目" : "添加服务器"} className="primary" onClick={() => { if (projects) setFormOpen(true); else { setEditingServer(undefined); setServerFormOpen(true); } }}>{projects ? "+ 添加项目" : "+ 添加服务器"}</button>
        </header>
        {projects ? <Projects projects={configs.projects} servers={configs.servers} activeDeployments={activeDeployments} progress={deployment.progress} onAdd={() => { setEditingProject(undefined); setFormOpen(true); }} onEdit={(project) => { setEditingProject(project); setFormOpen(true); }} onDeploy={deployProject} onCancel={cancelProject} /> : <Servers servers={configs.servers} testStates={serverTests} onAdd={() => { setEditingServer(undefined); setServerFormOpen(true); }} onEdit={(server) => { setEditingServer(server); setServerFormOpen(true); }} onTest={testServer} />}
      </main>
      {formOpen && <ProjectDialog initial={editingProject} onClose={() => { setEditingProject(undefined); setFormOpen(false); }} onSaved={() => void loadConfigs()} />}
      {serverFormOpen && <ServerDialog initial={editingServer} onClose={() => { setEditingServer(undefined); setServerFormOpen(false); }} onSave={saveServer} />}
      {activeDeployment && !hiddenLogs.includes(activeDeployment[0]) && <DeploymentPanel deploymentId={activeDeployment[0]} progress={activeDeployment[1]} logs={deployment.logs[activeDeployment[0]] ?? []} onClose={() => setHiddenLogs((current) => [...current, activeDeployment[0]])} />}
      {notice && <div className="toast" role="status"><span>✦</span> 配置表单将在下一步连接本地配置服务 <button aria-label="关闭提示" onClick={() => setNotice(false)}>×</button></div>}
    </div>
  );
}

function Projects({ projects, servers, activeDeployments, progress, onAdd, onEdit, onDeploy, onCancel }: { projects: ProjectConfig[]; servers: ServerConfig[]; activeDeployments: Record<string, string>; progress: Record<string, { phase: string; percent?: number }>; onAdd: () => void; onEdit: (project: ProjectConfig) => void; onDeploy: (id: string) => void; onCancel: (id: string) => void }) {
  if (projects.length) return <section className="project-grid" aria-label="项目列表">{projects.map((project) => { const server = servers.find((item) => item.id === project.serverId); const deploymentId = activeDeployments[project.id]; const current = deploymentId ? progress[deploymentId] : undefined; return <article className="project-card" key={project.id}><header><div><p className="eyebrow">{current ? "DEPLOYMENT RUNNING" : "READY TO DEPLOY"}</p><h2>{project.name}</h2></div><span className="status-badge">{current ? current.phase : "待部署"}</span></header><dl><div><dt>BUILD</dt><dd>{project.buildCommand}</dd></div><div><dt>TARGET</dt><dd>{server?.name ?? "未配置服务器"} · {project.remotePath}</dd></div><div><dt>LAST DEPLOY</dt><dd>{project.lastDeployment?.finishedAt ?? "尚未部署"}</dd></div></dl>{current ? <><div className="card-progress"><i style={{ width: (current.percent ?? 0) + "%" }} /></div><button className="ghost cancel-button" onClick={() => void onCancel(project.id)}>取消部署</button></> : <div className="project-actions"><button className="ghost project-edit" onClick={() => onEdit(project)}>编辑项目</button><button className="primary deploy-button" onClick={() => void onDeploy(project.id)}>部署 <span>→</span></button></div>}</article>; })}</section>;
  return <section className="empty-state" aria-label="项目空状态"><div className="terminal-card"><div className="terminal-chrome"><i/><i/><i/><span>deploygo / projects</span></div><div className="terminal-body"><span className="prompt">›</span><span className="typing">等待部署目标...</span><span className="cursor">_</span></div></div><p className="empty-kicker">YOUR DEPLOYMENT QUEUE IS EMPTY</p><h2>暂无项目</h2><p className="empty-copy">添加本地前端项目，保存构建命令与 SSH 目标，<br/>下一次发布只需一次点击。</p><button className="primary wide" onClick={onAdd}>添加项目 <span>→</span></button><div className="flow-hint"><span>01 配置项目</span><i/> <span>02 连接服务器</span><i/> <span>03 一键部署</span></div></section>;
}

function DeploymentPanel({ deploymentId, progress, logs, onClose }: { deploymentId: string; progress: { phase: string; percent?: number; file?: string }; logs: { level: string; message: string }[]; onClose: () => void }) {
  return <aside className="log-panel" aria-label="部署日志"><header><div><p className="eyebrow">LIVE DEPLOYMENT · {deploymentId}</p><b>{progress.phase}</b></div><div className="log-actions"><strong>{progress.percent ?? 0}%</strong><button className="close" type="button" aria-label="关闭日志" onClick={onClose}>×</button></div></header><div className="progress-track"><i style={{ width: `${progress.percent ?? 0}%` }} /></div>{progress.file && <p className="current-file">{progress.file}</p>}<div className="log-lines">{logs.map((log, index) => <p key={index} data-level={log.level}><span>{log.level}</span>{log.message}</p>)}</div></aside>;
}

function ProjectDialog({ initial, onClose, onSaved }: { initial?: ProjectConfig; onClose: () => void; onSaved: () => void }) {
  const [rootPath, setRootPath] = useState(initial?.rootPath ?? ""); const [buildCommand, setBuildCommand] = useState(initial?.buildCommand ?? "pnpm build"); const [outputDirectory, setOutputDirectory] = useState(initial?.outputDirectory ?? "dist"); const [serverId, setServerId] = useState(initial?.serverId ?? ""); const [servers, setServers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) void configClient.get().then((config) => setServers(config.servers)).catch(() => undefined); }, []);
  const browse = async () => { const path = await configClient.pickProjectDirectory(); if (!path) return; setRootPath(path); const inspected = await configClient.inspectProject(path); const preferredScript = Object.keys(inspected.scripts).find((name) => name === "build") ?? Object.keys(inspected.scripts).find((name) => name.startsWith("build")); if (preferredScript) setBuildCommand(`pnpm ${preferredScript}`); if (inspected.outputCandidates[0]) setOutputDirectory(inspected.outputCandidates[0]); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const fields = new FormData(event.currentTarget); await configClient.saveProject({ id: initial?.id ?? crypto.randomUUID(), name: fields.get("name"), rootPath, buildCommand, outputDirectory, serverId, remotePath: fields.get("remotePath"), cleanRemoteBeforeDeploy: fields.get("clean") === "on", lastDeployment: initial?.lastDeployment }); onSaved(); onClose(); };
  return <div className="dialog-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
    <header><div><p className="eyebrow">{initial ? "EDIT DEPLOYMENT TARGET" : "NEW DEPLOYMENT TARGET"}</p><h2 id="project-form-title">{initial ? "编辑项目" : "添加项目"}</h2></div><button className="close" aria-label="关闭表单" onClick={onClose}>×</button></header>
    <form onSubmit={(event) => void submit(event)}><div className="form-grid"><label>项目名称<input name="name" required defaultValue={initial?.name} placeholder="例如：官网前端" /></label><label>本地项目文件夹<div className="path-input"><input value={rootPath} readOnly placeholder="选择项目根目录" /><button type="button" onClick={() => void browse()}>浏览</button></div></label><label>打包命令<input aria-label="打包命令" value={buildCommand} onChange={(event) => setBuildCommand(event.target.value)} /></label><label>输出目录<input value={outputDirectory} onChange={(event) => setOutputDirectory(event.target.value)} /></label><label>服务器<select name="serverId" required value={serverId} onChange={(event) => setServerId(event.target.value)}><option value="" disabled>请选择已保存的服务器</option>{servers.map((server) => <option value={server.id} key={server.id}>{server.name}</option>)}</select></label><label>服务器目录<input name="remotePath" required defaultValue={initial?.remotePath} placeholder="/var/www/site" /></label></div>
    <label className="danger-row"><input name="clean" type="checkbox" defaultChecked={initial?.cleanRemoteBeforeDeploy} /> <span><b>部署前清空远程目录</b><small>此操作不可恢复，默认使用增量覆盖。</small></span></label>
    <footer><button className="ghost" type="button" onClick={onClose}>取消</button><button className="primary" type="submit">{initial ? "保存修改" : "保存项目"}</button></footer></form>
  </section></div>;
}

function ServerDialog({ initial, onClose, onSave }: { initial?: ServerConfig; onClose: () => void; onSave: (server: unknown) => void }) {
  const [auth, setAuth] = useState<"password" | "privateKey">(initial?.authType ?? "password"); const [privateKeyPath, setPrivateKeyPath] = useState(initial?.privateKeyPath ?? ""); const [testResult, setTestResult] = useState(""); const formRef = useRef<HTMLFormElement>(null);
  const buildServer = (fields: FormData) => { const now = new Date().toISOString(); return { id: initial?.id ?? crypto.randomUUID(), name: fields.get("name"), host: fields.get("host"), port: Number(fields.get("port")), username: fields.get("username"), authType: auth, password: auth === "password" ? fields.get("password") : undefined, privateKeyPath: auth === "privateKey" ? privateKeyPath : undefined, createdAt: initial?.createdAt ?? now, updatedAt: now }; };
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave(buildServer(new FormData(event.currentTarget))); };
  const testConnection = async () => { if (!formRef.current?.reportValidity()) return; setTestResult("正在测试连接…"); try { await configClient.testConnection(buildServer(new FormData(formRef.current))); setTestResult("连接成功"); } catch (error) { setTestResult(error instanceof Error ? error.message : "连接失败，请检查配置"); } };
  const browseKey = async () => { const path = await configClient.pickPrivateKey(); if (path) setPrivateKeyPath(path); };
  return <div className="dialog-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="server-form-title">
    <header><div><p className="eyebrow">SSH CONNECTION</p><h2 id="server-form-title">{initial ? "编辑服务器" : "添加服务器"}</h2></div><button className="close" aria-label="关闭表单" onClick={onClose}>×</button></header>
    <form ref={formRef} onSubmit={submit}><div className="form-grid"><label>服务器名称<input name="name" required defaultValue={initial?.name} placeholder="例如：生产环境" /></label><label>主机地址<input name="host" required defaultValue={initial?.host} aria-label="主机地址" placeholder="203.0.113.10" /></label><label>端口<input name="port" type="number" min="1" max="65535" defaultValue={initial?.port ?? 22} /></label><label>用户名<input name="username" required defaultValue={initial?.username} placeholder="deploy" /></label></div>
    <fieldset className="auth-switch"><legend>认证方式</legend><label><input type="radio" checked={auth === "password"} onChange={() => setAuth("password")} /> 密码认证</label><label><input type="radio" checked={auth === "privateKey"} onChange={() => setAuth("privateKey")} /> 私钥认证</label></fieldset>
    {auth === "password" ? <label className="single-field">密码<input name="password" required type="password" defaultValue={initial?.password} placeholder="按你的设置将明文保存于应用配置中" /></label> : <label className="single-field">私钥路径<div className="path-input"><input value={privateKeyPath} readOnly required placeholder="选择私钥文件" /><button type="button" onClick={() => void browseKey()}>浏览</button></div></label>}
    <p className="security-note">⚠ 密码和私钥口令会按当前 MVP 设置以明文保存在应用私有配置文件中，请只在可信设备使用。</p>{testResult && <p className="test-result" role="status">{testResult}</p>}
    <footer><button className="ghost" type="button" onClick={onClose}>取消</button><button className="ghost" type="button" onClick={() => void testConnection()}>测试连接</button><button className="primary" type="submit">{initial ? "保存修改" : "保存服务器"}</button></footer></form>
  </section></div>;
}

function Servers({ servers, testStates, onAdd, onEdit, onTest }: { servers: ServerConfig[]; testStates: Record<string, string>; onAdd: () => void; onEdit: (server: ServerConfig) => void; onTest: (server: ServerConfig) => void }) {
  if (servers.length) return <section className="server-grid" aria-label="服务器列表">{servers.map((server) => <article className="server-card" key={server.id}><header><div className="server-glyph">⌁</div><span className="status-badge">已保存</span></header><h2>{server.name}</h2><p className="connection-string">{server.username}@{server.host}:{server.port}</p><dl><div><dt>AUTH</dt><dd>{server.authType === "password" ? "密码认证" : "SSH 私钥"}</dd></div><div><dt>LAST TEST</dt><dd role="status">{testStates[server.id] ?? "尚未测试"}</dd></div></dl><div className="server-actions"><button className="ghost server-test" onClick={() => void onTest(server)}>测试连接</button><button className="ghost server-edit" onClick={() => onEdit(server)}>编辑配置</button></div></article>)}</section>;
  return <section className="empty-state" aria-label="服务器空状态"><div className="server-glyph">⌁</div><p className="empty-kicker">REMOTE DESTINATIONS</p><h2>还没有服务器</h2><p className="empty-copy">先保存一个 SSH 服务器配置。部署前可测试连接，<br/>确保凭据与目标目录都可用。</p><button className="primary wide" onClick={onAdd}>添加服务器 <span>→</span></button></section>;
}

export default App;
