import React from 'react';
import { Sliders, Loader2 } from 'lucide-react';

export function SystemSettingsTab({
  settingsSuccess,
  handleSaveSettings,
  costSingleSided, setCostSingleSided,
  costDoubleSided, setCostDoubleSided,
  costSingleSidedFull, setCostSingleSidedFull,
  costDoubleSidedFull, setCostDoubleSidedFull,
  costApprovalPdfSingle, setCostApprovalPdfSingle,
  costApprovalPdfDouble, setCostApprovalPdfDouble,
  signupBonusCredits, setSignupBonusCredits,
  priceCreditBasic, setPriceCreditBasic,
  priceCreditPro, setPriceCreditPro,
  priceCreditEnterprise, setPriceCreditEnterprise,
  settingsLoading
}: any) {
  return (
    <>
      <div className="glass-panel" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={18} color="var(--primary)" />
          System Credit Configuration
        </h3>
        
        <p style={{ fontSize: '0.95rem', color: 'var(--muted)', marginBottom: '24px', lineHeight: '1.5' }}>
          Configure the number of credits charged to printing presses for generating and exporting different PDF formats.
        </p>

        {settingsSuccess && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            background: 'rgba(52, 211, 153, 0.12)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            borderRadius: '8px',
            color: '#34d399',
            marginBottom: '24px'
          }}>
            <span>✓ {settingsSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings}>
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="costSingleSided" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Single-sided ID Card Cost (Credits)</label>
            <input
              type="number"
              id="costSingleSided"
              className="form-input"
              value={costSingleSided}
              onChange={(e) => setCostSingleSided(e.target.value)}
              min="0"
              required
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>Charged per cardholder in the order for single-sided templates.</span>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="costDoubleSided" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Double-sided ID Card Cost (Credits)</label>
            <input
              type="number"
              id="costDoubleSided"
              className="form-input"
              value={costDoubleSided}
              onChange={(e) => setCostDoubleSided(e.target.value)}
              min="0"
              required
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>Charged per cardholder in the order for double-sided templates.</span>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="costSingleSidedFull" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Single-sided Full Card / Certificate Cost (Credits)</label>
            <input
              type="number"
              id="costSingleSidedFull"
              className="form-input"
              value={costSingleSidedFull}
              onChange={(e) => setCostSingleSidedFull(e.target.value)}
              min="0"
              required
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>Charged per cardholder in the order for single-sided full-page/certificate templates.</span>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="costDoubleSidedFull" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Double-sided Full Card / Certificate Cost (Credits)</label>
            <input
              type="number"
              id="costDoubleSidedFull"
              className="form-input"
              value={costDoubleSidedFull}
              onChange={(e) => setCostDoubleSidedFull(e.target.value)}
              min="0"
              required
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>Charged per cardholder in the order for double-sided full-page/certificate templates.</span>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="costApprovalPdfSingle" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Single-sided Approval PDF Cost (Credits)</label>
            <input
              type="number"
              id="costApprovalPdfSingle"
              className="form-input"
              value={costApprovalPdfSingle}
              onChange={(e) => setCostApprovalPdfSingle(e.target.value)}
              min="0"
              required
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>Charged per approval PDF generated for single-sided templates.</span>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="costApprovalPdfDouble" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Double-sided Approval PDF Cost (Credits)</label>
            <input
              type="number"
              id="costApprovalPdfDouble"
              className="form-input"
              value={costApprovalPdfDouble}
              onChange={(e) => setCostApprovalPdfDouble(e.target.value)}
              min="0"
              required
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>Charged per approval PDF generated for double-sided templates.</span>
          </div>

          <div style={{ margin: '28px 0 16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600, marginBottom: '4px' }}>Signup Bonus Configuration</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '14px' }}>Set the amount of promotional bonus credits automatically granted to newly registered presses upon signup.</p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="signupBonusCredits" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Signup Bonus (Promo Credits)</label>
            <input
              type="number"
              id="signupBonusCredits"
              className="form-input"
              value={signupBonusCredits}
              onChange={(e) => setSignupBonusCredits(e.target.value)}
              min="0"
              required
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>Promotional credits can be used for card printing & PDF exports, but are restricted from buying marketplace templates.</span>
          </div>

          <div style={{ margin: '28px 0 16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600, marginBottom: '4px' }}>Platform Credit Pricing</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '16px' }}>Configure the price of a single credit in Rupees (Rs.) for each subscription plan. This controls calculated revenue reports on the dashboard.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '28px' }}>
            <div>
              <label className="form-label" htmlFor="priceCreditBasic" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>BASIC Rate (Rs.)</label>
              <input
                type="number"
                step="0.01"
                id="priceCreditBasic"
                className="form-input"
                value={priceCreditBasic}
                onChange={(e) => setPriceCreditBasic(e.target.value)}
                min="0"
                required
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="priceCreditPro" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>PRO Rate (Rs.)</label>
              <input
                type="number"
                step="0.01"
                id="priceCreditPro"
                className="form-input"
                value={priceCreditPro}
                onChange={(e) => setPriceCreditPro(e.target.value)}
                min="0"
                required
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="priceCreditEnterprise" style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>ENTERPRISE Rate (Rs.)</label>
              <input
                type="number"
                step="0.01"
                id="priceCreditEnterprise"
                className="form-input"
                value={priceCreditEnterprise}
                onChange={(e) => setPriceCreditEnterprise(e.target.value)}
                min="0"
                required
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={settingsLoading}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '44px' }}
          >
            {settingsLoading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Saving Changes...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </form>
      </div>
    </>
  );
}
