'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  PROPERTY_AMENITY_KEYS,
  PROPERTY_CLASSIFICATION_KEYS,
} from '@/modules/properties/property-constants';
import type { InternalPropertyDetailDto } from '@/modules/properties/property-contracts';
import { INITIAL_PROPERTY_ACTION_STATE, type PropertyActionState } from './action-state';

interface PropertyFormProps {
  action: (state: PropertyActionState, formData: FormData) => Promise<PropertyActionState>;
  property?: InternalPropertyDetailDto;
}

export function PropertyForm({ action, property }: PropertyFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_PROPERTY_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-8">
      {property ? (
        <>
          <input type="hidden" name="propertyId" value={property.id} />
          <input type="hidden" name="expectedVersion" value={property.version} />
        </>
      ) : null}
      {state.status === 'error' ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{state.message}</p>
          {state.fieldErrors ? (
            <ul className="mt-2 list-disc pl-5">
              {Object.entries(state.fieldErrors).flatMap(([field, messages]) =>
                messages.map((message) => (
                  <li key={`${field}-${message}`}>
                    {field}: {message}
                  </li>
                )),
              )}
            </ul>
          ) : null}
        </div>
      ) : null}

      <fieldset className="grid gap-5 md:grid-cols-2">
        <legend className="mb-4 text-lg font-bold">Identitas Property</legend>
        <Field label="Nama" name="name" defaultValue={property?.name} required maxLength={120} />
        <Field label="Slug" name="slug" defaultValue={property?.slug} required maxLength={80} />
        <label className="space-y-2 text-sm font-semibold">
          Klasifikasi
          <select
            className="input-base"
            name="classificationKey"
            defaultValue={property?.classificationKey}
            required
          >
            {PROPERTY_CLASSIFICATION_KEYS.map((key) => (
              <option key={key} value={key}>
                {key.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Zona waktu IANA"
          name="timezone"
          defaultValue={property?.timezone ?? 'Asia/Jakarta'}
          required
          maxLength={100}
        />
      </fieldset>

      <fieldset className="grid gap-5 md:grid-cols-2">
        <legend className="mb-4 text-lg font-bold">Alamat Indonesia</legend>
        <Field
          label="Alamat baris 1"
          name="line1"
          defaultValue={property?.address.line1}
          required
          maxLength={200}
        />
        <Field
          label="Alamat baris 2"
          name="line2"
          defaultValue={property?.address.line2}
          maxLength={200}
        />
        <Field
          label="Kota/Kabupaten"
          name="locality"
          defaultValue={property?.address.locality}
          required
          maxLength={100}
        />
        <Field
          label="Provinsi"
          name="adminArea"
          defaultValue={property?.address.adminArea}
          required
          maxLength={100}
        />
        <Field
          label="Kode pos"
          name="postalCode"
          defaultValue={property?.address.postalCode}
          maxLength={12}
        />
        <label className="space-y-2 text-sm font-semibold">
          Negara
          <input className="input-base" name="countryCode" value="ID" readOnly />
        </label>
      </fieldset>

      <fieldset>
        <legend className="mb-4 text-lg font-bold">Fasilitas</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROPERTY_AMENITY_KEYS.map((key) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <input
                type="checkbox"
                name="amenityKeys"
                value={key}
                defaultChecked={property?.amenityKeys.includes(key)}
              />
              {key.replaceAll('_', ' ')}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-4 text-lg font-bold">Informasi publik opsional</legend>
        <label className="space-y-2 text-sm font-semibold">
          Deskripsi singkat
          <textarea
            className="input-base min-h-28"
            name="shortDescription"
            defaultValue={property?.shortDescription}
            maxLength={500}
          />
        </label>
        <Field
          label="WhatsApp publik (E.164)"
          name="publicWhatsAppE164"
          defaultValue={property?.publicWhatsAppE164}
          maxLength={16}
          placeholder="+6281234567890"
        />
      </fieldset>

      <SubmitButton label={property ? 'Simpan perubahan' : 'Buat Property'} />
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="space-y-2 text-sm font-semibold">
      {label}
      <input className="input-base" name={name} {...props} />
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
    >
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}
