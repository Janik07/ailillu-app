/** Shapes of the public ailillu.kz API, only the fields this app reads. */
export interface ApiRestaurant {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  images: string[] | null;
  logo: string | null;
  average_check: string | null;
  opening_hours: string | null;
  description: string | null;
  service_modes: string[] | null;
  service_features: Record<string, boolean> | null;
  is_draft: boolean;
  accepts_orders: boolean;
  is_visible_in_public_list: boolean;
}

export interface ApiCategory {
  id: string;
  name: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface ApiItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  images: string[] | null;
  price: string;
  is_active?: boolean;
  is_available?: boolean;
  is_deleted?: boolean;
  is_service_item?: boolean;
  hidden_for_takeaway?: boolean;
  serving_size?: number | null;
}

export interface ApiModifierGroup {
  group: { name: string };
  link: { is_required?: boolean; is_deleted?: boolean; min_amount?: number; max_amount?: number };
  members: {
    item: { id: string; name: string; price: string; is_deleted?: boolean };
    link: { is_deleted?: boolean; price_override?: string | null; default_amount?: number };
  }[];
}

export interface ApiMenuEntry {
  item: ApiItem;
  modifier_groups?: ApiModifierGroup[] | null;
}

export interface ApiTable {
  id: string;
  table_number: number;
  is_active?: boolean;
}

export interface ApiPolicy {
  payment_methods?: string[] | null;
  takeaway_enabled?: boolean;
  delivery_enabled?: boolean;
}

export interface ApiMenu {
  restaurant: ApiRestaurant;
  categories: ApiCategory[];
  items: ApiMenuEntry[];
  policy: ApiPolicy;
  tables: ApiTable[];
}
