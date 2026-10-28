/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, X, Shield, Zap, Sparkles, CreditCard, Crown, Lock, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { SubscriptionPlan, SubscriptionPlanId, UserSubscription } from '../types';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: UserSubscription;
  onUpdateSubscription: (sub: UserSubscription) => void;
}

const PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free Creator',
    monthlyPrice: 0,
    yearlyPrice: 0,
    tagline: 'For bedroom producers testing out visuals',
    watermarkFree: false,
    maxResolution: '1080p',
    maxFps: 30,
    spotifyCanvasReady: true,
    commercialLicense: false,
    features: [
      'Spinning Vinyl & CD video preview',
      'Download with watermark branding',
      'Standard 1080p export (30 FPS)',
      'Basic audio reactive visualizers',
      'Spotify Canvas preview',
      'Delay & BPM calculator utilities',
    ],
  },
  {
    id: 'creator-pro',
    name: 'Creator Pro',
    monthlyPrice: 9,
    yearlyPrice: 7,
    tagline: 'For independent artists releasing singles & albums',
    watermarkFree: true,
    maxResolution: '4K',
    maxFps: 60,
    spotifyCanvasReady: true,
    commercialLicense: true,
    features: [
      'No watermark on any export (100% clean)',
      'High-bitrate 4K & 60 FPS video export',
      'Spotify Canvas ready-to-upload (9:16 loop)',
      'Custom artist logo stamping (optional)',
      'All Vinyl colors, marbling & holographic sheen',
      'Electronic Press Kit (EPK) generator + private links',
      'Full commercial release rights for DSPs',
    ],
  },
  {
    id: 'label-studio',
    name: 'Label & Studio',
    monthlyPrice: 24,
    yearlyPrice: 19,
    tagline: 'For record labels, managers & promo agencies',
    watermarkFree: true,
    maxResolution: '4K',
    maxFps: 60,
    spotifyCanvasReady: true,
    commercialLicense: true,
    features: [
      'Everything in Creator Pro',
      'Zero watermark on all team member exports',
      'Batch queue export (up to 20 tracks at once)',
      'Custom white-label EPK domain & A&R demo links',
      'Priority GPU rendering pipeline',
      '5 Studio seats included',
      'Direct priority artist support',
    ],
  },
];

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  subscription,
  onUpdateSubscription,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(PLANS[1]);
  const [couponInput, setCouponInput] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleOpenCheckout = (plan: SubscriptionPlan) => {
    if (plan.id === 'free') {
      onUpdateSubscription({
        planId: 'free',
        status: 'free',
      });
      onClose();
      return;
    }
    setSelectedPlan(plan);
    setIsCheckoutOpen(true);
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (code === 'ARTIST100' || code === 'FREEPRO') {
      setDiscountPercent(100);
      setCouponError('');
    } else if (code === 'MUSIC50' || code === 'PROMO50') {
      setDiscountPercent(50);
      setCouponError('');
    } else {
      setCouponError('Invalid coupon code. Try ARTIST100 or MUSIC50');
    }
  };

  const handleCompletePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onUpdateSubscription({
        planId: selectedPlan.id,
        status: 'active',
        renewsOn: 'Next month',
        couponCode: couponInput ? couponInput.toUpperCase() : undefined,
      });
      setIsCheckoutOpen(false);

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#fbbf24', '#ffffff', '#10b981'],
        });
      } catch {
        // ignore if confetti unavailable
      }
      onClose();
    }, 900);
  };

  const calculateFinalPrice = () => {
    const base = billingCycle === 'monthly' ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice;
    if (discountPercent === 100) return 0;
    if (discountPercent > 0) return Math.round(base * (1 - discountPercent / 100));
    return base;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-5xl bg-[#111318] border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 z-10 text-white max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-3">
            <Crown className="w-3.5 h-3.5" />
            <span>Remove Watermark & Unlock 4K 60fps</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Simple, Transparent Creator Pricing
          </h2>
          <p className="text-sm text-zinc-400 mt-2">
            Export unlimited spinning vinyl promos. Download free with watermark or upgrade to Pro to remove all branding.
          </p>

          {/* Billing Switch */}
          <div className="inline-flex items-center gap-2 p-1 mt-6 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Yearly billing</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/20 font-bold uppercase tracking-wide">
                Save 25%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = subscription.planId === plan.id && (subscription.status === 'active' || plan.id === 'free');
            const isFeatured = plan.id === 'creator-pro';
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 border flex flex-col justify-between transition-all ${
                  isFeatured
                    ? 'bg-gradient-to-b from-[#1b1e27] to-[#12151c] border-amber-500/50 shadow-xl shadow-amber-500/10'
                    : 'bg-[#15171e] border-white/[0.07] hover:border-white/15'
                }`}
              >
                {isFeatured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black font-extrabold text-[10px] uppercase tracking-wider shadow-sm">
                    Most Popular for Artists
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1 min-h-[32px]">{plan.tagline}</p>

                  {/* Price */}
                  <div className="my-5 flex items-baseline gap-1">
                    <span className="text-3xl md:text-4xl font-extrabold text-white font-mono">
                      ${price}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      /month {billingCycle === 'yearly' && plan.monthlyPrice > 0 ? '(billed annually)' : ''}
                    </span>
                  </div>

                  {/* Watermark Tag */}
                  <div className={`p-2.5 rounded-lg text-xs font-semibold mb-5 flex items-center gap-2 ${
                    plan.watermarkFree
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {plan.watermarkFree ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>100% Watermark-Free Export</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
                        <span>Includes Watermark on Export</span>
                      </>
                    )}
                  </div>

                  {/* Feature List */}
                  <ul className="space-y-2.5 text-xs text-zinc-300">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card Button */}
                <div className="pt-6 mt-6 border-t border-white/[0.06]">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-center text-xs font-semibold text-zinc-300">
                      Your Current Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenCheckout(plan)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                        isFeatured
                          ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-500/20'
                          : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      <span>
                        {plan.id === 'free'
                          ? 'Switch to Free'
                          : `Upgrade to ${plan.name}`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Guarantee */}
        <div className="mt-8 pt-6 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Cancel anytime with 1 click · Instant watermark removal</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Instant high-res downloads</span>
            <span>·</span>
            <span>Commercial release license included</span>
          </div>
        </div>

      </div>

      {/* Simulated Stripe / Payment Checkout Drawer */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#161922] border border-white/15 rounded-2xl p-6 shadow-2xl text-white">
            <button
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Checkout: {selectedPlan.name}</h4>
                <p className="text-xs text-zinc-400">Secure 256-bit encrypted checkout</p>
              </div>
            </div>

            {/* Order summary */}
            <div className="p-3.5 rounded-xl bg-black/30 border border-white/[0.06] mb-4 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-300">
                <span>{selectedPlan.name} ({billingCycle})</span>
                <span className="font-mono">${billingCycle === 'monthly' ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice}/mo</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Coupon discount ({discountPercent}%)</span>
                  <span>-${((billingCycle === 'monthly' ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice) * discountPercent / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-sm text-white">
                <span>Total due today:</span>
                <span className="font-mono text-amber-400">${calculateFinalPrice()}</span>
              </div>
            </div>

            {/* Promo Code Input */}
            <form onSubmit={handleApplyCoupon} className="mb-4">
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Have a coupon or artist promo code?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. ARTIST100 (for free test)"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-xs font-semibold rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
              {couponError && <p className="text-[11px] text-red-400 mt-1">{couponError}</p>}
              {discountPercent > 0 && (
                <p className="text-[11px] text-emerald-400 mt-1">✓ Promo applied: {discountPercent}% off!</p>
              )}
            </form>

            {/* Simulated Card Fields */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value="4242 •••• •••• 4242"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-zinc-300"
                  />
                  <CreditCard className="w-4 h-4 text-zinc-400 absolute right-3 top-2.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Expiry</label>
                  <input
                    type="text"
                    readOnly
                    value="12/28"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">CVC</label>
                  <input
                    type="text"
                    readOnly
                    value="999"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-zinc-300"
                  />
                </div>
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={handleCompletePayment}
              disabled={isProcessing}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Activating Pro Plan...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-black" />
                  <span>
                    Confirm & Activate No-Watermark Pro (${calculateFinalPrice()})
                  </span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-zinc-500 mt-2.5">
              Instant activation. Try code <span className="font-mono text-zinc-300">ARTIST100</span> to test free upgrade.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};
