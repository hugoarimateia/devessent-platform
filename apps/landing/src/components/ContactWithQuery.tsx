"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Contact } from "./Contact";

export function ContactWithQuery() {
  const searchParams = useSearchParams();
  const initialService = searchParams.get("servico") ?? undefined;
  return <Contact initialService={initialService} />;
}
