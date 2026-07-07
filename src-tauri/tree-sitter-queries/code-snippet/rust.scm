; === Rust — code-snippet 层 ===
; 提取函数、结构体、枚举、trait、impl、类型别名、常量等

(function_item
    name: (_) @name
    parameters: (_) @parameters
    return_type: (_)? @return_type
) @definition

(struct_item
    name: (_) @name) @definition

(enum_item
    name: (_) @name) @definition

(trait_item
    name: (_) @name) @definition

(impl_item
  type: (_) @name) @definition

(type_item
    name: (_) @name) @definition

(const_item
    name: (_) @name) @definition

(static_item
    name: (_) @name) @definition
