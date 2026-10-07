"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, PageHeader, Spinner, Tabs } from "@/components/ui";
import { useAlgorithms } from "@/components/lab";
import { Battle } from "@/components/benchmark/Battle";
import { Scaling } from "@/components/benchmark/Scaling";
import { Stress } from "@/components/benchmark/Stress";
import { Recommend } from "@/components/benchmark/Recommend";

type Tab = "battle" | "scaling" | "stress" | "recommend";

function BenchmarkLab() {
  const { algorithms, categories, loading, error } = useAlgorithms();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) ?? "battle";
  return (
    <div>
      <PageHeader title="Benchmark Lab" description="Empirical performance analysis. All numbers are measured on the server at request time; theoretical complexity is shown separately. No winner is declared — interpret the data." />
      <Tabs
        tabs={[
          { id: "battle", label: "Algorithm Battle" },
          { id: "scaling", label: "Input-size Scaling" },
          { id: "stress", label: "Stress Testing" },
          { id: "recommend", label: "Recommendation" },
        ]}
        value={tab}
        onChange={(t) => router.replace(`/benchmark?tab=${t}`)}
      />
      <div className="pt-4">
        {loading && <Spinner />}
        {error && <Alert>{error}</Alert>}
        {!loading && !error && (
          <>
            {tab === "battle" && <Battle algorithms={algorithms} categories={categories} />}
            {tab === "scaling" && <Scaling algorithms={algorithms} categories={categories} />}
            {tab === "stress" && <Stress algorithms={algorithms} categories={categories} />}
            {tab === "recommend" && <Recommend />}
          </>
        )}
      </div>
    </div>
  );
}

export default function BenchmarkPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BenchmarkLab />
    </Suspense>
  );
}
