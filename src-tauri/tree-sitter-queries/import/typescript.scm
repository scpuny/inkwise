; === TypeScript/JavaScript — import 层 ===
; 提取 import/require/dynamic import 依赖

; import 语句
(
  (import_statement
    source: (string) @source)
  (#match? @source "^(?!\\.)")
)

; 具名导出
(
  (import_statement
    (import_clause
      (named_imports
        (import_specifier
          (identifier) @import)))
    source: (string) @source)
  (#match? @source "^(?!\\.)")
)

; namespace import: import * as X from 'y'
(
  (import_statement
    (import_clause
      (namespace_import
        (identifier) @import))
    source: (string) @source)
  (#match? @source "^(?!\\.)")
)

; require() 调用
(
  (call_expression
    function: (identifier) @func
    arguments: (arguments
      (string) @source))
  (#eq? @func "require")
  (#match? @source "^(?!\\.)")
)

; dynamic import()
(
  (import_expression
    source: (string) @source)
  (#match? @source "^(?!\\.)")
)
