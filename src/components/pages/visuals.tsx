/**
 * Visuel d'une fonction : vidéo de démo (si enregistrée) sinon scène animée de MOTION pour les 4 piliers,
 * aperçu statique pour les modules. Composant serveur.
 */
import type { ReactNode } from "react";
import { DemoVideo } from "@/components/motion/DemoVideo";
import { MeasureScene } from "@/components/motion/scenes/live";
import { UnderstandScene } from "@/components/motion/scenes/live";
import { ActScene } from "@/components/motion/scenes/ActScene";
import { ProveScene } from "@/components/motion/scenes/live";
import { HallucinationScreen, SourcesScreen, TaskScreen, TrafficScreen } from "@/components/site/mockups";
import type { VisualId } from "./features-data";
import { AgentMock, AnalyseMock, BarometreMock, GeoMock, PerfThresholds, PositionsMock, SeoAuditMock } from "./v5-visuals";
import { AuditPageMock, CopilotMock, EcommerceMock, LocalMock, QuestionsMock, ReportsMock } from "./mocks";

export function FeatureVisual({ id, caption }: { id: VisualId; caption?: string }): ReactNode {
  switch (id) {
    case "mesurer":
      return <DemoVideo id="mesurer" fallback={<MeasureScene />} caption={caption} />;
    case "comprendre":
      return <DemoVideo id="comprendre" fallback={<UnderstandScene />} caption={caption} />;
    case "agir":
      return <DemoVideo id="agir" fallback={<ActScene />} caption={caption} />;
    case "prouver":
      return <DemoVideo id="prouver" fallback={<ProveScene />} caption={caption} />;
    case "questions":
      return <QuestionsMock />;
    case "copilote":
      return <CopilotMock />;
    case "audit-page":
      return <AuditPageMock />;
    case "local":
      return <LocalMock />;
    case "ecommerce":
      return <EcommerceMock />;
    case "rapports":
      return <ReportsMock />;
    case "verite":
      return <HallucinationScreen />;
    case "sources":
      return <SourcesScreen />;
    case "taches":
      return <TaskScreen />;
    case "trafic":
      return <TrafficScreen />;
    case "analyse":
      return <AnalyseMock />;
    case "seo-audit":
      return <SeoAuditMock />;
    case "positions":
      return <PositionsMock />;
    case "performance":
      return <PerfThresholds />;
    case "geo":
      return <GeoMock />;
    case "agent":
      return <AgentMock />;
    case "barometres":
      return <BarometreMock />;
  }
}
