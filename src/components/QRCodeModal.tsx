import { useEffect } from 'react';
import QRCode from 'react-qr-code';

interface QRCodeModalProps {
  uri: string;
  onClose: () => void;
}

export default function QRCodeModal({ uri, onClose }: QRCodeModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(uri).then(() => {
      console.log('[aWizard] Copied WalletConnect URI to clipboard');
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="glow-card max-w-md w-full mx-4 p-6 text-center">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--glow-primary)' }}>
            🔗 Connect Wallet
          </h3>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl font-bold"
            style={{ color: 'var(--glow-secondary)' }}
          >
            ×
          </button>
        </div>
        
        <div className="bg-white p-4 rounded-lg mb-4">
          <QRCode
            value={uri}
            size={200}
            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          />
        </div>

        <p className="text-sm mb-4" style={{ color: 'var(--glow-text)' }}>
          Scan with <strong style={{ color: 'var(--glow-primary)' }}>Sage Wallet</strong> to connect
        </p>

        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="glow-button flex-1"
            style={{
              backgroundColor: 'var(--glow-secondary)',
              color: '#000',
            }}
          >
            📋 Copy URI
          </button>
          <button
            onClick={onClose}
            className="glow-button flex-1"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--glow-secondary)',
              color: 'var(--glow-secondary)',
            }}
          >
            Cancel
          </button>
        </div>

        <p className="text-xs mt-4 opacity-70" style={{ color: 'var(--glow-text)' }}>
          Need Sage? Download from{' '}
          <a
            href="https://www.sagewallets.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--glow-primary)' }}
            className="underline"
          >
            sagewallets.app
          </a>
        </p>
      </div>
    </div>
  );
}