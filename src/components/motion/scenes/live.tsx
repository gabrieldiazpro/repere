/**
 * Scènes animées branchées sur les comptes démo (composants serveur) : les chiffres sont calculés au rendu par
 * src/components/site/demo-figures.ts, à partir de la même source que les comptes démo, puis passés aux scènes client.
 * À utiliser à la place des scènes nues dans les pages (B9 de qa/v3/regard-client-v3.md : plus de dérive possible).
 */
import { MeasureScene as MeasureSceneView } from "./MeasureScene";
import { UnderstandScene as UnderstandSceneView } from "./UnderstandScene";
import { ProveScene as ProveSceneView } from "./ProveScene";
import { measureSceneData, orNull, proveSceneData, understandSceneData } from "@/components/site/demo-figures";

export function MeasureScene() {
  return <MeasureSceneView data={measureSceneData()} />;
}

export function UnderstandScene() {
  return <UnderstandSceneView data={understandSceneData()} />;
}

export async function ProveScene() {
  const data = await orNull(proveSceneData());
  return data ? <ProveSceneView data={data} /> : null;
}
