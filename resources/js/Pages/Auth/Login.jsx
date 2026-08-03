import React from 'react';
import { Head, useForm } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { Wrench, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import seekojiLogoOnly from '../../../../public/images/seekoji-logo-only.png';
import seekojiLogo from '../../../../public/images/logo.png';

export default function Login() {
  const { data, setData, post, processing, errors } = useForm({
    email: '',
    password: '',
    remember: false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    post('/login');
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#f9f9f7] text-[#0B0B0B] font-sans antialiased">
      <Head>
        <title>Sign In | Seekoji Service Management</title>
        <meta name="description" content="Sign in to Seekoji Electric Service Management Portal to manage solar controller repairs, customer jobs, and service workflows." />
      </Head>

      {/* Left Column: Brand Hero Banner (Minimal Light) */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-[#F0F7FF] border-r border-[#E5E5E5]">

        {/* Subtle Ambient Accent */}
        <div className="absolute top-1/3 -left-20 w-96 h-96 bg-[#005ea4]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-3.5 z-10">
          <img src={seekojiLogoOnly} alt="Seekoji Logo" className="h-11 w-auto object-contain shrink-0" />
          <div>
            <h1 className="font-bold text-2xl tracking-tight text-[#005ea4]">
              SEEKOJI ELECTRIC
            </h1>
            <p className="text-xs uppercase font-bold tracking-wider text-[#666666]">
              Service Management System
            </p>
          </div>
        </div>

        {/* Hero Copy */}
        <div className="z-10 space-y-6 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="px-3 py-1 rounded-full bg-[#005ea4]/10 border border-[#005ea4]/20 text-[#005ea4] text-xs font-bold uppercase tracking-wider">
              v1.0 Enterprise Edition
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-[#0B0B0B] mt-4 leading-tight">
              Streamline job pipelines, intakes & service workflows seamlessly.
            </h2>
            <p className="text-[#666666] text-sm mt-3 leading-relaxed">
              Designed specifically for electrical service centers. Complete 8-stage repair state machine, customer history, real-time analytics, and automated receipt billing.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-[#005ea4]/15">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 border border-[#E5E5E5] shadow-sm">
              <ShieldCheck className="w-5 h-5 text-[#1BAF7A] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#0B0B0B]">Role Guards</p>
                <p className="text-[11px] text-[#666666]">Admin, Coordinator, Technician</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 border border-[#E5E5E5] shadow-sm">
              <Wrench className="w-5 h-5 text-[#005ea4] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#0B0B0B]">Live Stage Machine</p>
                <p className="text-[11px] text-[#666666]">New ➔ Delivered</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="z-10 text-xs text-[#666666]">
          © {new Date().getFullYear()} Seekoji Electric. All rights reserved. Timezone: Asia/Kolkata (+05:30)
        </div>
      </div>

      {/* Right Column: Form Container (Light Theme) */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center justify-center text-center gap-2 mb-6">
            <img src={seekojiLogo} alt="Seekoji Logo" className="h-12 w-auto object-contain shrink-0" />
            <h1 className="font-bold text-xl text-[#005ea4]">
              SEEKOJI ELECTRIC
            </h1>
            <p className="text-xs uppercase font-bold text-[#666666]">
              Service Management Platform
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[#0B0B0B]">
              Welcome back
            </h2>
            <p className="text-xs text-[#666666] mt-1">
              Sign in to your Seekoji Service Management account
            </p>
          </div>

          {/* Validation Alert */}
          {Object.keys(errors).length > 0 && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {Object.values(errors).map((err, idx) => (
                  <p key={idx}>{err}</p>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#666666] uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717783]" />
                <input
                  type="email"
                  required
                  value={data.email}
                  onChange={(e) => setData('email', e.target.value)}
                  placeholder="Username or Email"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B] text-sm placeholder-[#666666] focus:outline-none focus:border-[#005ea4] focus:ring-1 focus:ring-[#005ea4] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#666666] uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717783]" />
                <input
                  type="password"
                  required
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                  placeholder=""
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B] text-sm placeholder-[#666666] focus:outline-none focus:border-[#005ea4] focus:ring-1 focus:ring-[#005ea4] transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#666666] hover:text-[#0B0B0B] font-medium">
                <input
                  type="checkbox"
                  checked={data.remember}
                  onChange={(e) => setData('remember', e.target.checked)}
                  className="w-4 h-4 rounded bg-[#f4f4f2] border-[#E5E5E5] text-[#005ea4] focus:ring-[#005ea4]"
                />
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full py-3.5 px-4 rounded-xl bg-[#005ea4] hover:bg-[#1777c9] text-white font-bold text-sm shadow-md shadow-[#005ea4]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {processing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>



        </motion.div>
      </div>

    </div>
  );
}
