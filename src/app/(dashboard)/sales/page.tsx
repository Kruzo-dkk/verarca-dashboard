import { Suspense } from "react";
import { SalesProvider } from "@/components/sales/SalesProvider";
import { SalesDashboard } from "@/components/sales/SalesDashboard";

export default function SalesPage() {
  return (
    <Suspense>
      <SalesProvider>
        <SalesDashboard />
      </SalesProvider>
    </Suspense>
  );
}
