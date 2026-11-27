import { api } from "./api";
import { handleResponse } from "./apiError";

/** Dictation (NC §2.3): the mic records WAV on the device and the server writes it down. */

const RATE = 16000;
const SILENCE_MS = 8000;
const MAX_MS = 120000;
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
  /** Stops and drops the recording: `done` resolves null and nothing is sent. */
  cancel: () => void;
  /** The WAV, or null when nothing was said. Rejects with a DictationError. */
  done: Promise<Blob | null>;
}

/**
 * Starts recording now. Call it inside the tap: iOS only lets audio start in a gesture, so the
 * AudioContext is made before the mic permission is awaited. Stops on stop(), after 8 s of
 * silence, or at 2 minutes. `onLevel` gets the loudness (RMS, 0–1) of each slice, for the waveform.
 */
export function record(onLevel?: (level: number) => void): Recording {
  const Context = audioContext();
  const context = Context ? new Context() : null;
  let stopRequested = false;
  let cancelled = false;
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
        // Brought down to 16 kHz as it arrives, so 2 minutes stay about 8 MB instead of 3 copies of 23 MB
        const resample = downsampler(context.sampleRate);
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
          void context.close();
          resolve(!cancelled && loudMs >= SPEECH_MIN_MS ? wav(chunks) : null);
        };
        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          chunks.push(resample(input));
          let sum = 0;
          for (const sample of input) sum += sample * sample;
          const time = performance.now();
          const level = Math.sqrt(sum / input.length);
          onLevel?.(level);
          if (level > SPEECH_RMS) {
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

  return {
    stop: () => stopNow(),
    cancel: () => {
      cancelled = true;
      stopNow();
    },
    done,
  };
}

/**
 * `POST /notes/dictation`: the words heard, empty when the model heard none. `signal` drops the
 * request when the sheet closes.
 */
export async function transcribe(
  audio: Blob,
  signal?: AbortSignal,
): Promise<string> {
  const body = new FormData();
  body.append("audio", audio, "dictation.wav");
  const { text } = await handleResponse<{ text: string }>(
    await api("/notes/dictation", { method: "POST", body, signal }),
  );
  return text;
}

/**
 * Brings slices at the device's `rate` down to 16 kHz, one at a time. Each output sample is the
 * average of its window (a crude low-pass, enough for speech); a window may span two slices.
 */
export function downsampler(
  rate: number,
): (input: Float32Array) => Float32Array {
  const ratio = rate / RATE;
  let position = 0; // input samples seen so far
  let next = ratio; // where the current output sample's window ends
  let sum = 0;
  let count = 0;
  return (input) => {
    const out = new Float32Array(Math.ceil(input.length / ratio) + 1);
    let written = 0;
    for (const sample of input) {
      sum += sample;
      count++;
      position++;
      if (position >= next) {
        out[written++] = sum / count;
        sum = 0;
        count = 0;
        next += ratio;
      }
    }
    return out.subarray(0, written);
  };
}

/** 16-bit mono PCM WAV from 16 kHz slices. */
function wav(chunks: Float32Array[]): Blob {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const view = new DataView(new ArrayBuffer(44 + length * 2));
  const text = (at: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
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
  view.setUint32(40, length * 2, true);
  let at = 44;
  for (const chunk of chunks)
    for (const sample of chunk) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(
        at,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true,
      );
      at += 2;
    }
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
