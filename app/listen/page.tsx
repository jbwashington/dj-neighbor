"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CLIP_MS = 6_000; // length of each audio sample sent for recognition

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export default function Listen() {
  const [running, setRunning] = useState(false);
  const [secret, setSecret] = useState("");
  const [intervalSec, setIntervalSec] = useState(10);
  const [status, setStatus] = useState("Idle.");
  const [log, setLog] = useState<string[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    setSecret(localStorage.getItem("dj-neighbor-secret") ?? "");
    setDeviceId(localStorage.getItem("dj-neighbor-device") ?? "");
  }, []);

  const addLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLog((prev) => [`${stamp}  ${line}`, ...prev].slice(0, 30));
  }, []);

  const refreshDevices = useCallback(async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list.filter((d) => d.kind === "audioinput"));
  }, []);

  // Grant permission once so device labels become available, then list inputs.
  const enableMic = useCallback(async () => {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      tmp.getTracks().forEach((t) => t.stop());
      await refreshDevices();
      setStatus("Mic enabled — pick the device by the window, then Start.");
      addLog("🎚️  devices loaded");
    } catch {
      setStatus("Microphone permission denied or unavailable.");
      addLog("⚠️  could not access microphone");
    }
  }, [refreshDevices, addLog]);

  const captureAndSend = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || busyRef.current) return;
    busyRef.current = true;

    try {
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();
      setStatus("Listening…");
      await new Promise((r) => setTimeout(r, CLIP_MS));
      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      setStatus("Identifying…");

      const form = new FormData();
      form.set("audio", blob, "clip.webm");

      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: secret ? { "x-listener-secret": secret } : undefined,
        body: form,
      });
      const data = await res.json();

      if (!res.ok) {
        addLog(`⚠️  ${data.error ?? `error ${res.status}`}`);
        setStatus("Error — see log.");
      } else if (data.recognized === false) {
        addLog("…no match (kept previous song)");
        setStatus("No match. Will try again.");
      } else if (data.nowPlaying) {
        addLog(`🎵 ${data.nowPlaying.artist} — ${data.nowPlaying.title}`);
        setStatus(`Now playing: ${data.nowPlaying.title}`);
      }
    } catch (err) {
      addLog(`⚠️  ${err instanceof Error ? err.message : String(err)}`);
      setStatus("Error — see log.");
    } finally {
      busyRef.current = false;
    }
  }, [secret, addLog]);

  const start = useCallback(async () => {
    try {
      // Disable voice-call processing — it suppresses music as "noise" and
      // wrecks recognition. We want the rawest possible capture.
      const audio: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
      if (deviceId) audio.deviceId = { exact: deviceId };
      const constraints: MediaStreamConstraints = { audio };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      localStorage.setItem("dj-neighbor-secret", secret);
      localStorage.setItem("dj-neighbor-device", deviceId);
      if (devices.length === 0) await refreshDevices();
      setRunning(true);
      const label =
        devices.find((d) => d.deviceId === deviceId)?.label ?? "default mic";
      addLog(`🎙️  microphone on (${label})`);
      captureAndSend();
      timerRef.current = setInterval(captureAndSend, intervalSec * 1000);
    } catch {
      setStatus("Microphone permission denied or unavailable.");
      addLog("⚠️  could not access microphone");
    }
  }, [secret, deviceId, devices, intervalSec, captureAndSend, refreshDevices, addLog]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
    setStatus("Stopped.");
    addLog("⏹️  stopped");
  }, [addLog]);

  useEffect(() => () => stop(), [stop]);

  return (
    <main className="wrap">
      <div className="listen-card">
        <h1>🎧 Listener device</h1>
        <p className="status">
          Point the chosen mic toward the window and tap start. It samples{" "}
          {CLIP_MS / 1000}s of audio every {intervalSec}s and pushes the song to the public page.
        </p>

        <label className="field">
          Microphone
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={running}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0d0d15",
              color: "var(--text)",
              fontSize: 15,
            }}
          >
            <option value="">Default microphone</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Input ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </label>

        {devices.length === 0 && !running ? (
          <button className="big-btn" onClick={enableMic} style={{ background: "#2a2140", color: "var(--text)" }}>
            Enable mic &amp; list devices
          </button>
        ) : null}

        <label className="field">
          Listener secret (if the server requires one)
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="leave blank if none"
            disabled={running}
          />
        </label>

        <label className="field">
          Seconds between checks
          <input
            type="number"
            min={5}
            value={intervalSec}
            onChange={(e) => setIntervalSec(Math.max(5, Number(e.target.value) || 10))}
            disabled={running}
          />
        </label>

        {running ? (
          <button className="big-btn stop" onClick={stop}>
            Stop listening
          </button>
        ) : (
          <button className="big-btn" onClick={start}>
            Start listening
          </button>
        )}

        <div className="status">{status}</div>
        <div className="log">{log.join("\n") || "log will appear here…"}</div>

        <a className="footer-link" href="/">
          ← public now-playing page
        </a>
      </div>
    </main>
  );
}
