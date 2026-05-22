import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

const ENGINE = "G:\\projects\\doc-format-platform\\engine\\doc_format_agent.py";

export async function POST(req: NextRequest) {
  let inputPath = "";
  let outputPath = "";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const text = (formData.get("text") as string) || "";
    const configJson = (formData.get("config") as string) || "{}";

    if (!file && !text) return err("No file or text provided", 400);

    const config = JSON.parse(configJson);

    const tmpDir = tmpdir();
    const id = randomUUID();
    outputPath = join(tmpDir, `${id}_output.docx`);

    if (text) {
      // ── 文本模式：传文字给 Python，由它创建 docx 并格式化 ──
      const stdinData = JSON.stringify({
        text,
        output: outputPath,
        elements: config.elements || {},
        style_map: config.style_map || {},
        page: config.page || {},
        text_structure: config.text_structure || {},
      });
      await runPython(stdinData, "--text");
    } else {
      // ── 文件模式：保存上传文件，Python 格式化 ──
      inputPath = join(tmpDir, `${id}_input.docx`);
      await writeFile(inputPath, Buffer.from(await file!.arrayBuffer()));
      const stdinData = JSON.stringify({
        target: inputPath,
        output: outputPath,
        elements: config.elements || {},
        style_map: config.style_map || {},
        page: config.page || {},
      });
      await runPython(stdinData);
    }

    const resultBuffer = await readFile(outputPath);
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);

    return new NextResponse(resultBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="formatted.docx"`,
      },
    });
  } catch (e: any) {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
    return err(e.message || "Internal error", 500);
  }
}

function runPython(stdinData: string, extraFlag = ""): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [ENGINE, "--stdin", "--quiet"];
    if (extraFlag) args.push(extraFlag);
    const proc = spawn("python", args, {
      timeout: 60_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    proc.on("error", (err) => reject(new Error(err.message)));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `exit code ${code}`));
    });
    proc.stdin.write(stdinData, "utf-8", () => proc.stdin.end());
  });
}

async function safeUnlink(p: string) {
  try { if (p) await unlink(p); } catch {}
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
