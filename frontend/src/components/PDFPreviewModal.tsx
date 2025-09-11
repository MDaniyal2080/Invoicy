'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download, Eye, Settings, Palette, Type, Layout, FileText, Maximize2, Minimize2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  initialOptions?: PDFOptions;
}

interface PDFOptions {
  template?: string;
  color?: string;
  font?: string;
  layout?: string;
  footer?: string;
  pageSize?: string;
  margins?: string;
  watermarkText?: string;
  showSignature?: boolean;
  customFields?: Record<string, string>;
  logoSize?: string;
  headerStyle?: string;
  headerBorderColor?: string;
  tableHeaderColor?: string;
  accentColor?: string;
}

export default function PDFPreviewModal({ isOpen, onClose, invoiceId, initialOptions = {} }: PDFPreviewModalProps) {
  const [options, setOptions] = useState<PDFOptions>(initialOptions);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, string>>(initialOptions.customFields || {});

  const updatePreview = useCallback(async () => {
    if (!invoiceId) return;
    setIsLoading(true);
    try {
      const url = await apiClient.previewInvoicePDF(invoiceId, { ...options, customFields });
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(url);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId, options, customFields, previewUrl]);

  useEffect(() => {
    if (isOpen && invoiceId) {
      void updatePreview();
    }
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, invoiceId, updatePreview, previewUrl]);

  const handleOptionChange = (key: keyof PDFOptions, value: string | boolean) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleCustomFieldChange = (key: string, value: string) => {
    setCustomFields(prev => ({ ...prev, [key]: value }));
  };

  const addCustomField = () => {
    const key = `Custom Field ${Object.keys(customFields).length + 1}`;
    setCustomFields(prev => ({ ...prev, [key]: '' }));
  };

  const removeCustomField = (key: string) => {
    setCustomFields(prev => {
      const newFields = { ...prev };
      delete newFields[key];
      return newFields;
    });
  };

  const handleDownload = async () => {
    try {
      const blob = await apiClient.downloadInvoicePDF(invoiceId, { ...options, customFields });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`bg-white rounded-lg shadow-xl ${isFullscreen ? 'w-full h-full' : 'w-11/12 h-5/6 max-w-7xl'} flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">PDF Preview & Customization</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-md ${showSettings ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'} hover:bg-blue-200`}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Settings Panel */}
          {showSettings && (
            <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
              <div className="space-y-6">
                {/* Design & Colors */}
                <div>
                  <h3 className="flex items-center gap-2 font-medium text-gray-900 mb-3">
                    <Palette className="w-4 h-4" />
                    Design & Colors
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                      <select
                        value={options.accentColor || '#2c3e50'}
                        onChange={(e) => handleOptionChange('accentColor', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="#2c3e50">Professional Blue (#2c3e50)</option>
                        <option value="#34495e">Slate Gray (#34495e)</option>
                        <option value="#27ae60">Emerald Green (#27ae60)</option>
                        <option value="#8e44ad">Purple (#8e44ad)</option>
                        <option value="#e74c3c">Red (#e74c3c)</option>
                        <option value="#f39c12">Orange (#f39c12)</option>
                        <option value="#16a085">Teal (#16a085)</option>
                        <option value="#2980b9">Blue (#2980b9)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Header Border Color</label>
                      <input
                        type="color"
                        value={options.headerBorderColor || '#2c3e50'}
                        onChange={(e) => handleOptionChange('headerBorderColor', e.target.value)}
                        className="w-full h-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Table Header Color</label>
                      <input
                        type="color"
                        value={options.tableHeaderColor || '#2c3e50'}
                        onChange={(e) => handleOptionChange('tableHeaderColor', e.target.value)}
                        className="w-full h-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Typography */}
                <div>
                  <h3 className="flex items-center gap-2 font-medium text-gray-900 mb-3">
                    <Type className="w-4 h-4" />
                    Typography
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                      <select
                        value={options.font || 'helvetica'}
                        onChange={(e) => handleOptionChange('font', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="helvetica">Helvetica (Clean)</option>
                        <option value="times">Times Roman (Classic)</option>
                        <option value="courier">Courier (Monospace)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Layout */}
                <div>
                  <h3 className="flex items-center gap-2 font-medium text-gray-900 mb-3">
                    <Layout className="w-4 h-4" />
                    Layout & Format
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Page Size</label>
                      <select
                        value={options.pageSize || 'a4'}
                        onChange={(e) => handleOptionChange('pageSize', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="a4">A4 (210 × 297 mm)</option>
                        <option value="letter">Letter (8.5 × 11 in)</option>
                        <option value="legal">Legal (8.5 × 14 in)</option>
                        <option value="a3">A3 (297 × 420 mm)</option>
                        <option value="a5">A5 (148 × 210 mm)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Margins</label>
                      <select
                        value={options.margins || 'moderate'}
                        onChange={(e) => handleOptionChange('margins', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="narrow">Narrow (25pt)</option>
                        <option value="moderate">Moderate (50pt)</option>
                        <option value="wide">Wide (75pt)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Layout Style</label>
                      <select
                        value={options.layout || 'standard'}
                        onChange={(e) => handleOptionChange('layout', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="standard">Standard</option>
                        <option value="compact">Compact</option>
                        <option value="left">Left Aligned</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Logo Size</label>
                      <select
                        value={options.logoSize || 'medium'}
                        onChange={(e) => handleOptionChange('logoSize', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="xlarge">Extra Large</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Watermark */}
                <div>
                  <h3 className="flex items-center gap-2 font-medium text-gray-900 mb-3">
                    <FileText className="w-4 h-4" />
                    Watermark & Signature
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watermark Text</label>
                      <input
                        type="text"
                        value={options.watermarkText || ''}
                        onChange={(e) => handleOptionChange('watermarkText', e.target.value)}
                        placeholder="e.g., PAID, DRAFT, CONFIDENTIAL"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="showSignature"
                        checked={options.showSignature || false}
                        onChange={(e) => handleOptionChange('showSignature', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="showSignature" className="text-sm font-medium text-gray-700">
                        Include Signature Field
                      </label>
                    </div>
                  </div>
                </div>

                {/* Custom Fields */}
                <div>
                  <h3 className="flex items-center gap-2 font-medium text-gray-900 mb-3">
                    <Settings className="w-4 h-4" />
                    Custom Fields
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(customFields).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const newKey = e.target.value;
                            const newFields = { ...customFields };
                            delete newFields[key];
                            newFields[newKey] = value;
                            setCustomFields(newFields);
                          }}
                          placeholder="Field name"
                          className="flex-1 p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                          placeholder="Value"
                          className="flex-1 p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => removeCustomField(key)}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addCustomField}
                      className="w-full p-2 text-sm text-blue-600 border border-dashed border-blue-300 rounded-md hover:bg-blue-50"
                    >
                      + Add Custom Field
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Footer Text</label>
                  <textarea
                    value={options.footer || ''}
                    onChange={(e) => handleOptionChange('footer', e.target.value)}
                    placeholder="Thank you for your business!"
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preview Area */}
          <div className="flex-1 flex flex-col bg-gray-100">
            {isLoading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Generating preview...</p>
                </div>
              </div>
            )}
            
            {!isLoading && previewUrl && (
              <div className="flex-1 p-4">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border border-gray-300 rounded-lg shadow-lg bg-white"
                  title="PDF Preview"
                />
              </div>
            )}
            
            {!isLoading && !previewUrl && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Preview will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
