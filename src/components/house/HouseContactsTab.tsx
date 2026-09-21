"use client";

import { useState } from "react";
import { CONTACT_ROLES } from "@/lib/house";
import type { HouseContact } from "@/lib/house";

type ContactForm = {
  department: string;
  person: string;
  phone: string;
  email: string;
  notes: string;
};

const emptyContact: ContactForm = {
  department: "Maid",
  person: "",
  phone: "",
  email: "",
  notes: "",
};

export function HouseContactsTab({
  contacts,
  pending,
  onSave,
  onDelete,
}: {
  contacts: HouseContact[];
  pending: boolean;
  onSave: (form: ContactForm, editingId: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<ContactForm>(emptyContact);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [otherRole, setOtherRole] = useState("");

  function startEdit(contact: HouseContact) {
    const known = (CONTACT_ROLES as readonly string[]).includes(contact.department);
    setEditingId(contact.id);
    setForm({
      department: known ? contact.department : "Other",
      person: contact.person,
      phone: contact.phone,
      email: contact.email,
      notes: contact.notes,
    });
    setOtherRole(known ? "" : contact.department);
  }

  return (
    <section className="border border-line bg-white/50 p-5">
      <h2 className="text-lg font-bold text-ink">{editingId ? "Edit contact" : "House contacts"}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Store maid, milk, electrician, and other people tied to this property only.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            {
              ...form,
              department: form.department === "Other" ? otherRole.trim() || "Other" : form.department,
            },
            editingId,
          );
          setForm(emptyContact);
          setOtherRole("");
          setEditingId(null);
        }}
      >
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">Role</span>
          <select
            className="field"
            value={form.department}
            onChange={(e) => setForm((s) => ({ ...s, department: e.target.value }))}
          >
            {CONTACT_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        {form.department === "Other" ? (
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Other role</span>
            <input className="field" value={otherRole} onChange={(e) => setOtherRole(e.target.value)} />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">Contact person</span>
          <input className="field" value={form.person} onChange={(e) => setForm((s) => ({ ...s, person: e.target.value }))} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Phone</span>
            <input className="field" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Email</span>
            <input className="field" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">Notes</span>
          <textarea className="field min-h-20" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
        </label>
        <div className="flex gap-2">
          <button disabled={pending} className="btn-primary px-4 py-2 text-sm" type="submit">
            {editingId ? "Update contact" : "Add contact"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm"
              onClick={() => {
                setEditingId(null);
                setForm(emptyContact);
                setOtherRole("");
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {contacts.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {contacts.map((contact) => (
            <div key={contact.id} className="border border-line/70 bg-white/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{contact.department || "General"}</p>
                  <p className="text-sm text-ink-soft">{contact.person || "—"}</p>
                  {contact.phone ? <p className="text-xs text-ink-soft">Phone: {contact.phone}</p> : null}
                  {contact.email ? <p className="text-xs text-ink-soft">Email: {contact.email}</p> : null}
                  {contact.notes ? <p className="mt-1 text-xs text-ink-soft">{contact.notes}</p> : null}
                </div>
                <div className="flex gap-2 text-xs">
                  <button className="text-ink-soft hover:text-ink" onClick={() => startEdit(contact)}>
                    edit
                  </button>
                  <button className="text-coral hover:underline" onClick={() => onDelete(contact.id)}>
                    delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">No contacts added yet.</p>
      )}
    </section>
  );
}
