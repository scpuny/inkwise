# 08 — CodeGraph 角色定位：可选加速器

> 关联: 04-query-ast.md, 05-vector-embedding.md

---

## CodeGraph 当前提供的三样东西

从 `read_codegraph_data()` 和 `scan_project()` 可以看到，CodeGraph 提供了三个能力：

### 1. 符号定义（nodes 表）

```sql
SELECT name, kind, file_path, start_line, is_exported, 
       docstring, signature, qualified_name
FROM nodes WHERE kind != 'file'
```

精度到行号的函数/类/接口定义，含文档注释和签名。

**CodeGraph 独有**：`qualified_name`（如 `AuthService::login`）、`docstring`、`signature`

### 2. 调用关系图（edges 表）

```sql
SELECT source, target, kind FROM edges
WHERE kind IN ('import', 'calls', 'contains')
```

**函数级的 caller/callee**——这是 tree-sitter 自解析做不到的。

### 3. 文件哈希缓存

CodeGraph DB 内有 `files` 表，`FileHashCache` 优先使用它，省掉独立的 JSON 缓存文件。

---

## 既有降级逻辑

当前 `scan_project()` 已有三段式降级：

```
用户是否装了 CodeGraph？(.codegraph/codegraph.db 是否存在)
  ├── 是 + 强制重新扫描
  │     └── tree-sitter 全量自解析 + CodeGraph 补充
  ├── 是 + 不强制
  │     └── CodeGraph 符号为主，hash cache 增量
  └── 否
        ├── 强制 → tree-sitter 全量自解析（慢但有符号）
        └── 不强制 → 跳过符号提取（符号为空）
```

---

## 向量模型不能替代 CodeGraph

两者解决不同维度的问题：

```
     精确匹配                       语义模糊
    ──────────                   ──────────
    谁调用了 foo()?              找 JWT 认证相关代码
    AuthService 定义在哪？        写一篇项目重构文章
    login 函数签名是什么？        这段代码和什么类似？
    bar 的调用链有几层？          之前写过类似主题吗？
        ↑                              ↑
    CodeGraph                      向量模型
    (精确查询)                      (语义检索)
```

### 互补关系

```
场景：用户写"这次改了认证模块"

Layer 1 — 向量检索：
  语义匹配"认证" → 找到涉及 JWT、passport、OAuth 的所有相关代码
  
Layer 2 — CodeGraph（如有）：
  对向量找到的每个符号，解析调用链
  "AuthService.login 被 3 个路由调用，改了要测 X、Y、Z"
  
Layer 3 — 合成：（agent.rs + ContextPlanner）
  向量结果 + 调用链 → Context Plan → Agent 精准注入
```

### 没有 CodeGraph 时

```
Layer 1 — 向量检索：
  找到语义相关代码（仍然有效）
  
Layer 2 — tree-sitter 自解析：
  只有符号定义，没有调用链
  "AuthService.login 的定义在 auth/service.ts:42"
  但不知道谁调用了它

Layer 3 — 合成：
  向量结果 + 符号定义 → 范围较窄，但足够写文章
```

---

## CodeGraph 的价值总结

```
               有 CodeGraph         无 CodeGraph
符号精确度      高（qualified_name）   中（只有 name）
调用链          ✅ 函数级              ❌ 无
docstring      ✅                     ❌
签名            ✅ 完整                仅 tree-sitter 版本
增量扫描        使用 CodeGraph hash    使用 JSON hash cache
用户需要安装    需要                   不需要
```

**结论**：CodeGraph 是**可选加速器**。装了获得调用链分析 + 更精确的上下文；不装也不影响基本使用（tree-sitter + 向量模型足够）。当前设计正确，不需要去掉。

---

## 用户感知改进

当前 `codegraph_available` 在前端只展示了一个标签：

```tsx
{projectCtx.codegraphAvailable && (
  <span className="collection-form__lang-tag--n">CodeGraph</span>
)}
```

可以改为更清晰的说明：

```tsx
{projectCtx.codegraphAvailable ? (
  <span className="collection-form__lang-tag--n" title="已安装 CodeGraph，启用调用链分析">
    CodeGraph ✓
  </span>
) : (
  <span className="collection-form__lang-tag collection-form__lang-tag--muted" 
        title="未安装 CodeGraph（不影响基础项目分析）">
    CodeGraph ✗
  </span>
)}
```

以及在设置页面加一栏说明 CodeGraph 能带来什么额外能力。
