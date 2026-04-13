import { Suspense } from "react";
import { DataQualityProvider } from "@/components/data-quality/DataQualityProvider";
import { DataQualityDashboard } from "@/components/data-quality/DataQualityDashboard";

export default function DataQualityPage() {
  return (
    <Suspense>
      <DataQualityProvider>
        <DataQualityDashboard />
      </DataQualityProvider>
    </Suspense>
  );
}
