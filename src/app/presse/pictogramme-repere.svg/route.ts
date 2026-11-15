import { markSvg, svgResponse } from "../brand-svg";

export const dynamic = "force-static";

export function GET() {
  return svgResponse(markSvg(), "pictogramme-repere.svg");
}
