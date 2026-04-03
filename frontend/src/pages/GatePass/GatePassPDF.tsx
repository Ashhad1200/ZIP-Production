import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Document, Page, Text, View, StyleSheet, PDFViewer } from '@react-pdf/renderer';
import { QRCodeCanvas } from 'qrcode.react';
import { useRef, useEffect, useState } from 'react';
import { gatePassApi, type GatePassDetail as GatePassDetailType } from '../../services/gate-pass.api';
import { LoadingSpinner } from '../../components/ui';
import { ArrowLeft } from 'lucide-react';

// ─── PDF Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  subtitle: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginVertical: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    color: '#666',
    width: '40%',
  },
  value: {
    fontFamily: 'Helvetica-Bold',
    width: '60%',
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  colNum: { width: '10%' },
  colVariant: { width: '60%' },
  colMeters: { width: '30%', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: '#333',
  },
  totalLabel: {
    width: '70%',
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  totalAmount: {
    width: '30%',
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  footer: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerInfo: {
    width: '60%',
  },
  qrContainer: {
    width: '30%',
    alignItems: 'center',
  },
  dueDate: {
    marginTop: 12,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#c00',
  },
});

// ─── PDF Document Component ──────────────────────────────────────────────────

function GatePassPDFDocument({
  gatePass,
  qrDataUrl,
}: {
  gatePass: GatePassDetailType;
  qrDataUrl: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Company Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>ZIP Production</Text>
          <Text style={styles.subtitle}>GATE PASS</Text>
        </View>

        <View style={styles.divider} />

        {/* GP Info & Client Details side by side */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: '48%' }}>
            <Text style={styles.sectionTitle}>Gate Pass Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>GP Number:</Text>
              <Text style={styles.value}>{gatePass.gatePassNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Date:</Text>
              <Text style={styles.value}>
                {new Date(gatePass.date + 'T00:00:00').toLocaleDateString('en-PK', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Shift:</Text>
              <Text style={styles.value}>{gatePass.shift}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Issuing Manager:</Text>
              <Text style={styles.value}>{gatePass.issuingManagerName}</Text>
            </View>
            {gatePass.order && (
              <View style={styles.row}>
                <Text style={styles.label}>Order #:</Text>
                <Text style={styles.value}>{gatePass.order.orderNumber}</Text>
              </View>
            )}
          </View>

          <View style={{ width: '48%' }}>
            <Text style={styles.sectionTitle}>Client Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{gatePass.client.name}</Text>
            </View>
            {gatePass.client.contactPerson && (
              <View style={styles.row}>
                <Text style={styles.label}>Contact:</Text>
                <Text style={styles.value}>{gatePass.client.contactPerson}</Text>
              </View>
            )}
            {gatePass.client.phone && (
              <View style={styles.row}>
                <Text style={styles.label}>Phone:</Text>
                <Text style={styles.value}>{gatePass.client.phone}</Text>
              </View>
            )}
            {gatePass.client.address && (
              <View style={styles.row}>
                <Text style={styles.label}>Address:</Text>
                <Text style={styles.value}>{gatePass.client.address}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <Text style={styles.sectionTitle}>Line Items</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colNum}>#</Text>
            <Text style={styles.colVariant}>Variant</Text>
            <Text style={styles.colMeters}>Meters</Text>
          </View>
          {gatePass.lineItems.map((li, idx) => (
            <View key={li.id} style={styles.tableRow}>
              <Text style={styles.colNum}>{idx + 1}</Text>
              <Text style={styles.colVariant}>{li.variant.code} — {li.variant.name}</Text>
              <Text style={styles.colMeters}>{li.meters.toLocaleString()}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Meters:</Text>
            <Text style={styles.totalAmount}>
              {gatePass.lineItems.reduce((sum, li) => sum + li.meters, 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Footer: Payment Due + QR Code */}
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={{ marginTop: 8, color: '#666' }}>Status: {gatePass.status}</Text>
          </View>
          <View style={styles.qrContainer}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {qrDataUrl && <Text style={{ fontSize: 8, color: '#999', marginTop: 4 }}>Scan to verify</Text>}
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function GatePassPDF() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qrRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const { data: result, isLoading } = useQuery({
    queryKey: ['gate-pass-pdf', id],
    queryFn: () => gatePassApi.getPdfData(id!),
    enabled: !!id,
  });

  const gatePass = result?.data;

  // Generate QR data URL from canvas
  useEffect(() => {
    if (qrRef.current) {
      const canvas = qrRef.current.querySelector('canvas');
      if (canvas) {
        setQrDataUrl(canvas.toDataURL('image/png'));
      }
    }
  }, [gatePass]);

  if (isLoading) return <LoadingSpinner />;
  if (!gatePass) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Gate pass not found</p>
        <button onClick={() => navigate('/gate-pass')} className="mt-4 text-blue-600 hover:underline">
          Back to list
        </button>
      </div>
    );
  }

  const verifyUrl = `${window.location.origin}/gp-verify?token=${gatePass.verifyToken}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/gate-pass/${id}`)}
          className="rounded-lg border p-2 hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          PDF Preview — {gatePass.gatePassNumber}
        </h1>
      </div>

      {/* Hidden QR canvas for generating data URL */}
      <div ref={qrRef} className="hidden">
        <QRCodeCanvas value={verifyUrl} size={120} />
      </div>

      {/* PDF Viewer */}
      <div className="h-[80vh] rounded-lg border shadow-sm">
        <PDFViewer width="100%" height="100%" showToolbar>
          <GatePassPDFDocument gatePass={gatePass} qrDataUrl={qrDataUrl} />
        </PDFViewer>
      </div>
    </div>
  );
}
