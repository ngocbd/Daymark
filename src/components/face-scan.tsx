import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera, ScanFace } from "lucide-react";
import { Button } from "@/components/ui";

export type FacePhase = "opening" | "live" | "locked" | "blocked";

export type FaceScanHandle = {
  getPhase: () => FacePhase;
  capture: () => string | null;
};

type Detector = {
  detect: (input: CanvasImageSource) => Promise<{ boundingBox?: DOMRectReadOnly }[]>;
};

function makeDetector(): Detector | null {
  const ctor = (
    window as unknown as {
      FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => Detector;
    }
  ).FaceDetector;
  if (!ctor) return null;
  try {
    return new ctor({ fastMode: true, maxDetectedFaces: 1 });
  } catch {
    return null;
  }
}

function skinScore(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || video.videoWidth === 0) return { ratio: 0, lum: 0 };
  const w = 80;
  const h = 60;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let skin = 0;
  let total = 0;
  let lum = 0;
  for (let y = 12; y < 48; y++) {
    for (let x = 24; x < 56; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      total++;
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      lum += Y;
      if (Y > 60 && cr > 133 && cr < 173 && cb > 77 && cb < 127) skin++;
    }
  }
  return { ratio: total ? skin / total : 0, lum: total ? lum / total : 0 };
}

function grabFrame(video: HTMLVideoElement): string | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const w = 360;
  const h = Math.max(1, Math.round((w * video.videoHeight) / video.videoWidth));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.72);
}

const copy: Record<FacePhase, string> = {
  opening: "Opening the camera\u2026",
  live: "Looking for a face in the oval",
  locked: "Face locked. Ready to stamp this punch.",
  blocked: "Camera isn't available. You can still clock in without a photo.",
};

export const FaceScan = forwardRef<FaceScanHandle>(function FaceScan(_, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<FacePhase>("opening");
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<FacePhase>("opening");
  const [detail, setDetail] = useState("On-device check. Nothing is uploaded.");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useImperativeHandle(ref, () => ({
    getPhase: () => phaseRef.current,
    capture: () => {
      const video = videoRef.current;
      if (!video) return null;
      return grabFrame(video);
    },
  }));

  useEffect(() => {
    if (!sampleRef.current) sampleRef.current = document.createElement("canvas");
    let stopped = false;
    let timer = 0;
    let still = 0;
    let lastLum = -1;
    const detector = makeDetector();

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("blocked");
        setDetail("This browser has no camera API.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setPhase("live");
        setDetail(detector ? "Using the browser face detector." : "Using an on-device presence check.");

        timer = window.setInterval(() => {
          const node = videoRef.current;
          const canvas = sampleRef.current;
          if (!node || !canvas || node.readyState < 2) return;
          const score = skinScore(node, canvas);
          const motion = lastLum < 0 ? 99 : Math.abs(score.lum - lastLum);
          lastLum = score.lum;
          const seen = score.ratio > 0.16;
          if (seen && motion < 8) still += 1;
          else still = 0;

          if (detector && still > 0 && still % 2 === 0) {
            void detector
              .detect(node)
              .then((faces) => {
                if (stopped) return;
                if (faces.length > 0 && motion < 10) {
                  setPhase("locked");
                  return;
                }
                setPhase(faces.length > 0 || seen ? "live" : "live");
              })
              .catch(() => {
                if (seen && still >= 3) setPhase("locked");
                else if (node.srcObject) setPhase("live");
              });
            return;
          }

          if (seen && still >= 3) setPhase("locked");
          else if (node.srcObject) setPhase(seen ? "live" : "live");
          if (seen && still < 3) setDetail("Face in frame. Hold still.");
          else if (!seen) setDetail("Center your face in the oval.");
          else setDetail("Face locked. Ready to stamp this punch.");
        }, 220);
      } catch {
        if (!stopped) {
          setPhase("blocked");
          setDetail("Camera permission was blocked or no camera was found.");
        }
      }
    }

    void start();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  return (
    <section className="rounded-card bg-surface p-3 shadow-card">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <ScanFace className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Live face scan</h2>
        </div>
        {phase === "live" || phase === "locked" ? (
          <span className="rounded-full bg-clay-soft px-2 py-1 text-xs font-semibold tracking-wide text-clay">
            Live
          </span>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-ink">
        {phase === "blocked" ? (
          <div className="flex min-h-64 flex-col items-start justify-end gap-3 p-4">
            <Camera className="size-6 text-on-primary" aria-hidden="true" />
            <p className="max-w-xs text-sm text-on-primary">{copy.blocked}</p>
            <Button variant="soft" onClick={() => setAttempt((n) => n + 1)}>
              Try camera again
            </Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay muted playsInline className="mirror face-frame w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div
                className={`face-oval h-[70%] w-[46%] rounded-[50%] border-2 ${phase === "locked" ? "border-primary-soft" : "border-on-primary"}`}
              />
            </div>
          </>
        )}
        {phase !== "blocked" ? (
          <p className="absolute inset-x-3 bottom-3 z-10 rounded-xl bg-ink/80 px-3 py-2 text-sm text-on-primary">
            {phase === "locked" ? copy.locked : phase === "opening" ? copy.opening : detail}
          </p>
        ) : null}
      </div>
      <p className="mt-3 px-1 text-xs text-muted">
        Presence proof only \u2014 not an identity match. The photo stays in this browser.
      </p>
    </section>
  );
});
