import { loadFarmers } from "@/lib/db/farmers";
import { loadCatalog } from "@/lib/db/products";
import { loadStaff } from "@/lib/db/staff";
import { loadStores } from "@/lib/db/stores";

export async function refreshMasterData() {
  await Promise.all([loadCatalog(), loadStores(), loadStaff(), loadFarmers()]);
}
