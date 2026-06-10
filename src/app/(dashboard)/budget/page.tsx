import { BudgetGrid } from "@/components/budget/BudgetGrid";
import { MonthlyNarrative } from "@/components/budget/MonthlyNarrative";

export default function BudgetPage() {
  return (
    <div className="p-4 sm:p-6 space-y-10">
      <BudgetGrid />
      <MonthlyNarrative />
    </div>
  );
}
