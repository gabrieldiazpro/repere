import { lockupSvg, svgResponse } from "../brand-svg";

export const dynamic = "force-static";

export function GET() {
  return svgResponse(lockupSvg("blanc"), "logo-repere-blanc.svg");
}
