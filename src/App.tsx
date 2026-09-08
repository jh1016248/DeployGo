import { useState } from "react";

type Page = "projects" | "servers";

function App() {
  const [page, setPage] = useState<Page>("projects");
  const [notice, setNotice] = useState(false);
  const projects = page === "projects";

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
          <button aria-label={projects ? "添加项目" : "添加服务器"} className="primary" onClick={() => setNotice(true)}>{projects ? "+ 添加项目" : "+ 添加服务器"}</button>
        </header>
        {projects ? <Projects onAdd={() => setNotice(true)} /> : <Servers onAdd={() => setNotice(true)} />}
      </main>
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

function Servers({ onAdd }: { onAdd: () => void }) {
  return <section className="empty-state" aria-label="服务器空状态">
    <div className="server-glyph">⌁</div><p className="empty-kicker">REMOTE DESTINATIONS</p><h2>还没有服务器</h2>
    <p className="empty-copy">先保存一个 SSH 服务器配置。部署前可测试连接，<br/>确保凭据与目标目录都可用。</p>
    <button className="primary wide" onClick={onAdd}>添加服务器 <span>→</span></button>
  </section>;
}

export default App;
