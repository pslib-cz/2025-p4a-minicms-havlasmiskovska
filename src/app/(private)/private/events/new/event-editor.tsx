"use client";

import { useRef, useState } from "react";
import styles from "./event-form.module.css";

type UploadedFile = {
  url: string;
  name: string;
  kind: "image" | "file";
};

type EventEditorProps = {
  name: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function EventEditor({ name }: EventEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  function syncHiddenInput() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const hidden = document.getElementById(name) as HTMLInputElement | null;
    if (!hidden) {
      return;
    }

    hidden.value = editor.innerHTML;
  }

  function runCommand(command: string, value?: string) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    syncHiddenInput();
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

      const response = await fetch("/api/events/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const payload = (await response.json()) as { files: UploadedFile[] };

      for (const file of payload.files) {
        if (file.kind === "image") {
          const html = `<p><img src=\"${escapeHtml(file.url)}\" alt=\"${escapeHtml(file.name)}\" style=\"max-width:100%;height:auto;border-radius:8px;\" /></p>`;
          runCommand("insertHTML", html);
        } else {
          const html = `<p><a href=\"${escapeHtml(file.url)}\" target=\"_blank\" rel=\"noopener noreferrer\">${escapeHtml(file.name)}</a></p>`;
          runCommand("insertHTML", html);
        }
      }
    } catch {
      window.alert("File upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      syncHiddenInput();
    }
  }

  return (
    <div className={styles.editorWrap}>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => runCommand("formatBlock", "h1")}>H1</button>
        <button type="button" onClick={() => runCommand("formatBlock", "h2")}>H2</button>
        <button type="button" onClick={() => runCommand("insertUnorderedList")}>List</button>
        <button
          type="button"
          onClick={() => {
            const link = window.prompt("Enter URL");
            if (link) {
              runCommand("createLink", link);
            }
          }}
        >
          Link
        </button>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? "Uploading..." : "Attach"}
        </button>
      </div>

      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        suppressContentEditableWarning
        onInput={syncHiddenInput}
      >
        <p>Describe what happened...</p>
      </div>

      <input type="hidden" name={name} id={name} />
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={(event) => {
          void uploadFiles(event.target.files);
        }}
      />
    </div>
  );
}
