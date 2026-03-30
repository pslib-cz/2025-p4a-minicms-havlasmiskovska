"use client";

import { useRef, useState } from "react";

type UploadedFile = {
    url: string;
    name: string;
    kind: "image" | "file";
};

type EventEditorProps = {
    name: string;
    initialHtml?: string;
};

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export default function EventEditor({ name, initialHtml }: EventEditorProps) {
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

            const payload = (await response.json()) as {
                files: UploadedFile[];
            };

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
        <div className="border border-secondary-subtle rounded-4 shadow-sm overflow-hidden bg-white mb-2">
            <div className="d-flex flex-wrap align-items-center gap-3 p-3 bg-light border-bottom border-secondary-subtle">
                <div className="btn-group shadow-sm">
                    <button
                        className="btn btn-outline-secondary fw-bold px-3"
                        type="button"
                        onClick={() => runCommand("formatBlock", "p")}
                    >
                        Normal
                    </button>
                    <button
                        className="btn btn-outline-secondary fw-bold px-3"
                        type="button"
                        onClick={() => runCommand("formatBlock", "h1")}
                    >
                        H1
                    </button>
                    <button
                        className="btn btn-outline-secondary fw-bold px-3"
                        type="button"
                        onClick={() => runCommand("formatBlock", "h2")}
                    >
                        H2
                    </button>
                </div>

                <div className="btn-group shadow-sm">
                    <button
                        className="btn btn-outline-secondary px-3"
                        type="button"
                        onClick={() => runCommand("insertUnorderedList")}
                    >
                        • List
                    </button>
                    <button
                        className="btn btn-outline-secondary px-3"
                        type="button"
                        onClick={() => {
                            const link = window.prompt("Enter URL");
                            if (link) {
                                runCommand("createLink", link);
                            }
                        }}
                    >
                        🔗 Link
                    </button>
                </div>

                <div className="ms-auto">
                    <button
                        className="btn btn-primary fw-bold shadow-sm px-4"
                        type="button"
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {isUploading ? "Uploading..." : "📎 Attach File"}
                    </button>
                </div>
            </div>

            <div
                ref={editorRef}
                className="p-4 fs-5"
                style={{ minHeight: "300px", outline: "none" }}
                contentEditable
                suppressContentEditableWarning
                onInput={syncHiddenInput}
                dangerouslySetInnerHTML={{
                    __html:
                        initialHtml ||
                        "<p class='text-muted'>Describe what happened...</p>",
                }}
            />

            <input
                type="hidden"
                name={name}
                id={name}
                defaultValue={initialHtml || ""}
            />
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
