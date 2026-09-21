"use client";

import { useState } from "react";
import { PROPERTY_TYPES } from "@/lib/house";
import type { HouseProfileSummary } from "@/lib/actions/house";

export function PropertySwitcher({
  profiles,
  selectedId,
  pending,
  onSelect,
  onCreate,
  onDelete,
}: {
  profiles: HouseProfileSummary[];
  selectedId: string;
  pending: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string, propertyType: string) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState<(typeof PROPERTY_TYPES)[number]>("Apartment");

  return (
    <section className="border border-line bg-white/50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-56 flex-1">
          <span className="mb-1 block text-xs text-ink-soft">Property</span>
          <select
            className="field"
            value={selectedId}
            disabled={pending}
            onChange={(e) => onSelect(e.target.value)}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.propertyType}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary px-3 py-2 text-sm"
            disabled={pending}
            onClick={() => setAdding((open) => !open)}
          >
            {adding ? "Cancel" : "Add property"}
          </button>
          {profiles.length > 1 ? (
            <button
              type="button"
              className="px-3 py-2 text-sm text-coral hover:underline"
              disabled={pending}
              onClick={() => onDelete(selectedId)}
            >
              Delete property
            </button>
          ) : null}
        </div>
      </div>

      {adding ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(name.trim() || "New property", propertyType);
            setName("");
            setAdding(false);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">House or project name</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Green Meadows A-1203"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Type</span>
            <select
              className="field"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as (typeof PROPERTY_TYPES)[number])}
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn-primary px-4 py-2 text-sm" disabled={pending} type="submit">
              Create
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
