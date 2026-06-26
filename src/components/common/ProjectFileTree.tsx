import { useState, useCallback } from "react";
import { ChevronRight, FileText, FolderClosed, FolderOpen } from "lucide-react";
import type { FileNode } from "../../lib/storage/collections";

interface ProjectFileTreeProps {
  nodes: FileNode[];
  depth?: number;
  maxDepth?: number;
  onSelect: (path: string) => void;
}

function TreeNode({ node, depth, maxDepth, onSelect }: { node: FileNode; depth: number; maxDepth: number; onSelect: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  if (node.isDir) {
    if (depth >= maxDepth) return null;
    return (
      <div className="pft__dir">
        <button className="pft__row pft__row--dir" onClick={() => setExpanded(!expanded)}>
          <ChevronRight size={10} className={`pft__chevron${expanded ? " pft__chevron--open" : ""}`} />
          <span className="pft__icon">{expanded ? <FolderOpen size={12} /> : <FolderClosed size={12} />}</span>
          <span className="pft__label">{node.name}</span>
        </button>
        {expanded && node.children && node.children.length > 0 && (
          <div className="pft__children">
            {[...node.children].sort((a, b) => {
              if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
              return a.name.localeCompare(b.name);
            }).map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} maxDepth={maxDepth} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button className="pft__row pft__row--file" onClick={() => onSelect(node.path)} title={node.path}>
      <FileText size={11} className="pft__file-icon" />
      <span className="pft__label">{node.name}</span>
    </button>
  );
}

export function ProjectFileTree({ nodes, depth = 0, maxDepth = 2, onSelect }: ProjectFileTreeProps) {
  const sorted = [...nodes].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="pft">
      {sorted.map((node) => (
        <TreeNode key={node.path} node={node} depth={depth} maxDepth={maxDepth} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default ProjectFileTree;
