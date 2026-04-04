import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../lib/auth0";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  // 1. Zero-Trust: Verify that the doctor is authenticated
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  
  if (!file) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  const zaiApiKey = process.env.Z_AI_API_KEY;
  if (!zaiApiKey) {
    return NextResponse.json({ error: "Missing Z.AI API Key" }, { status: 500 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a temporary directory to process the audio
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aegis-audio-"));
    // Detect the extension or force mp3 
    const isWav = file.name?.endsWith(".wav") || file.type === "audio/wav";
    const extension = isWav ? ".wav" : ".mp3";
    const originalFilePath = path.join(tempDir, `input${extension}`);
    
    // Save the original file
    await fs.writeFile(originalFilePath, buffer);

    console.log(`[Z.AI Audio] Processing ${file.size} byte file. Splitting into chunks...`);

    // Use ffmpeg to cut the file into 25-second segments.
    // This ensures each chunk stays below the rigid 30s limit of Z.AI
    await execAsync(`ffmpeg -i "${originalFilePath}" -f segment -segment_time 25 -c copy "${tempDir}/chunk_%03d${extension}"`);

    const filesInDir = await fs.readdir(tempDir);
    const chunkFiles = filesInDir
      .filter((f) => f.startsWith("chunk_") && f.endsWith(extension))
      .sort(); // sort will ensure the order chunk_000, chunk_001, etc.

    console.log(`[Z.AI Audio] File divided into ${chunkFiles.length} chunk(s)`);

    let fullText = "";

    // Send each chunk to Z.AI sequentially
    for (const chunkFileName of chunkFiles) {
      console.log(`[Z.AI Audio] Transcribing ${chunkFileName}...`);
      const chunkPath = path.join(tempDir, chunkFileName);
      const chunkBuffer = await fs.readFile(chunkPath);
      
      const blob = new Blob([chunkBuffer], { type: isWav ? "audio/wav" : "audio/mp3" });
      const zaiFormData = new FormData();
      zaiFormData.append("file", blob, chunkFileName);
      zaiFormData.append("model", "glm-asr-2512");

      const res = await fetch("https://api.z.ai/api/paas/v4/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${zaiApiKey}`
        },
        body: zaiFormData as any
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Error in Z.AI transcription");
      }

      fullText += (fullText ? " " : "") + data.text;
    }

    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });

    console.log(`[Z.AI Audio] ✅ Successful transcription. Obtained ${fullText.length} characters.`);
    return NextResponse.json({ text: fullText });

  } catch (error: any) {
    console.error("[Z.AI Audio] ❌ Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
