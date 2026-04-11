import { create } from "zustand";

type CardioState = {
  bpm: number;
  ecgBuffer: number[];
  alerts: string[];
  setBpm: (bpm: number) => void;
  pushECG: (chunk: number[]) => void;
  clearLiveData: () => void;
  addAlert: (message: string) => void;
};

export const useCardioStore = create<CardioState>((set) => ({
  bpm: 0,
  ecgBuffer: [],
  alerts: [],
  setBpm: (bpm) => set({ bpm }),
  pushECG: (chunk) => set((s) => ({ ecgBuffer: [...s.ecgBuffer.slice(-1600), ...chunk] })),
  clearLiveData: () => set({ bpm: 0, ecgBuffer: [] }),
  addAlert: (message) => set((s) => ({ alerts: [message, ...s.alerts].slice(0, 20) })),
}));
