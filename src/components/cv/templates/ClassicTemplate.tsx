import { SingleColumnBase } from "./SingleColumnBase";
import { TEMPLATE_PRESETS } from "../templates";
import type { TemplateShellProps } from "./types";

export function ClassicTemplate(props: TemplateShellProps) {
  const preset = TEMPLATE_PRESETS.classic;
  return <SingleColumnBase spacing={preset.spacing} flatCard={preset.flatCard} props={props} />;
}
