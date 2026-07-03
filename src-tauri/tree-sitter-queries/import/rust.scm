; === Rust — import 层 ===
; 提取 use 声明和 extern crate

; use crate::module;
(
  (use_declaration
    argument: (_) @path)
  (#match? @path "^(crate|self|super|[a-z])")
)

; extern crate foo;
(
  (extern_crate_declaration
    crate: (_) @crate_name)
)
