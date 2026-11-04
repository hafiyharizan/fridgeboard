"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Mail, MessageCircle, Plus, Settings, Trash2, Webhook, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { NotificationChannelConfig, NotifyChannel } from "@/lib/types";

const CHANNEL_META: Record<NotifyChannel, { icon: typeof Mail; label: string; placeholder: string }> = {
  email: { icon: Mail, label: "Email", placeholder: "you@example.com" },
  telegram: { icon: MessageCircle, label: "Telegram", placeholder: "Chat ID (e.g. 123456789)" },
  webhook: { icon: Webhook, label: "Webhook", placeholder: "https://hooks.example.com/notify" },
};

type NotificationSettingsProps = {
  pin: string;
};

export function NotificationSettings({ pin }: NotificationSettingsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [channels, setChannels] = useState<NotificationChannelConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add form state
  const [addType, setAddType] = useState<NotifyChannel>("email");
  const [addValue, setAddValue] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("notification_channels")
        .select("*")
        .eq("pin_code", pin)
        .order("created_at", { ascending: true });
      setChannels((data ?? []) as NotificationChannelConfig[]);
      setLoading(false);
    };

    void load();
  }, [isOpen, pin, supabase]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedValue = addValue.trim();
    if (!trimmedValue) return;

    const { data, error } = await supabase
      .from("notification_channels")
      .insert({
        pin_code: pin,
        channel_type: addType,
        channel_value: trimmedValue,
        label: addLabel.trim() || null,
      })
      .select()
      .single();

    if (!error && data) {
      setChannels((prev) => [...prev, data as NotificationChannelConfig]);
      setAddValue("");
      setAddLabel("");
      setShowAddForm(false);
    }
  };

  const handleToggle = async (channel: NotificationChannelConfig) => {
    await supabase
      .from("notification_channels")
      .update({ is_enabled: !channel.is_enabled })
      .eq("id", channel.id);

    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, is_enabled: !c.is_enabled } : c)),
    );
  };

  const handleDelete = async (channelId: string) => {
    await supabase.from("notification_channels").delete().eq("id", channelId);
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
  };

  return (
    <>
      <button
        className="rounded-full border border-border p-2 text-muted transition hover:border-amber/40 hover:text-foreground"
        onClick={() => setIsOpen(true)}
        title="Notification settings"
        type="button"
      >
        <Bell className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/95 shadow-[0_24px_64px_rgba(60,40,20,0.15)] backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                      Notification channels
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Where should we send reminders?
                    </p>
                  </div>
                </div>
                <button
                  className="rounded-full p-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Channels list */}
              <div className="max-h-64 overflow-y-auto px-5 py-3">
                {loading ? (
                  <p className="py-4 text-center text-sm text-muted">Loading...</p>
                ) : channels.length === 0 && !showAddForm ? (
                  <p className="py-4 text-center text-sm text-muted">
                    No channels configured yet. Add one to receive notifications.
                  </p>
                ) : null}

                <div className="space-y-2">
                  {channels.map((channel) => {
                    const meta = CHANNEL_META[channel.channel_type];
                    const Icon = meta.icon;
                    return (
                      <div
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                          channel.is_enabled ? "border-border bg-white" : "border-border/50 bg-foreground/3 opacity-60"
                        }`}
                        key={channel.id}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {channel.label || channel.channel_value}
                          </p>
                          {channel.label ? (
                            <p className="truncate text-xs text-muted">{channel.channel_value}</p>
                          ) : null}
                        </div>
                        <button
                          className={`rounded-full px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wider transition ${
                            channel.is_enabled
                              ? "bg-success/15 text-[#4a6e3f]"
                              : "bg-foreground/5 text-muted"
                          }`}
                          onClick={() => handleToggle(channel)}
                          type="button"
                        >
                          {channel.is_enabled ? "On" : "Off"}
                        </button>
                        <button
                          className="rounded-full p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"
                          onClick={() => handleDelete(channel.id)}
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add form */}
                <AnimatePresence>
                  {showAddForm ? (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-3 overflow-hidden"
                      onSubmit={handleAdd}
                    >
                      {/* Channel type */}
                      <div className="flex gap-2">
                        {(Object.keys(CHANNEL_META) as NotifyChannel[]).map((type) => {
                          const meta = CHANNEL_META[type];
                          const Icon = meta.icon;
                          return (
                            <button
                              className={`flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold transition ${
                                addType === type
                                  ? "border-amber/50 bg-amber/15 text-foreground"
                                  : "border-border bg-white text-muted hover:border-amber/30"
                              }`}
                              key={type}
                              onClick={() => setAddType(type)}
                              type="button"
                            >
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>

                      <input
                        autoFocus
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/55 focus:border-amber-deep focus:ring-4 focus:ring-amber/20"
                        onChange={(e) => setAddValue(e.target.value)}
                        placeholder={CHANNEL_META[addType].placeholder}
                        value={addValue}
                      />

                      <input
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/55 focus:border-amber-deep focus:ring-4 focus:ring-amber/20"
                        onChange={(e) => setAddLabel(e.target.value)}
                        placeholder="Label (optional, e.g. Mom's email)"
                        value={addLabel}
                      />

                      <div className="flex gap-2">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                          disabled={!addValue.trim()}
                          type="submit"
                        >
                          Save channel
                        </motion.button>
                        <button
                          className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-muted transition hover:bg-foreground/5"
                          onClick={() => setShowAddForm(false)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.form>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Footer */}
              {!showAddForm ? (
                <div className="border-t border-border px-5 py-3">
                  <button
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs font-bold text-muted transition hover:border-amber/40 hover:text-foreground"
                    onClick={() => setShowAddForm(true)}
                    type="button"
                  >
                    <Plus className="h-3 w-3" />
                    Add channel
                  </button>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
