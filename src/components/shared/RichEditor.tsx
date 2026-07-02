import React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Table as TableIcon, Quote, Link as LinkIcon, Code, Trash2,
} from "lucide-react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

function Toolbar({ editor }: { editor: Editor }) {
  if (!editor) return null;

  const btn = (
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    title: string
  ) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-slate-200 text-slate-900"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      {icon}
    </button>
  );

  const addLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const insertInfoBox = () => {
    editor
      .chain()
      .focus()
      .insertContent('<div class="info-box"><p>Info box content</p></div>')
      .run();
  };

  const insertWarningBox = () => {
    editor
      .chain()
      .focus()
      .insertContent('<div class="warning-box"><p>Warning box content</p></div>')
      .run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold size={14} />, "Bold")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic size={14} />, "Italic")}
      <span className="mx-1 h-4 w-px bg-slate-200" />
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={14} />, "H2")}
      {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 size={14} />, "H3")}
      <span className="mx-1 h-4 w-px bg-slate-200" />
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <List size={14} />, "Bullet list")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={14} />, "Ordered list")}
      <span className="mx-1 h-4 w-px bg-slate-200" />
      {btn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), <TableIcon size={14} />, "Insert table")}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), <Quote size={14} />, "Blockquote")}
      {btn(editor.isActive("link"), addLink, <LinkIcon size={14} />, "Add link")}
      {btn(editor.isActive("code"), () => editor.chain().focus().toggleCode().run(), <Code size={14} />, "Code")}
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); insertInfoBox(); }}
        className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        title="Info Box"
      >
        Info Box
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); insertWarningBox(); }}
        className="rounded px-2 py-1 text-xs font-medium text-yellow-600 hover:bg-yellow-50 transition-colors"
        title="Warning Box"
      >
        Warning Box
      </button>
      <span className="ml-auto" />
      {btn(false, () => editor.chain().focus().clearNodes().unsetAllMarks().run(), <Trash2 size={14} />, "Clear formatting")}
    </div>
  );
}

export function RichEditor({
  content,
  onChange,
  placeholder = "Start writing…",
  className,
  minHeight = 300,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-4 py-3",
      },
    },
  });

  const wordCount = editor?.storage.characterCount?.words() ?? 0;
  const charCount = editor?.storage.characterCount?.characters() ?? 0;

  return (
    <div className={cn("overflow-hidden rounded-md border border-slate-200 bg-white", className)}>
      {editor && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="cursor-text"
      />
      <div className="flex justify-end gap-4 border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-xs text-slate-400">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
      </div>
    </div>
  );
}
