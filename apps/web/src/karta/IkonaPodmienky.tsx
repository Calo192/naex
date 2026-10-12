// Ikona podmienky scorecardu (z knižnice ikon bodovania v zverejnenej sade).

import type { Podmienka } from "@naex/core";
import type { IkonaBodovania } from "@naex/tvorba";
import { mediaUrl } from "../lib/api.ts";
import { NAZOV_PODMIENKY } from "./podmienky.ts";

export function IkonaPodmienky({ podmienka, ikony }: { readonly podmienka: Podmienka; readonly ikony: readonly IkonaBodovania[] }) {
  const ik = ikony.find((i) => i.podmienka === podmienka);
  if (ik === undefined) return <span className="ikona-podmienky-text">{NAZOV_PODMIENKY[podmienka].charAt(0)}</span>;
  return <img className="ikona-podmienky" src={mediaUrl(ik.media)} alt="" draggable={false} />;
}
