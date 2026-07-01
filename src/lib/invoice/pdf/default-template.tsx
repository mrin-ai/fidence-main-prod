import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { calculateInvoiceTotal, calculateSubtotal } from "@/lib/invoice/calculate-totals";
import { formatCurrency } from "@/lib/invoice/currency";
import type { InvoiceFormData } from "@/lib/invoice/schema";
import { invoiceReference } from "@/lib/invoice/schema";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a2e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  brandBlock: {
    maxWidth: "55%",
  },
  logo: {
    width: 64,
    height: 64,
    objectFit: "contain",
    marginBottom: 8,
  },
  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  muted: {
    color: "#64748b",
    lineHeight: 1.4,
  },
  invoiceTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2b6bff",
    marginBottom: 6,
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginBottom: 2,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#64748b",
    marginBottom: 6,
  },
  table: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eef3ff",
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  colItem: { width: "40%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "20%", textAlign: "right" },
  colTotal: { width: "25%", textAlign: "right" },
  totals: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: "45%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    fontSize: 12,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  signature: {
    width: 120,
    height: 48,
    objectFit: "contain",
    marginTop: 8,
  },
});

function formatDateLabel(value?: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DefaultInvoicePdf({ data }: { data: InvoiceFormData }) {
  const currency = data.invoiceDetails.currency;
  const subtotal = calculateSubtotal(data.items);
  const total = calculateInvoiceTotal(data);
  const reference = invoiceReference(data);
  const logo = data.companyDetails.logoBase64 || data.companyDetails.logo;
  const signature =
    data.companyDetails.signatureBase64 || data.companyDetails.signature;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            {logo ? <Image src={logo} style={styles.logo} /> : null}
            <Text style={styles.companyName}>{data.companyDetails.name}</Text>
            <Text style={styles.muted}>{data.companyDetails.address}</Text>
            {data.companyDetails.metadata.map((row) => (
              <Text key={`${row.label}-${row.value}`} style={styles.muted}>
                {row.label}: {row.value}
              </Text>
            ))}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Reference</Text>
              <Text>{reference}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Date</Text>
              <Text>{formatDateLabel(data.invoiceDetails.date)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Due</Text>
              <Text>{formatDateLabel(data.invoiceDetails.dueDate)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill to</Text>
          <Text style={{ fontWeight: "bold", marginBottom: 2 }}>
            {data.clientDetails.name}
          </Text>
          <Text style={styles.muted}>{data.clientDetails.address}</Text>
          {data.clientDetails.metadata.map((row) => (
            <Text key={`${row.label}-${row.value}`} style={styles.muted}>
              {row.label}: {row.value}
            </Text>
          ))}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colItem}>Item</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.tableRow}>
              <View style={styles.colItem}>
                <Text style={{ fontWeight: "bold" }}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.muted}>{item.description}</Text>
                ) : null}
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>
                {formatCurrency(item.unitPrice, currency)}
              </Text>
              <Text style={styles.colTotal}>
                {formatCurrency(item.quantity * item.unitPrice, currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{formatCurrency(subtotal, currency)}</Text>
          </View>
          {data.invoiceDetails.billingDetails.map((row) => (
            <View key={row.label} style={styles.totalRow}>
              <Text style={styles.muted}>
                {row.label}
                {row.type === "percentage" ? ` (${row.value}%)` : ""}
              </Text>
              <Text>
                {formatCurrency(
                  row.type === "percentage"
                    ? subtotal * (row.value / 100)
                    : row.value,
                  currency,
                )}
              </Text>
            </View>
          ))}
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{formatCurrency(total, currency)}</Text>
          </View>
        </View>

        {(data.metadata.notes ||
          data.metadata.terms ||
          data.metadata.paymentInformation.length > 0) && (
          <View style={styles.footer}>
            {data.metadata.notes ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.muted}>{data.metadata.notes}</Text>
              </View>
            ) : null}
            {data.metadata.terms ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.sectionTitle}>Terms</Text>
                <Text style={styles.muted}>{data.metadata.terms}</Text>
              </View>
            ) : null}
            {data.metadata.paymentInformation.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Payment information</Text>
                {data.metadata.paymentInformation.map((row) => (
                  <Text key={`${row.label}-${row.value}`} style={styles.muted}>
                    {row.label}: {row.value}
                  </Text>
                ))}
              </View>
            ) : null}
            {signature ? (
              <Image src={signature} style={styles.signature} />
            ) : null}
          </View>
        )}
      </Page>
    </Document>
  );
}
