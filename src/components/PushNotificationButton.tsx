"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, BellRing } from "lucide-react";

type PushState =
  | "checking"
  | "idle"
  | "requesting"
  | "subscribed"
  | "denied"
  | "unsupported"
  | "error";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) {
    view[i] = raw.charCodeAt(i);
  }
  return view;
}

type Props = { pin: string };

export function PushNotificationButton({ pin }: Props) {
  const [state, setState] = useState<PushState>("checking");

  useEffect(() => {
    let mounted = true;
    const detectState = async (): Promise<PushState> => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        return "unsupported";
      if (Notification.permission === "denied") return "denied";
      try {
        const reg = await navigator.serviceWorker.ready;
        return (await reg.pushManager.getSubscription())
          ? "subscribed"
          : "idle";
      } catch {
        return "idle";
      }
    };
    void detectState().then((next) => {
      if (mounted) setState(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleEnable = async () => {
    if (state === "requesting") return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set");
      setState("error");
      return;
    }

    setState("requesting");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, subscription: sub }),
      });

      if (!res.ok) throw new Error("Subscribe API failed");

      setState("subscribed");
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
      setState("error");
    }
  };

  // Fully unsupported browser — hide entirely
  if (state === "unsupported" || state === "checking") return null;

  // Already subscribed — show a passive indicator
  if (state === "subscribed") {
    return (
      <div
        className="rounded-full border border-amber/40 bg-amber/10 p-2 text-amber-deep"
        title="Push notifications enabled"
      >
        <BellRing className="h-4 w-4" />
      </div>
    );
  }

  // Permission permanently denied — show disabled icon
  if (state === "denied") {
    return (
      <div
        className="rounded-full border border-border p-2 text-muted/40"
        title="Notifications blocked — enable in browser settings"
      >
        <BellOff className="h-4 w-4" />
      </div>
    );
  }

  // idle | error — tap-to-enable button
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={`rounded-full border border-border p-2 text-muted transition hover:border-amber/40 hover:text-foreground ${
        state === "requesting"
          ? "animate-pulse cursor-wait opacity-60"
          : "cursor-pointer"
      }`}
      disabled={state === "requesting"}
      onClick={handleEnable}
      title={
        state === "error"
          ? "Retry enabling notifications"
          : "Enable push notifications"
      }
      type="button"
    >
      <Bell className="h-4 w-4" />
    </motion.button>
  );
}
