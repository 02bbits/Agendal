import { api } from "./api";
import { handleResponse } from "./apiError";

/** Dictation (NC §2.3): the mic records WAV on the device and the server writes it down. */

const RATE = 16000;
const SILENCE_MS = 8000;
const MAX_MS = 60000;
// ponytail: a fixed loudness gate for "someone is speaking"; tune it on real phones if quiet voices are cut off
const SPEECH_RMS = 0.015;
// A click or a cough isn't speech: the recording is sent only with this much loud sound in it
const SPEECH_MIN_MS = 300;

type AudioContextClass = typeof AudioContext;
const audioContext = (): AudioContextClass | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextClass })
        .webkitAudioContext);

/** The mic shows only where the browser can record. */
export const canDictate = () =>
  !!audioContext() && !!navigator.mediaDevices?.getUserMedia;

export type DictationError = "denied" | "failed";

export interface Recording {
  stop: () => void;
  /** The WAV, or null when nothing was said. Rejects with a DictationError. */
  done: Promise<Blob | null>;
}

/**
 * Starts recording now. Call it inside the tap: iOS only lets audio start in a gesture, so the
 * AudioContext is made before the mic permission is awaited. Stops on stop(), after 8 s of
 * silence, or at 60 s.
 */
export function record(): Recording {
  const Context = audioContext();
  const context = Context ? new Context() : null;
  let stopRequested = false;
  let stopNow = () => {
    stopRequested = true;
  };

  const done = new Promise<Blob | null>((resolve, reject) => {
    if (!context) return reject("failed" satisfies DictationError);
    void context.resume();
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      .then((stream) => {
        const source = context.createMediaStreamSource(stream);
        // ScriptProcessor, not an AudioWorklet: it needs no module file and runs everywhere
        const processor = context.createScriptProcessor(4096, 1, 1);
        const chunks: Float32Array[] = [];
        const started = performance.now();
        let lastSound = started;
        let loudMs = 0;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          processor.disconnect();
          source.disconnect();
          stream.getTracks().forEach((track) => track.stop());
          const rate = context.sampleRate;
          void context.close();
          resolve(
            loudMs >= SPEECH_MIN_MS ? wav(downsample(chunks, rate)) : null,
          );
        };
        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          chunks.push(new Float32Array(input));
          let sum = 0;
          for (const sample of input) sum += sample * sample;
          const time = performance.now();
          if (Math.sqrt(sum / input.length) > SPEECH_RMS) {
            loudMs += (input.length / context.sampleRate) * 1000;
            lastSound = time;
          }
          if (time - lastSound > SILENCE_MS || time - started > MAX_MS)
            finish();
        };
        source.connect(processor);
        processor.connect(context.destination);
        stopNow = finish;
        if (stopRequested) finish();
      })
      .catch((error: unknown) => {
        void context.close();
        reject(
          (error instanceof DOMException && error.name === "NotAllowedError"
            ? "denied"
            : "failed") satisfies DictationError,
        );
      });
  });

  return { stop: () => stopNow(), done };
}

/** `POST /notes/dictation`: the words heard, empty when the model heard none. */
export async function transcribe(audio: Blob): Promise<string> {
  const body = new FormData();
  body.append("audio", audio, "dictation.wav");
  const { text } = await handleResponse<{ text: string }>(
    await api("/notes/dictation", { method: "POST", body }),
  );
  return text;
}

function downsample(chunks: Float32Array[], rate: number): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const all = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  const ratio = rate / RATE;
  const out = new Float32Array(Math.floor(length / ratio));
  // Averaging each window is a crude low-pass, enough for speech
  for (let i = 0; i < out.length; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.max(from + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to; j++) sum += all[j];
    out[i] = sum / (to - from);
  }
  return out;
}

/** 16-bit mono PCM WAV. */
function wav(samples: Float32Array): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(
      44 + i * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
  });
  return new Blob([view], { type: "audio/wav" });
}

const MIC_NOTICE_KEY = "agendal.mic_notice_seen";

/** The notice before the first recording shows once per device (NC §2.3). */
export const micNoticeSeen = () => {
  try {
    return localStorage.getItem(MIC_NOTICE_KEY) === "1";
  } catch {
    return false;
  }
};

export const markMicNoticeSeen = () => {
  try {
    localStorage.setItem(MIC_NOTICE_KEY, "1");
  } catch {
    // Private mode: the notice shows again next time
  }
};
