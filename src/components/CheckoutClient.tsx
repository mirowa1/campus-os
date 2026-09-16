"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaywallModal } from "@/components/PaywallModal";

/** Opens Pro plan selection immediately after upgrade-intent signup. */
export function CheckoutClient() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <PaywallModal
      open={open}
      feature="settings"
      onClose={() => {
        setOpen(false);
        router.push("/settings");
      }}
    />
  );
}
