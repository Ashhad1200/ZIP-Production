import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { LedgerEntry } from '../../../services/finance.api';

const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    paddingTop: 32,
    paddingBottom: 32,
    paddingLeft: 36,
    paddingRight: 36,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 16,
    borderBottom: '1 solid #e5e7eb',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiBox: {
    flex: 1,
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#f9fafb',
    border: '1 solid #e5e7eb',
  },
  kpiLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottom: '1 solid #d1d5db',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  col1: { width: '12%' },
  col2: { width: '18%' },
  col3: { flex: 1 },
  col4: { width: '13%', textAlign: 'right' },
  col5: { width: '13%', textAlign: 'right' },
  col6: { width: '14%', textAlign: 'right' },
  headerText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
  },
  cellText: {
    fontSize: 8,
    color: '#374151',
  },
  debit: { color: '#dc2626' },
  credit: { color: '#16a34a' },
  footer: {
    marginTop: 20,
    paddingTop: 8,
    borderTop: '1 solid #e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
});

interface Props {
  clientName: string;
  entries: LedgerEntry[];
  summary: {
    totalDebits: string;
    totalCredits: string;
    closingBalance: string;
    closingBalanceType: string;
  };
  generatedAt: string;
}

export function LedgerPDF({ clientName, entries, summary, generatedAt }: Props) {
  return (
    <Document title={`Ledger — ${clientName}`} author="ZIP Production ERP">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Client Ledger — {clientName}</Text>
          <Text style={styles.subtitle}>Generated: {generatedAt}</Text>
        </View>

        {/* KPI summary */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total Debits</Text>
            <Text style={[styles.kpiValue, styles.debit]}>{summary.totalDebits}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total Credits</Text>
            <Text style={[styles.kpiValue, styles.credit]}>{summary.totalCredits}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Closing Balance ({summary.closingBalanceType})</Text>
            <Text style={styles.kpiValue}>{summary.closingBalance}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, styles.headerText]}>Date</Text>
            <Text style={[styles.col2, styles.headerText]}>Type</Text>
            <Text style={[styles.col3, styles.headerText]}>Description</Text>
            <Text style={[styles.col4, styles.headerText]}>Debit</Text>
            <Text style={[styles.col5, styles.headerText]}>Credit</Text>
            <Text style={[styles.col6, styles.headerText]}>Balance</Text>
          </View>

          {entries.map((entry, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 0 ? { backgroundColor: '#ffffff' } : { backgroundColor: '#f9fafb' }]}>
              <Text style={[styles.col1, styles.cellText]}>{entry.date ? String(entry.date).slice(0, 10) : ''}</Text>
              <Text style={[styles.col2, styles.cellText]}>{entry.type}</Text>
              <Text style={[styles.col3, styles.cellText]}>{entry.description ?? ''}</Text>
              <Text style={[styles.col4, styles.cellText, entry.type === 'DEBIT' ? styles.debit : {}]}>
                {entry.type === 'DEBIT' ? entry.amountDisplay ?? '' : ''}
              </Text>
              <Text style={[styles.col5, styles.cellText, entry.type === 'CREDIT' ? styles.credit : {}]}>
                {entry.type === 'CREDIT' ? entry.amountDisplay ?? '' : ''}
              </Text>
              <Text style={[styles.col6, styles.cellText]}>{entry.runningBalanceDisplay ?? ''}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ZIP Production ERP</Text>
          <Text style={styles.footerText}>Confidential — For internal use only</Text>
        </View>
      </Page>
    </Document>
  );
}
