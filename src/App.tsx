import { useEffect, useState } from "react";
import { useDeploymentEvents } from "./hooks/use-deployment-events";
import { configClient } from "./lib/tauri";

type Page = "projects" | "servers";

function App() {
  const [page, setPage] = useState<Page>("projects");
  const [notice, setNotice] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [serverFormOpen, setServerFormOpen] = useState(false);
  const projects = page === "projects";
  const deployment = useDeploymentEvents();
  const activeDeployment = Object.entries(deployment.progress).at(-1);
  const saveServer = async (server: unknown) => { try { await configClient.saveServer(server); setServerFormOpen(false); setNotice(true); } catch { setNotice(true); } };

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
          <button aria-label={projects ? "添加项目" : "添加服务器"} className="primary" onClick={() => projects ? setFormOpen(true) : setServerFormOpen(true)}>{projects ? "+ 添加项目" : "+ 添加服务器"}</button>
        </header>
        {projects ? <Projects onAdd={() => setFormOpen(true)} /> : <Servers onAdd={() => setServerFormOpen(true)} />}
      </main>
      {formOpen && <ProjectDialog onClose={() => setFormOpen(false)} />}
      {serverFormOpen && <ServerDialog onClose={() => setServerFormOpen(false)} onSave={saveServer} />}
      {activeDeployment && <DeploymentPanel deploymentId={activeDeployment[0]} progress={activeDeployment[1]} logs={deployment.logs[activeDeployment[0]] ?? []} />}
      {notice && <div className="toast" role="status"><span>✦</span> 配置表单将在下一步连接本地配置服务 <button aria-label="关闭提示" onClick={() => setNotice(false)}>×</button></div>}
    </div>
  );
}

function Projects({ onAdd }: { onAdd: () => void }) {
  return <section className="empty-state" aria-label="项目空状态">
    <div className="terminal-card">
      <div className="terminal-chrome"><i/><i/><i/><span>deploygo / projects</span></div>
      <div className="terminal-body"><span className="prompt">›</span><span className="typing">等待部署目标...</span><span className="cursor">_</span></div>
    </div>
    <p className="empty-kicker">YOUR DEPLOYMENT QUEUE IS EMPTY</p>
    <h2>暂无项目</h2>
    <p className="empty-copy">添加本地前端项目，保存构建命令与 SSH 目标，<br/>下一次发布只需一次点击。</p>
    <button className="primary wide" onClick={onAdd}>添加项目 <span>→</span></button>
    <div className="flow-hint"><span>01 配置项目</span><i/> <span>02 连接服务器</span><i/> <span>03 一键部署</span></div>
  </section>;
}

function DeploymentPanel({ deploymentId, progress, logs }: { deploymentId: string; progress: { phase: string; percent?: number; file?: string }; logs: { level: string; message: string }[] }) {
  return <aside className="log-panel" aria-label="部署日志"><header><div><p className="eyebrow">LIVE DEPLOYMENT · {deploymentId}</p><b>{progress.phase}</b></div><strong>{progress.percent ?? 0}%</strong></header><div className="progress-track"><i style={{ width: `${progress.percent ?? 0}%` }} /></div>{progress.file && <p className="current-file">{progress.file}</p>}<div className="log-lines">{logs.map((log, index) => <p key={index} data-level={log.level}><span>{log.level}</span>{log.message}</p>)}</div></aside>;
}

function ProjectDialog({ onClose }: { onClose: () => void }) {
  const [rootPath, setRootPath] = useState(""); const [buildCommand, setBuildCommand] = useState("pnpm build"); const [outputDirectory, setOutputDirectory] = useState("dist"); const [servers, setServers] = useState<{ id: string; name: string; deploymentPath: string }[]>([]);
  useEffect(() => { if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) void configClient.get().then((config) => setServers(config.servers)).catch(() => undefined); }, []);
  const browse = async () => { const path = await configClient.pickProjectDirectory(); if (!path) return; setRootPath(path); const inspected = await configClient.inspectProject(path); const preferredScript = Object.keys(inspected.scripts).find((name) => name === "build") ?? Object.keys(inspected.scripts).find((name) => name.startsWith("build")); if (preferredScript) setBuildCommand(`pnpm ${preferredScript}`); if (inspected.outputCandidates[0]) setOutputDirectory(inspected.outputCandidates[0]); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const fields = new FormData(event.currentTarget); await configClient.saveProject({ id: crypto.randomUUID(), name: fields.get("name"), rootPath, buildCommand, outputDirectory, serverId: fields.get("serverId"), remotePath: fields.get("remotePath"), cleanRemoteBeforeDeploy: fields.get("clean") === "on" }); onClose(); };
  return <div className="dialog-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
    <header><div><p className="eyebrow">NEW DEPLOYMENT TARGET</p><h2 id="project-form-title">添加项目</h2></div><button className="close" aria-label="关闭表单" onClick={onClose}>×</button></header>
    <form onSubmit={(event) => void submit(event)}><div className="form-grid"><label>项目名称<input name="name" required placeholder="例如：官网前端" /></label><label>本地项目文件夹<div className="path-input"><input value={rootPath} readOnly placeholder="选择项目根目录" /><button type="button" onClick={() => void browse()}>浏览</button></div></label><label>打包命令<input aria-label="打包命令" value={buildCommand} onChange={(event) => setBuildCommand(event.target.value)} /></label><label>输出目录<input value={outputDirectory} onChange={(event) => setOutputDirectory(event.target.value)} /></label><label>服务器<select name="serverId" required defaultValue=""><option value="" disabled>请选择已保存的服务器</option>{servers.map((server) => <option value={server.id} key={server.id}>{server.name}</option>)}</select></label><label>服务器目录<input name="remotePath" required placeholder="/var/www/site" /></label></div>
    <label className="danger-row"><input name="clean" type="checkbox" /> <span><b>部署前清空远程目录</b><small>此操作不可恢复，默认使用增量覆盖。</small></span></label>
    <footer><button className="ghost" type="button" onClick={onClose}>取消</button><button className="primary" type="submit">保存项目</button></footer></form>
  </section></div>;
}

function ServerDialog({ onClose, onSave }: { onClose: () => void; onSave: (server: unknown) => void }) {
  const [auth, setAuth] = useState<"password" | "privateKey">("password");
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const fields = new FormData(event.currentTarget); const now = new Date().toISOString(); onSave({ id: crypto.randomUUID(), name: fields.get("name"), host: fields.get("host"), port: Number(fields.get("port")), username: fields.get("username"), authType: auth, password: auth === "password" ? fields.get("password") : undefined, privateKeyPath: auth === "privateKey" ? fields.get("privateKeyPath") : undefined, deploymentPath: fields.get("deploymentPath"), createdAt: now, updatedAt: now }); };
  return <div className="dialog-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="server-form-title">
    <header><div><p className="eyebrow">SSH CONNECTION</p><h2 id="server-form-title">添加服务器</h2></div><button className="close" aria-label="关闭表单" onClick={onClose}>×</button></header>
    <form onSubmit={submit}><div className="form-grid"><label>服务器名称<input name="name" required placeholder="例如：生产环境" /></label><label>主机地址<input name="host" required aria-label="主机地址" placeholder="203.0.113.10" /></label><label>端口<input name="port" type="number" min="1" max="65535" defaultValue="22" /></label><label>用户名<input name="username" required placeholder="deploy" /></label><label className="full-field">默认部署目录<input name="deploymentPath" required placeholder="/var/www/site" /></label></div>
    <fieldset className="auth-switch"><legend>认证方式</legend><label><input type="radio" checked={auth === "password"} onChange={() => setAuth("password")} /> 密码认证</label><label><input type="radio" checked={auth === "privateKey"} onChange={() => setAuth("privateKey")} /> 私钥认证</label></fieldset>
    {auth === "password" ? <label className="single-field">密码<input name="password" required type="password" placeholder="按你的设置将明文保存于应用配置中" /></label> : <label className="single-field">私钥路径<div className="path-input"><input name="privateKeyPath" required placeholder="选择私钥文件" /><button type="button">浏览</button></div></label>}
    <p className="security-note">⚠ 密码和私钥口令会按当前 MVP 设置以明文保存在应用私有配置文件中，请只在可信设备使用。</p>
    <footer><button className="ghost" type="button" onClick={onClose}>取消</button><button className="ghost" type="button">测试连接</button><button className="primary" type="submit">保存服务器</button></footer></form>
  </section></div>;
}

function Servers({ onAdd }: { onAdd: () => void }) {
  return <section className="empty-state" aria-label="服务器空状态">
    <div className="server-glyph">⌁</div><p className="empty-kicker">REMOTE DESTINATIONS</p><h2>还没有服务器</h2>
    <p className="empty-copy">先保存一个 SSH 服务器配置。部署前可测试连接，<br/>确保凭据与目标目录都可用。</p>
    <button className="primary wide" onClick={onAdd}>添加服务器 <span>→</span></button>
  </section>;
}

export default App;
