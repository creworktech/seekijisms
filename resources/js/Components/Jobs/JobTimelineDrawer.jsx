import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { formatDateTime, STAGES } from '../../utils/formatters';

export default function JobTimelineDrawer({ job, isOpen, onClose, sanctumToken }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (job && isOpen) {
      fetchTimelineEvents();
    }
  }, [job, isOpen]);

  const fetchTimelineEvents = async () => {
    setLoading(true);
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.get(`/api/v1/jobs/${job.id}/events`, { headers });
      setEvents(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !job) return null;

  // Deduplicate identical event log entries
  const uniqueEvents = events.reduce((acc, current) => {
    const isDuplicate = acc.some(
      (item) =>
        item.action === current.action &&
        item.to_stage === current.to_stage &&
        item.from_stage === current.from_stage &&
        item.note === current.note
    );
    if (!isDuplicate) {
      acc.push(current);
    }
    return acc;
  }, []);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm">
        
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-lg bg-white border-l border-[#E5E5E5] h-full flex flex-col shadow-2xl text-[#0B0B0B] overflow-hidden"
        >
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#E5E5E5] flex items-center justify-between bg-[#f9f9f7]">
            <div>
              <h3 className="font-bold text-lg text-[#0B0B0B]">
                Job Audit History Timeline
              </h3>
              <p className="text-xs sk-tok mt-0.5">
                #{job.token_no} • {job.product_name}
              </p>
            </div>
            <button onClick={onClose} className="text-[#666666] hover:text-[#0B0B0B] p-1 rounded-lg">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Timeline Events List */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 thin-sb">
            {loading ? (
              <div className="py-8 text-center text-xs text-[#666666]">
                Loading audit timeline...
              </div>
            ) : uniqueEvents.length > 0 ? (
              <div className="relative ml-4 pl-6 border-l-2 border-[#E5E5E5] space-y-6">
                {uniqueEvents.map((event) => {
                  const fromStageConfig = STAGES[event.from_stage] || STAGES.new;
                  const toStageConfig = STAGES[event.to_stage] || STAGES.delivered;

                  return (
                    <div key={event.id} className="relative group">
                      
                      {/* Timeline Dot */}
                      <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-[#005ea4] border-2 border-white group-hover:scale-125 transition-transform" />

                      <div className="p-4 rounded-xl bg-white border border-[#E5E5E5] space-y-2 shadow-sm">
                        {/* Header line: User & Timestamp */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-[#0B0B0B] font-bold">
                            <div className="w-6 h-6 rounded-full bg-[#005ea4] text-white font-bold flex items-center justify-center text-[10px]">
                              {event.user?.name ? event.user.name.charAt(0) : 'U'}
                            </div>
                            <span>{event.user?.name || 'System'}</span>
                          </div>
                          <span className="text-[11px] text-[#666666] font-mono">
                            {formatDateTime(event.created_at)}
                          </span>
                        </div>

                        {/* Action Title */}
                        <p className="text-xs font-bold text-[#005ea4] uppercase tracking-wider">
                          Action: {event.action?.replace('_', ' ')}
                        </p>

                        {/* Stage Badges Transition */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="sk-pill" style={{ background: fromStageConfig.pbg, color: fromStageConfig.ptx }}>
                            {fromStageConfig.label}
                          </span>
                          <span className="material-symbols-outlined text-sm text-[#717783]">arrow_forward</span>
                          <span className="sk-pill" style={{ background: toStageConfig.pbg, color: toStageConfig.ptx }}>
                            {toStageConfig.label}
                          </span>
                        </div>

                        {/* Note */}
                        {event.note && (
                          <p className="text-xs text-[#666666] pt-2 border-t border-[#E5E5E5] italic">
                            "{event.note}"
                          </p>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#f4f4f2] border border-[#E5E5E5] text-center text-[#666666] text-xs">
                No timeline audit logs recorded for this job.
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </AnimatePresence>
  );
}
