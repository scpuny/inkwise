// EditorCanvas — 编辑器核心区域
// 包含：文章大纲头部 + EditorContent + InlineToolbar + AICommandBar + 保存指示器

import { EditorContent, type EditorMode } from "./EditorContent";
import { ArticleHeader } from "./ArticleHeader";
import { InlineToolbar } from "./InlineToolbar";
import { AICommandBar } from "../agent/AICommandBar";
import { EditorSaveIndicator, type SaveState } from "./EditorSaveIndicator";
import type { ArticleBlueprint } from "../../domain";
import type { BlueprintOutlineItem } from "../sidebar/OutlinePanel";
import { Toolbar } from "./Toolbar";

interface EditorCanvasProps {
  // Blueprint
  blueprint: ArticleBlueprint;
  activeSectionId: string | null;
  onSaveBlueprint: (bp: ArticleBlueprint) => void;
  onSelectSection: (id: string | null) => void;
  onOpenBlueprintEditor: () => void;
  onCompleteArticle: () => void;

  // Content
  content: string;
  mode: EditorMode;
  lineHeight: number;
  paragraphGap: string;
  editorFontSize: number;
  editorMaxWidth: number;
  editorFontFamily: string;
  codeThemeId: string;
  styleTemplate: any;
  showHeadingNumber: boolean;

  // Streaming
  aiResponse: string;
  sending: boolean;
  streamElapsed: number;
  streamError: string | null;
  onCancelStream: () => void;
  onChange: (content: string) => void;
  onClearResponse: () => void;
  onInsertResponse: () => void;
  onOutlineChange?: (items: BlueprintOutlineItem[]) => void;

  // Toolbar
  onSetEditorFormat?: (mode: EditorMode) => void;
  onToggleStylePanel?: () => void;
  onCloseStylePanel?: () => void;
  onToggleFocus?: () => void;
  onToggleSidebar?: () => void;
  styleTemplateId?: string;
  onSelectStyleTemplate?: (id: string) => void;

  // Save
  saveState: SaveState;
}

export function EditorCanvas(props: EditorCanvasProps) {
  return (
    <div className="editor-content-area">
      {/* Toolbar */}
      <Toolbar
        onModeSwitch={props.onSetEditorFormat || (() => {})}
        editorMode={props.mode}
        onStyleTemplate={props.onSelectStyleTemplate || (() => {})}
        styleTemplateId={props.styleTemplateId || "default"}
        onToggleStylePanel={props.onToggleStylePanel || (() => {})}
        onCloseStylePanel={props.onCloseStylePanel || (() => {})}
        onToggleFocus={props.onToggleFocus || (() => {})}
        onToggleSidebar={props.onToggleSidebar || (() => {})}
      />

      {/* Article Blueprint Header */}
      {props.blueprint && (
        <ArticleHeader
          blueprint={props.blueprint}
          activeSectionId={props.activeSectionId}
          onUpdateBlueprint={props.onSaveBlueprint}
          onSelectSection={props.onSelectSection}
          onOpenBlueprintEditor={props.onOpenBlueprintEditor}
          onSave={props.onCompleteArticle}
        />
      )}

      {/* TipTap Editor */}
      <EditorContent
        content={props.content}
        mode={props.mode}
        lineHeight={props.lineHeight}
        paragraphGap={props.paragraphGap || "1.25em"}
        aiResponse={props.aiResponse}
        sending={props.sending}
        onCancelStream={props.onCancelStream}
        streamElapsed={props.streamElapsed}
        streamError={props.streamError}
        onChange={props.onChange}
        onClearResponse={props.onClearResponse}
        onInsertResponse={props.onInsertResponse}
        onOutlineChange={props.onOutlineChange}
        styleTemplate={props.styleTemplate}
        editorFontSize={props.editorFontSize}
        editorMaxWidth={props.editorMaxWidth}
        editorFontFamily={props.editorFontFamily}
        codeThemeId={props.codeThemeId}
        showHeadingNumber={props.showHeadingNumber}
      />

      <InlineToolbar />
      <AICommandBar />

      {/* Save state indicator */}
      <EditorSaveIndicator saveState={props.saveState} />
    </div>
  );
}
