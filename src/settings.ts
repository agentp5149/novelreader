import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_SETTINGS, type Settings } from "./db";

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<void>] {
  const settings = useLiveQuery(() => db.settings.get("settings")) ?? DEFAULT_SETTINGS;
  const update = async (patch: Partial<Settings>) => {
    await db.settings.put({ ...settings, ...patch, key: "settings" });
  };
  return [settings, update];
}
