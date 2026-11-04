"use client";

import { useEffect, useState } from "react";
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

// The household is resolved server-side from the signed-in session.
export function PushNotificationButton() {
  const [state, setState] = useState<PushState>("checking");

  useEffect(() => {
    let mounted = true;
    const detectState = async (): Promise<PushState> => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        return "unsupported";
      if (Notification.permission === "denied") return "denied";
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!existing) return "idle";
        // Re-register so the server knows which member owns this device
        // (older rows have none) and the row survives a household change.
        void fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: existing }),
        }).catch(() => undefined);
        return "subscribed";
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
        body: JSON.stringify({ subscription: sub }),
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

  // Already subscribed — passive status
  if (state === "subscribed") {
    return (
      <span className="status-pill is-on" title="This device gets push notifications" role="status">
        <BellRing size={15} />
        <span className="hide-on-phone">Notifications on</span>
      </span>
    );
  }

  // Permission permanently denied
  if (state === "denied") {
    return (
      <span
        className="status-pill"
        title="Notifications are blocked. Allow them for this site in your browser settings."
        role="status"
      >
        <BellOff size={15} />
        <span className="hide-on-phone">Notifications blocked</span>
      </span>
    );
  }

  // idle | requesting | error — tap to enable
  return (
    <button
      className="btn btn-secondary btn-sm"
      disabled={state === "requesting"}
      aria-busy={state === "requesting"}
      onClick={handleEnable}
      aria-label={state === "error" ? "Retry turning on notifications" : "Turn on notifications"}
      type="button"
    >
      <Bell size={15} />
      <span className="hide-on-phone">
        {state === "requesting" ? "Turning on…" : state === "error" ? "Retry notifications" : "Turn on notifications"}
      </span>
    </button>
  );
}
