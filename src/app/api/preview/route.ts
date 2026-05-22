import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

const ENGINE = "G:\\projects\\doc-format-platform\\engine\\doc_format_agent.py";

export async function POST(req: NextRequest) {
  let inputPath = "";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    // 保存上传文件
    const tmpDir = tmpdir();
    const id = randomUUID();
    inputPath = join(tmpDir, `${id}_preview.docx`);
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

    // 调用 Python --preview 模式（不用 --quiet，需要读 stdout）
    const stdout = await runPythonPreview(inputPath);

    await safeUnlink(inputPath);

    return NextResponse.json(JSON.parse(stdout), { status: 200 });
  } catch (e: any) {
    await safeUnlink(inputPath);
    return NextResponse.json({ error: e.message || "Preview error" }, { status: 500 });
  }
}

function runPythonPreview(target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python", [ENGINE, "--stdin", "--preview"], {
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (err) => reject(new Error(err.message)));
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `exit code ${code}`));
    });

    const stdinData = JSON.stringify({ target });
    proc.stdin.write(stdinData, "utf-8", () => proc.stdin.end());
  });
}

async function safeUnlink(p: string) {
  try { if (p) await unlink(p); } catch {}
}
