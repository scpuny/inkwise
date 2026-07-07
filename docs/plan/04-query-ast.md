# 04 — tree-sitter Query 重构 AST

> 关联: 03-incremental-scanning.md, 05-vector-embedding.md

---

## 现状

```
extract_symbols_treesitter() → 约 200 行手写 AST 遍历：

  let mut visited = HashSet::new();
  let mut node_stack = vec![root];
  while let Some(node) = node_stack.pop() {
      match node.kind() {
          "function_declaration" => { 手动找 name/参数/注释 }
          "class_declaration" => {}
          // 每个 kind 都要手写
      }
      for i in 0..node.child_count() { node_stack.push(child) }
  }

问题:
  - 每种语言每种 node type 都要手写
  - 添加新语言 = 加更多 match arm
  - export 检测对 TypeScript 无效（永远 false）
  - 注释解析靠逆序逐行扫描，脆性强
```

## 改造：tree-sitter Query (.scm) 体系

参考 Kiro 的分层 Query 设计，InkWise 建立三层 Query：

```
tree-sitter-queries/
├── code-snippet/       // 第1层：提取结构和符号定义
│   ├── typescript.scm
│   ├── rust.scm
│   ├── python.scm
│   └── ...
├── import/             // 第2层：提取依赖关系
│   ├── typescript.scm
│   ├── rust.scm
│   └── ...
└── root-context/       // 第3层：提取类型上下文（预留给向量层）
    ├── function_declaration/typescript.scm
    ├── method_definition/typescript.scm
    └── ...
```

### Query 文件示例

```scheme
;; typescript.scm - code-snippet 层
(
  (comment)? @comment
  (function_declaration
    name: (_) @name
    parameters: (_) @parameters
  ) @definition
  (#strip! @comment "^//\\s*")
  (#set-adjacent! @comment @definition)
)

(
  (comment)? @comment
  (class_declaration
    name: (_) @name
  ) @definition
)

(
  (comment)? @comment
  (interface_declaration
    name: (_) @name
  ) @definition
)
```

```scheme
;; rust.scm - code-snippet 层
(function_item
    name: (_) @name
    parameters: (_) @parameters
    return_type: (_)? @return_type
) @definition

(struct_item
    name: (_) @name) @definition

(impl_item
  type: (_) @name) @definition
```

### Rust 端 Query 执行

```rust
fn query_symbols(
    source: &str,
    lang: &tree_sitter::Language,
    query_str: &str,
    file_path: &str,
) -> Vec<SymbolInfo> {
    let mut parser = tree_sitter::Parser::new();
    parser.set_language(lang)?;
    let tree = parser.parse(source, None)?;
    
    let query = tree_sitter::Query::new(lang, query_str)?;
    let mut cursor = tree_sitter::QueryCursor::new();
    let matches = cursor.matches(&query, tree.root_node(), source.as_bytes());
    
    let mut symbols = Vec::new();
    for match_ in matches {
        let mut name = None;
        let mut params = None;
        let mut comment = None;
        let mut return_type = None;
        
        for capture in match_.captures {
            let text = capture.node.utf8_text(source.as_bytes()).ok();
            match query.capture_names()[capture.index as usize].as_str() {
                "name" => name = text.map(String::from),
                "parameters" => params = text.map(String::from),
                "comment" => comment = text.map(|s| clean_comment(s)),
                "return_type" => return_type = text.map(String::from),
                _ => {}
            }
        }
        
        if let Some(name) = name {
            symbols.push(SymbolInfo {
                name,
                kind: "function".into(),
                file_path: file_path.into(),
                line: match_.pattern as u32,
                // ...
            });
        }
    }
    symbols
}
```

### 对比

| 维度 | 当前（手写遍历） | 改造后（Query） |
|------|-----------------|----------------|
| 代码行数 | ~200 行 match/loop | ~30 行 Query 调用 |
| 添加新语言 | 改 Rust 代码 + 编译 | 加一个 `.scm` 文件 |
| 解析精度 | 易漏 case | Query 精确匹配 |
| export 检测 | TS 永久 false | Query 里 `(#has-ancestor? @name export_statement)` |
| 注释提取 | 逆序逐行扫描 | `(comment)?` 自然绑定 |
| 性能 | 手动子节点遍历 | tree-sitter 原生匹配 |

### 关于 WASM 运行时的选择

当前 InkWise 用原生 Rust tree-sitter crate（编译期绑定语言）。这没问题，但扩展新语言需要加 Cargo 依赖。

长期可以切换到 web-tree-sitter (WASM) 模式，好处是：

| 方案 | 编译 | 语言数 | 浏览器模式 |
|------|------|--------|-----------|
| 原生 Rust crate | 每次加语言都要编译 | 当前 3 种 | 不支持 |
| web-tree-sitter WASM | 无需编译，.wasm 热加载 | 27 种（Kiro 提供了全部） | 支持 |

**建议**：短期保持原生 Rust crate + `.scm` 文件，长期切换到 WASM。

---

## 实现步骤

| 步骤 | 内容 |
|------|------|
| 1 | 在 `src-tauri/` 下创建 `tree-sitter-queries/` 目录 |
| 2 | 写入 `typescript.scm`、`rust.scm` 的 code-snippet Query |
| 3 | 实现 `query_symbols()` 通用执行函数 |
| 4 | 替换 `extract_symbols_treesitter()` 调用 |
| 5 | 替换 `extract_imports_treesitter()` |
| 6 | 添加 `python.scm`、`go.scm` 等更多语言 |
