; === TypeScript/JavaScript — code-snippet 层 ===
; 提取函数、类、接口、方法、枚举、类型定义等结构

(
  (comment)? @comment
  (function_declaration
    name: (_) @name
    parameters: (_) @parameters
  ) @definition
)

(
  (comment)? @comment
  (method_definition
    name: (_) @name
    parameters: (_) @parameters
  ) @definition
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

(
  (comment)? @comment
  (type_alias
    name: (_) @name
  ) @definition
)

(
  (comment)? @comment
  (enum_declaration
    name: (_) @name
  ) @definition
)

(
  (comment)? @comment
  (arrow_function
    name: (_) @name
    parameters: (_) @parameters
  ) @definition
)
