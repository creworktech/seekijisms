import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Modal from './Modal';
import { notifySuccess, notifyError } from '../../utils/toast';
import { LOGISTICS_API } from '../../utils/logistics';

const MAX_PHOTOS = 2;

function PhotoPicker({ label, hint, files, onChange, error }) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    onChange([...files, ...incoming].slice(0, MAX_PHOTOS));
  };

  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">{label}</label>
      {hint && <p className="mb-1.5 text-[10px] text-[#999999]">{hint}</p>}

      <div className="flex flex-wrap gap-2">
        {files.map((file, idx) => (
          <div key={idx} className="relative h-20 w-20 overflow-hidden rounded-lg border border-[#E5E5E5]">
            <img src={previews[idx]} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, i) => i !== idx))}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white cursor-pointer"
              aria-label="Remove photo"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
        ))}

        {files.length < MAX_PHOTOS && (
          <label
            className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[#999999] hover:border-[#005EA4] hover:text-[#005EA4] ${
              error ? 'border-[#D03B3B]' : 'border-[#C9C9C9]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">add_a_photo</span>
            <span className="text-[9px] font-semibold">{files.length}/{MAX_PHOTOS}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{error}</p>}
    </div>
  );
}

const emptyForm = {
  sender_id: '',
  receiver_id: '',
  from_stop_id: '',
  to_stop_id: '',
  quantity: '1',
  driver_mobile: '',
  bus_reach_time: '',
};

export default function CreateDispatchModal({ isOpen, onClose, onSuccess, logisticsUsers = [], stopsByLocation = {} }) {
  const [form, setForm] = useState(emptyForm);
  const [busPhotos, setBusPhotos] = useState([]);
  const [packagePhotos, setPackagePhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm);
      setBusPhotos([]);
      setPackagePhotos([]);
      setErrors({});
    }
  }, [isOpen]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  const sender = logisticsUsers.find((u) => String(u.id) === String(form.sender_id));
  const receiver = logisticsUsers.find((u) => String(u.id) === String(form.receiver_id));

  // Rule 2/3: a spoke sender may only pick the hub; a hub sender may only
  // pick an active spoke — mirrors what the server independently enforces.
  const eligibleReceivers = useMemo(() => {
    if (!sender) return [];
    return logisticsUsers.filter((u) => {
      if (u.id === sender.id) return false;
      return sender.is_central ? !u.is_central : u.is_central;
    });
  }, [sender, logisticsUsers]);

  useEffect(() => {
    if (form.receiver_id && !eligibleReceivers.some((u) => String(u.id) === String(form.receiver_id))) {
      set('receiver_id', '');
      set('to_stop_id', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.sender_id]);

  const fromStops = sender ? stopsByLocation[sender.location_id] || [] : [];
  const toStops = receiver ? stopsByLocation[receiver.location_id] || [] : [];

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!form.sender_id) newErrors.sender_id = 'Choose who is sending this.';
    if (!form.receiver_id) newErrors.receiver_id = 'Choose who is receiving this.';
    if (!form.from_stop_id) newErrors.from_stop_id = "Choose the sender's stop.";
    if (!form.to_stop_id) newErrors.to_stop_id = "Choose the receiver's stop.";
    if (!form.quantity || Number(form.quantity) < 1) newErrors.quantity = 'Quantity must be at least 1.';
    if (!/^\d{10}$/.test(form.driver_mobile)) newErrors.driver_mobile = 'Enter a 10 digit mobile number.';
    if (!form.bus_reach_time) newErrors.bus_reach_time = 'Enter when the bus arrived.';
    if (busPhotos.length === 0) newErrors.bus_photos = 'Add at least one bus photo.';
    if (packagePhotos.length === 0) newErrors.package_photos = 'Add at least one package photo.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    busPhotos.forEach((f) => payload.append('bus_photos[]', f));
    packagePhotos.forEach((f) => payload.append('package_photos[]', f));

    try {
      const res = await axios.post(`${LOGISTICS_API}/dispatches`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notifySuccess(res.data?.message || 'Dispatch created.');
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setErrors(Object.fromEntries(Object.entries(err.response.data.errors).map(([k, v]) => [k, v[0]])));
      }
      notifyError(err.response?.data?.message || 'Could not create the dispatch.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectClass = (field) =>
    `w-full rounded-md border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4] ${
      errors[field] ? 'border-[#D03B3B]' : 'border-[#E5E5E5]'
    }`;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="New Dispatch"
      subtitle="Create a dispatch on behalf of a sender who can't use the mobile app."
      width="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#666666] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-dispatch-form"
            disabled={submitting}
            className="rounded-md bg-[#005EA4] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Creating…' : 'Create Dispatch'}
          </button>
        </>
      }
    >
      <form id="create-dispatch-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">Sender *</label>
            <select value={form.sender_id} onChange={(e) => set('sender_id', e.target.value)} className={selectClass('sender_id')}>
              <option value="">Select sender</option>
              {logisticsUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.location_name}
                </option>
              ))}
            </select>
            {errors.sender_id && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{errors.sender_id}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">Receiver *</label>
            <select
              value={form.receiver_id}
              onChange={(e) => set('receiver_id', e.target.value)}
              disabled={!sender}
              className={selectClass('receiver_id')}
            >
              <option value="">{sender ? 'Select receiver' : 'Choose a sender first'}</option>
              {eligibleReceivers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.location_name}
                </option>
              ))}
            </select>
            {errors.receiver_id && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{errors.receiver_id}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">From Stop *</label>
            <select
              value={form.from_stop_id}
              onChange={(e) => set('from_stop_id', e.target.value)}
              disabled={!sender}
              className={selectClass('from_stop_id')}
            >
              <option value="">{sender ? 'Select pickup stop' : 'Choose a sender first'}</option>
              {fromStops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.from_stop_id && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{errors.from_stop_id}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">To Stop *</label>
            <select
              value={form.to_stop_id}
              onChange={(e) => set('to_stop_id', e.target.value)}
              disabled={!receiver}
              className={selectClass('to_stop_id')}
            >
              <option value="">{receiver ? 'Select drop stop' : 'Choose a receiver first'}</option>
              {toStops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.to_stop_id && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{errors.to_stop_id}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">Quantity *</label>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value.replace(/\D/g, ''))}
              className={selectClass('quantity')}
            />
            {errors.quantity && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{errors.quantity}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">Contact No *</label>
            <input
              type="text"
              value={form.driver_mobile}
              onChange={(e) => set('driver_mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10 digit mobile"
              className={selectClass('driver_mobile')}
            />
            {errors.driver_mobile && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{errors.driver_mobile}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">Bus In Time *</label>
            <input
              type="time"
              value={form.bus_reach_time}
              onChange={(e) => set('bus_reach_time', e.target.value)}
              className={selectClass('bus_reach_time')}
            />
            {errors.bus_reach_time && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{errors.bus_reach_time}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#E5E5E5] pt-3">
          <PhotoPicker
            label="Bus Photos *"
            hint="Bus and number plate."
            files={busPhotos}
            onChange={setBusPhotos}
            error={errors.bus_photos}
          />
          <PhotoPicker
            label="Package Photos *"
            hint="Package label & contents."
            files={packagePhotos}
            onChange={setPackagePhotos}
            error={errors.package_photos}
          />
        </div>
      </form>
    </Modal>
  );
}
