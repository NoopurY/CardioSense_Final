"use client";

import { useEffect, useRef } from "react";
import { useCardioStore } from "@/lib/store";

export function useECGWebSocket(deviceId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const pushECG = useCardioStore((s) => s.pushECG);
  const setBpm = useCardioStore((s) => s.setBpm);

  useEffect(() => {
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inferred = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    const baseUrl = process.env.NEXT_PUBLIC_WS_URL ?? inferred;

    const connect = () => {
      wsRef.current = new WebSocket(`${baseUrl}/api/ws/ecg/${deviceId}`);

      wsRef.current.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (Array.isArray(msg.signal)) pushECG(msg.signal);
        if (typeof msg.bpm === "number") setBpm(msg.bpm);
      };

      wsRef.current.onclose = () => {
        retry += 1;
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry, 8000));
      };
    };

    connect();
    return () => {
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [deviceId, pushECG, setBpm]);
}
