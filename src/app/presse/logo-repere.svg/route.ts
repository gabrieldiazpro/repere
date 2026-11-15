import { lockupSvg, svgResponse } from "../brand-svg";

export const dynamic = "force-static";

export function GET() {
  return svgResponse(lockupSvg("couleur"), "logo-repere.svg");
}
