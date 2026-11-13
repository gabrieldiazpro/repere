"use client";

import { createContext, useContext } from "react";

/** État partagé d'une scène jouée par <ScenePlayer /> (pause, mouvement réduit). */
export type SceneState = { paused: boolean; reduced: boolean; playing: boolean };
export const SceneContext = createContext<SceneState>({ paused: false, reduced: false, playing: false });
export const useScene = () => useContext(SceneContext);
