'use client';
import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("QwiloPro ServiceWorker registered with scope:", registration.scope);
          })
          .catch((err) => {
            console.warn("QwiloPro ServiceWorker registration failed:", err);
          });
      });
    }
  }, []);

  return null;
}
