export type Retailer = {
  id: string; name: string; website: string; kind: "store" | "marketplace";
  integration_type: "manual" | "csv" | "xml" | "json" | "api";
  enabled: boolean;
};
export type Offer = {
  id: string; title: string; description: string | null; category: string;
  condition: "new" | "used"; price: number; currency: string; product_url: string;
  image_url: string | null; retailer_id: string; retailer_name?: string;
  last_checked_at: string | null; verified: boolean; sponsored: boolean;
};
