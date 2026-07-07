; === Go — code-snippet 层 ===

(function_declaration
    name: (_) @name
    parameters: (_) @parameters
    result: (_)? @return_type
) @definition

(method_declaration
    name: (_) @name
    parameters: (_) @parameters
    result: (_)? @return_type
) @definition

(type_declaration
  (type_spec
    name: (_) @name
    type: (_) @type)) @definition

(struct_type
    name: (_) @name) @definition

(interface_type
    name: (_) @name) @definition
