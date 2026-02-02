import type { Key } from "react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Tabs, Tab } from "@heroui/tabs";
import type { CrmTypes } from "~/types/crm";

type CrmTabsProps = {
  crmType: CrmTypes;
};

const crmLabels: Record<CrmTypes, string> = {
  commerce7: "Commerce7",
  shopify: "Shopify (coming soon)",
};

const crmOptions: CrmTypes[] = ["commerce7", "shopify"];

const setClientPreference = (crmType: CrmTypes) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("crm-preference", crmType);
};

export default function CrmTabs({ crmType }: CrmTabsProps) {
  const fetcher = useFetcher();
  const [selected, setSelected] = useState<CrmTypes>(crmType);

  useEffect(() => {
    setSelected(crmType);
  }, [crmType]);

  const handleSelect = (key: Key) => {
    if (key !== "commerce7" && key !== "shopify") return;
    if (key === selected) return;
    setSelected(key);
    setClientPreference(key);

    const formData = new FormData();
    formData.set("crm", key);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-4">
        <Tabs
          selectedKey={selected}
          onSelectionChange={handleSelect}
          variant="solid"
          color="primary"
          radius="full"
          disabledKeys={["shopify"]}
        >
          {crmOptions.map((option) => (
            <Tab key={option} title={crmLabels[option]} />
          ))}
        </Tabs>
      </div>
    </div>
  );
}
