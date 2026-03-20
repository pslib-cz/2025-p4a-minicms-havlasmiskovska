import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

type UploadedFile = {
  url: string;
  name: string;
  kind: "image" | "file";
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ files: [] });
  }

  const uploadDir = join(process.cwd(), "public", "uploads", "events");
  await mkdir(uploadDir, { recursive: true });

  const uploaded: UploadedFile[] = [];

  for (const file of files) {
    const originalName = sanitizeFileName(file.name || "file");
    const ext = extname(originalName) || "";
    const baseName = originalName.slice(0, originalName.length - ext.length) || "file";
    const finalName = `${baseName}-${randomUUID()}${ext}`;
    const fullPath = join(uploadDir, finalName);

    const bytes = await file.arrayBuffer();
    await writeFile(fullPath, Buffer.from(bytes));

    uploaded.push({
      url: `/uploads/events/${finalName}`,
      name: originalName,
      kind: file.type.startsWith("image/") ? "image" : "file",
    });
  }

  return NextResponse.json({ files: uploaded });
}
