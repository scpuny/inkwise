; === Python — import 层 ===

; import module
(
  (import_statement
    name: (_) @module)
  (#match? @module "^[a-z]")
)

; from module import ...
(
  (import_from_statement
    module_name: (_) @module)
  (#match? @module "^[a-z]")
)
