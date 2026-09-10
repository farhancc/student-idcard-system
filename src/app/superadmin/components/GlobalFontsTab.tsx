import React from 'react';
import { Loader2, Type } from 'lucide-react';

export function GlobalFontsTab({
  fontsLoading,
  globalFonts,
  handleDeleteFont
}: any) {
  return (
    <>
      {/* Global Fonts Tab Content */}
      {fontsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '12px' }}>
          <Loader2 size={36} className="spinner" />
          <p>Loading global fonts...</p>
        </div>
      ) : globalFonts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
          No global fonts uploaded yet. Click "Add Global Font" to upload one.
        </div>
      ) : (
        <div className="glass-panel">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Type size={18} color="var(--primary)" />
            Global Platform Fonts
          </h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Font Name</th>
                  <th>Language Support</th>
                  <th>URL / Preview</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {globalFonts.map((font: any) => (
                  <tr key={font.id}>
                    <td style={{ fontWeight: '600', color: '#ffffff' }}>
                      <span>{font.name}</span>
                    </td>
                    <td>
                      <span className="badge badge-secondary" style={{ textTransform: 'uppercase' }}>
                        {font.language}
                      </span>
                    </td>
                    <td>
                      <a 
                        href={font.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.85rem', wordBreak: 'break-all' }}
                      >
                        {font.fileUrl.startsWith('data:') ? 'Base64 Encoded Font Data' : font.fileUrl}
                      </a>
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleDeleteFont(font.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
