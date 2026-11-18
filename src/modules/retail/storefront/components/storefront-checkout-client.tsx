"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";
import type { PublicStorefront, StorefrontTemplate } from "../../types/retail.types";
import { submitPublicOrderAction } from "../../actions/retail-cart.actions";
import { formatCurrency } from "./currency-formatter";
import { ProductImageFallback } from "./product-image-fallback";
import { useStorefrontCart } from "./storefront-cart-provider";

interface StorefrontCheckoutClientProps {
  store: PublicStorefront;
  template: StorefrontTemplate;
  previewTemplate?: StorefrontTemplate;
}

export function StorefrontCheckoutClient({
  store,
  template,
  previewTemplate,
}: StorefrontCheckoutClientProps) {
  const router = useRouter();
  const { cart, refreshCart } = useStorefrontCart();
  const queryParam = previewTemplate ? `?preview_template=${previewTemplate}` : "";
  const isExperimental = template === "experimental";

  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [deliveryMode, setDeliveryMode] = React.useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [idempotencyKey] = React.useState(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `ord_${crypto.randomUUID()}`;
    }
    return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  });

  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const items = cart?.items || [];
  const subtotalCents = cart?.subtotalCents || 0;
  const hasUnavailable = cart?.hasUnavailableItems || false;

  const validateSingleField = (field: string, value: string, mode = deliveryMode): string | null => {
    if (field === "customerName") {
      return value.trim().length < 2 ? "Informe seu nome completo (mínimo 2 caracteres)." : null;
    }
    if (field === "customerPhone") {
      return value.replace(/\D/g, "").length < 10
        ? "Informe telefone/WhatsApp válido com DDD (mínimo 10 dígitos)."
        : null;
    }
    if (field === "customerEmail") {
      if (!value.trim()) return null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : "Informe um e-mail válido.";
    }
    if (field === "deliveryAddress") {
      if (mode !== "delivery") return null;
      return value.trim().length < 6
        ? "Para entrega, informe o endereço completo (rua, número, bairro/cidade)."
        : null;
    }
    return null;
  };

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateSingleField(field, value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const handleInputChange = (
    field: string,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    setter(value);
    if (fieldErrors[field]) {
      const err = validateSingleField(field, value);
      if (!err) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const nextErrors: Record<string, string> = {};
    const fieldsToCheck: Array<[string, string]> = [
      ["customerName", customerName],
      ["customerPhone", customerPhone],
      ["customerEmail", customerEmail],
      ["deliveryAddress", deliveryAddress],
    ];

    for (const [f, val] of fieldsToCheck) {
      const err = validateSingleField(f, val);
      if (err) nextErrors[f] = err;
    }

    if (Object.keys(nextErrors).length > 0) {
      setTouched({
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        deliveryAddress: true,
      });
      setFieldErrors(nextErrors);
      setFormError("Revise os campos destacados antes de enviar sua solicitação.");
      const firstKey = Object.keys(nextErrors)[0];
      const firstEl = document.getElementById(`checkout-${firstKey}`);
      firstEl?.focus();
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await submitPublicOrderAction(store.slug, previewTemplate, {
        customerName,
        customerPhone,
        customerEmail,
        deliveryMode,
        deliveryAddress,
        notes,
        idempotencyKey,
      });

      if (!res.success || !res.redirectUrl) {
        setFormError(res.error || "Não foi possível enviar sua solicitação de pedido.");
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        await refreshCart();
        setIsSubmitting(false);
        return;
      }

      await refreshCart();
      router.push(res.redirectUrl);
    } catch {
      setFormError("Erro inesperado ao registrar seu pedido. Tente novamente em instantes.");
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div
        className={`py-20 px-4 sm:px-6 ${
          isExperimental ? "bg-[#0a0a0c] text-neutral-100" : "bg-[#faf9f6] text-stone-900"
        }`}
      >
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <ShoppingBag
            className={`w-12 h-12 mx-auto opacity-30 ${
              isExperimental ? "text-[#d4ff00]" : "text-stone-700"
            }`}
            aria-hidden="true"
          />
          <h1
            className={`text-2xl font-black uppercase tracking-wider ${
              isExperimental ? "font-mono text-white" : "font-display text-stone-950"
            }`}
          >
            Sua sacola está vazia
          </h1>
          <p className={`text-sm ${isExperimental ? "text-neutral-400" : "text-stone-600"}`}>
            Adicione produtos ao carrinho na vitrine de {store.storeName} antes de finalizar sua solicitação de pedido.
          </p>
          <Link
            href={`/loja/${store.slug}/produtos${queryParam}`}
            className={`inline-flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-[2px] ${
              isExperimental
                ? "bg-[#d4ff00] text-black hover:bg-[#c5ee00] font-mono"
                : "bg-stone-950 text-white hover:bg-stone-800"
            }`}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Voltar para o Catálogo</span>
          </Link>
        </div>
      </div>
    );
  }

  const inputBaseClass = isExperimental
    ? "w-full min-h-[48px] px-3.5 py-2.5 text-sm bg-[#141418] text-white border border-neutral-700 rounded-[2px] focus:outline-none focus:border-[#d4ff00] placeholder:text-neutral-500"
    : "w-full min-h-[48px] px-3.5 py-2.5 text-sm bg-white text-stone-950 border border-stone-300 rounded-[2px] focus:outline-none focus:border-stone-950 placeholder:text-stone-400";

  const labelClass = isExperimental
    ? "block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1.5"
    : "block text-xs font-semibold uppercase tracking-wider text-stone-800 mb-1.5";

  return (
    <div
      className={`py-10 px-4 sm:px-6 ${
        isExperimental ? "bg-[#0a0a0c] text-neutral-100" : "bg-[#faf9f6] text-stone-900"
      }`}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={`/loja/${store.slug}/produtos${queryParam}`}
              className={`inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider mb-3 ${
                isExperimental
                  ? "text-neutral-400 hover:text-[#d4ff00]"
                  : "text-stone-500 hover:text-stone-950"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Continuar escolhendo</span>
            </Link>
            <h1
              className={`text-2xl sm:text-3xl font-black uppercase tracking-tight ${
                isExperimental ? "font-mono text-white" : "font-display text-stone-950"
              }`}
            >
              Solicitação de Pedido
            </h1>
            <p className={`text-xs sm:text-sm mt-1 ${isExperimental ? "text-neutral-400" : "text-stone-600"}`}>
              Sem pagamento online neste momento. Seu pedido será registrado para confirmação da loja.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Formulário */}
          <div className="lg:col-span-7">
            <form
              onSubmit={handleSubmit}
              noValidate
              aria-labelledby="checkout-form-heading"
              className={`p-6 sm:p-8 rounded-[2px] border space-y-6 ${
                isExperimental
                  ? "bg-[#111115] border-neutral-800"
                  : "bg-white border-stone-200 shadow-xs"
              }`}
            >
              <h2
                id="checkout-form-heading"
                className={`text-sm font-bold uppercase tracking-wider pb-3 border-b ${
                  isExperimental
                    ? "font-mono text-[#d4ff00] border-neutral-800"
                    : "text-stone-950 border-stone-200"
                }`}
              >
                Dados do Solicitante e Entrega
              </h2>

              {formError && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`p-3.5 rounded-[2px] border text-xs flex items-start gap-2.5 ${
                    isExperimental
                      ? "bg-rose-950/50 border-rose-800 text-rose-200"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="checkout-customerName" className={labelClass}>
                    Nome completo <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="checkout-customerName"
                    name="customerName"
                    type="text"
                    required
                    autoComplete="name"
                    enterKeyHint="next"
                    value={customerName}
                    onChange={(e) => handleInputChange("customerName", e.target.value, setCustomerName)}
                    onBlur={(e) => handleBlur("customerName", e.target.value)}
                    aria-invalid={Boolean(touched.customerName && fieldErrors.customerName)}
                    aria-describedby={
                      touched.customerName && fieldErrors.customerName
                        ? "error-customerName"
                        : undefined
                    }
                    placeholder="Ex.: Mariana Silva"
                    className={inputBaseClass}
                  />
                  {touched.customerName && fieldErrors.customerName && (
                    <p id="error-customerName" className="text-xs text-rose-500 mt-1.5">
                      {fieldErrors.customerName}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="checkout-customerPhone" className={labelClass}>
                      Telefone / WhatsApp <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="checkout-customerPhone"
                      name="customerPhone"
                      type="tel"
                      inputMode="tel"
                      required
                      autoComplete="tel"
                      enterKeyHint="next"
                      value={customerPhone}
                      onChange={(e) =>
                        handleInputChange("customerPhone", e.target.value, setCustomerPhone)
                      }
                      onBlur={(e) => handleBlur("customerPhone", e.target.value)}
                      aria-invalid={Boolean(touched.customerPhone && fieldErrors.customerPhone)}
                      aria-describedby={
                        touched.customerPhone && fieldErrors.customerPhone
                          ? "error-customerPhone"
                          : undefined
                      }
                      placeholder="(11) 99999-9999"
                      className={inputBaseClass}
                    />
                    {touched.customerPhone && fieldErrors.customerPhone && (
                      <p id="error-customerPhone" className="text-xs text-rose-500 mt-1.5">
                        {fieldErrors.customerPhone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="checkout-customerEmail" className={labelClass}>
                      E-mail <span className="opacity-60 font-normal">(opcional)</span>
                    </label>
                    <input
                      id="checkout-customerEmail"
                      name="customerEmail"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      enterKeyHint="next"
                      value={customerEmail}
                      onChange={(e) =>
                        handleInputChange("customerEmail", e.target.value, setCustomerEmail)
                      }
                      onBlur={(e) => handleBlur("customerEmail", e.target.value)}
                      aria-invalid={Boolean(touched.customerEmail && fieldErrors.customerEmail)}
                      aria-describedby={
                        touched.customerEmail && fieldErrors.customerEmail
                          ? "error-customerEmail"
                          : undefined
                      }
                      placeholder="voce@exemplo.com"
                      className={inputBaseClass}
                    />
                    {touched.customerEmail && fieldErrors.customerEmail && (
                      <p id="error-customerEmail" className="text-xs text-rose-500 mt-1.5">
                        {fieldErrors.customerEmail}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modalidade de recebimento */}
              <fieldset className="space-y-3 pt-2">
                <legend className={labelClass}>
                  Modalidade de recebimento <span aria-hidden="true">*</span>
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    htmlFor="mode-pickup"
                    className={`flex items-start gap-3 p-4 rounded-[2px] border cursor-pointer transition-all ${
                      deliveryMode === "pickup"
                        ? isExperimental
                          ? "border-[#d4ff00] bg-[#d4ff00]/10 text-white"
                          : "border-stone-950 bg-stone-50 text-stone-950"
                        : isExperimental
                          ? "border-neutral-800 bg-[#141418] text-neutral-300"
                          : "border-stone-200 bg-white text-stone-700"
                    }`}
                  >
                    <input
                      id="mode-pickup"
                      type="radio"
                      name="deliveryMode"
                      value="pickup"
                      checked={deliveryMode === "pickup"}
                      onChange={() => {
                        setDeliveryMode("pickup");
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.deliveryAddress;
                          return next;
                        });
                      }}
                      className="mt-0.5 accent-current"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold flex items-center gap-1.5">
                        <PackageCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        Retirar na loja
                      </span>
                      <span className="block opacity-75">
                        Combine o horário de retirada diretamente após confirmação.
                      </span>
                    </div>
                  </label>

                  <label
                    htmlFor="mode-delivery"
                    className={`flex items-start gap-3 p-4 rounded-[2px] border cursor-pointer transition-all ${
                      deliveryMode === "delivery"
                        ? isExperimental
                          ? "border-[#d4ff00] bg-[#d4ff00]/10 text-white"
                          : "border-stone-950 bg-stone-50 text-stone-950"
                        : isExperimental
                          ? "border-neutral-800 bg-[#141418] text-neutral-300"
                          : "border-stone-200 bg-white text-stone-700"
                    }`}
                  >
                    <input
                      id="mode-delivery"
                      type="radio"
                      name="deliveryMode"
                      value="delivery"
                      checked={deliveryMode === "delivery"}
                      onChange={() => setDeliveryMode("delivery")}
                      className="mt-0.5 accent-current"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        Entrega / Envio
                      </span>
                      <span className="block opacity-75">
                        Frete e prazo serão combinados pela loja na confirmação.
                      </span>
                    </div>
                  </label>
                </div>
              </fieldset>

              {deliveryMode === "delivery" && (
                <div>
                  <label htmlFor="checkout-deliveryAddress" className={labelClass}>
                    Endereço de entrega <span aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="checkout-deliveryAddress"
                    name="deliveryAddress"
                    rows={3}
                    required
                    autoComplete="street-address"
                    value={deliveryAddress}
                    onChange={(e) =>
                      handleInputChange("deliveryAddress", e.target.value, setDeliveryAddress)
                    }
                    onBlur={(e) => handleBlur("deliveryAddress", e.target.value)}
                    aria-invalid={Boolean(touched.deliveryAddress && fieldErrors.deliveryAddress)}
                    aria-describedby={
                      touched.deliveryAddress && fieldErrors.deliveryAddress
                        ? "error-deliveryAddress"
                        : undefined
                    }
                    placeholder="Rua, número, complemento, bairro, cidade e CEP"
                    className={`${inputBaseClass} min-h-[84px]`}
                  />
                  {touched.deliveryAddress && fieldErrors.deliveryAddress && (
                    <p id="error-deliveryAddress" className="text-xs text-rose-500 mt-1.5">
                      {fieldErrors.deliveryAddress}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="checkout-notes" className={labelClass}>
                  Observações para a loja <span className="opacity-60 font-normal">(opcional)</span>
                </label>
                <textarea
                  id="checkout-notes"
                  name="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferência de horário, recado ou dúvida sobre medidas..."
                  className={`${inputBaseClass} min-h-[72px]`}
                />
              </div>

              <div
                className={`p-3.5 rounded-[2px] border text-xs flex items-start gap-2.5 ${
                  isExperimental
                    ? "bg-[#141418] border-neutral-800 text-neutral-300"
                    : "bg-stone-50 border-stone-200 text-stone-700"
                }`}
              >
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    isExperimental ? "text-[#d4ff00]" : "text-stone-700"
                  }`}
                  aria-hidden="true"
                />
                <span>
                  Este envio registra uma <strong>solicitação de pedido</strong>. O estoque é reservado após a confirmação da equipe da loja e o pagamento é combinado diretamente no atendimento.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || hasUnavailable}
                data-testid="submit-order-request"
                className={`w-full min-h-[48px] px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-[2px] flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                  isExperimental
                    ? "bg-[#d4ff00] text-black hover:bg-[#c5ee00] font-mono shadow-[0_0_20px_rgba(212,255,0,0.25)]"
                    : "bg-stone-950 text-white hover:bg-stone-800"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isSubmitting
                    ? "Registrando solicitação..."
                    : "Enviar Solicitação de Pedido"}
                </span>
              </button>
            </form>
          </div>

          {/* Resumo da Sacola */}
          <aside className="lg:col-span-5">
            <div
              className={`p-6 rounded-[2px] border space-y-5 ${
                isExperimental
                  ? "bg-[#111115] border-neutral-800"
                  : "bg-white border-stone-200 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-current/10">
                <h2
                  className={`text-sm font-bold uppercase tracking-wider ${
                    isExperimental ? "font-mono text-white" : "text-stone-950"
                  }`}
                >
                  Resumo do Pedido ({cart?.itemCount || 0})
                </h2>
              </div>

              <ul className="space-y-3.5">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 text-xs">
                    <div
                      className={`w-14 h-16 shrink-0 overflow-hidden rounded-[2px] border ${
                        isExperimental
                          ? "border-neutral-800 bg-[#141418]"
                          : "border-stone-200 bg-[#f1efe9]"
                      }`}
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ProductImageFallback
                          name={item.productName}
                          template={template}
                          className="w-full h-full"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold truncate ${
                          isExperimental ? "text-white font-mono" : "text-stone-950"
                        }`}
                      >
                        {item.productName}
                      </p>
                      <p className={isExperimental ? "text-neutral-400" : "text-stone-500"}>
                        {item.variantName} · Qtd {item.quantity}
                      </p>
                      {item.availabilityIssue && (
                        <p className="text-rose-500 font-medium mt-0.5">{item.availabilityIssue}</p>
                      )}
                    </div>
                    <span
                      className={`font-mono font-bold tabular-nums shrink-0 ${
                        isExperimental ? "text-[#d4ff00]" : "text-stone-950"
                      }`}
                    >
                      {formatCurrency(item.lineTotalCents, store.currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <div
                className={`pt-4 border-t space-y-2 ${
                  isExperimental ? "border-neutral-800" : "border-stone-200"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={isExperimental ? "text-neutral-400" : "text-stone-600"}>
                    Subtotal dos itens
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(subtotalCents, store.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={isExperimental ? "text-neutral-400" : "text-stone-600"}>
                    Pagamento & Entrega
                  </span>
                  <span className={isExperimental ? "text-neutral-300" : "text-stone-700"}>
                    A combinar na confirmação
                  </span>
                </div>
                <div
                  className={`pt-3 border-t flex items-center justify-between ${
                    isExperimental ? "border-neutral-800" : "border-stone-200"
                  }`}
                >
                  <span
                    className={`text-sm font-bold uppercase ${
                      isExperimental ? "font-mono text-white" : "text-stone-950"
                    }`}
                  >
                    Total Solicitado
                  </span>
                  <span
                    className={`text-xl font-mono font-bold tabular-nums ${
                      isExperimental ? "text-[#d4ff00]" : "text-stone-950"
                    }`}
                  >
                    {formatCurrency(subtotalCents, store.currency)}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
