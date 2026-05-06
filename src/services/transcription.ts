import Groq from "groq-sdk";
import { toFile } from "openai/uploads";

export async function transcribeVoiceOggOpus(audioBuffer: Buffer): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const client = new Groq({ apiKey });

  const file = await toFile(audioBuffer, "voice.ogg", {
    type: "audio/ogg",
  });

  const result = await client.audio.transcriptions.create({
    model: "whisper-large-v3-turbo",
    file,
  });

  return (result.text || "").trim();
}