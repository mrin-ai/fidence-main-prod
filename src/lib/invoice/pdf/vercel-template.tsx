import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";

import { amountToWords } from "@/lib/invoice/amount-to-words";
import {
  calculateInvoiceTotal,
  calculateSubtotal,
} from "@/lib/invoice/calculate-totals";
import { formatCurrency } from "@/lib/invoice/currency";
import type { InvoicePdfPayment } from "@/lib/invoice/invoice-payment-link";
import { invoiceReference, type InvoiceFormData } from "@/lib/invoice/schema";
import {
  invoicePdfFontFamily,
  invoicePdfMonoFontFamily,
} from "./register-fonts";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0A0A0A",
    color: "#f5f5f5",
    fontSize: 10,
    padding: 0,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#1c1c1c",
    padding: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: -1,
    color: "#f5f5f5",
  },
  titleMono: {
    fontWeight: 400,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1c1c1c",
  },
  metaCol: {
    flex: 1,
    gap: 4,
    padding: 16,
  },
  metaColRight: {
    borderLeftWidth: 1,
    borderLeftColor: "#1c1c1c",
    alignItems: "center",
    justifyContent: "center",
    width: 128,
  },
  logo: {
    width: 96,
    height: 96,
    objectFit: "contain",
  },
  metaLine: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 2,
  },
  metaLabel: {
    width: 90,
    color: "#525252",
    fontSize: 8,
  },
  metaValue: {
    color: "#d4d4d4",
    fontSize: 8,
  },
  billingRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1c1c1c",
  },
  billingCol: {
    flex: 1,
    gap: 4,
    padding: 16,
  },
  billingColRight: {
    borderLeftWidth: 1,
    borderLeftColor: "#1c1c1c",
  },
  billingTitle: {
    color: "#737373",
    marginBottom: 4,
  },
  billingName: {
    color: "#f5f5f5",
    fontSize: 11,
  },
  billingText: {
    color: "#a3a3a3",
    fontSize: 8,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1c1c1c",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tableHeaderText: {
    color: "#f5f5f5",
    fontSize: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1c1c1c",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tableRowAlt: {
    backgroundColor: "#111111",
  },
  colItem: { width: "60%" },
  colQty: { width: "10%", textAlign: "center" },
  colPrice: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },
  itemName: { color: "#f5f5f5", fontSize: 10 },
  itemDescription: { color: "#525252", fontSize: 8, marginTop: 2 },
  cell: { color: "#f5f5f5", fontSize: 9 },
  bottom: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#1c1c1c",
    marginTop: "auto",
  },
  bottomLeft: {
    width: "50%",
    borderRightWidth: 1,
    borderRightColor: "#1c1c1c",
    padding: 16,
    gap: 10,
  },
  bottomRight: {
    width: "50%",
    padding: 16,
    gap: 6,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    marginBottom: 4,
  },
  sectionText: {
    color: "#737373",
    fontSize: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: { color: "#a3a3a3", fontSize: 9 },
  totalValue: { color: "#f5f5f5", fontSize: 9 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#1c1c1c",
  },
  grandLabel: { color: "#ffffff", fontSize: 12, fontWeight: 700 },
  grandValue: { color: "#ffffff", fontSize: 12, fontWeight: 700 },
  wordsLabel: { color: "#737373", fontSize: 8, marginTop: 8 },
  wordsValue: { color: "#d4d4d4", fontSize: 8 },
  signature: { width: 120, height: 48, objectFit: "contain", marginTop: 8 },
});

export function VercelInvoicePdf({
  data,
  payment,
}: {
  data: InvoiceFormData;
  payment?: InvoicePdfPayment;
}) {
  const currency = data.invoiceDetails.currency;
  const subtotal = calculateSubtotal(data.items);
  const total = calculateInvoiceTotal(data);
  const reference = invoiceReference(data);
  const fontFamily = invoicePdfFontFamily(data.invoiceDetails.theme.font);
  const monoFamily = invoicePdfMonoFontFamily(data.invoiceDetails.theme.font);
  const logo =
    data.companyDetails.logoBase64 || data.companyDetails.logo || undefined;
  const signature =
    data.companyDetails.signatureBase64 ||
    data.companyDetails.signature ||
    undefined;

  return (
    <Document title={reference}>
      <Page size="A4" style={[styles.page, { fontFamily }]}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {data.invoiceDetails.prefix}
            <Text style={[styles.titleMono, { fontFamily: monoFamily }]}>
              {data.invoiceDetails.serialNumber}
            </Text>
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Serial Number</Text>
              <Text style={styles.metaValue}>
                {data.invoiceDetails.serialNumber}
              </Text>
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>
                {format(data.invoiceDetails.date, "dd/MM/yyyy")}
              </Text>
            </View>
            {data.invoiceDetails.dueDate ? (
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Due Date</Text>
                <Text style={styles.metaValue}>
                  {format(data.invoiceDetails.dueDate, "dd/MM/yyyy")}
                </Text>
              </View>
            ) : null}
            {data.invoiceDetails.paymentTerms ? (
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Payment Terms</Text>
                <Text style={styles.metaValue}>
                  {data.invoiceDetails.paymentTerms}
                </Text>
              </View>
            ) : null}
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Currency</Text>
              <Text style={styles.metaValue}>{currency}</Text>
            </View>
          </View>
          {logo ? (
            <View style={styles.metaColRight}>
              <Image src={logo} style={styles.logo} />
            </View>
          ) : null}
        </View>

        <View style={styles.billingRow}>
          <View style={styles.billingCol}>
            <Text style={styles.billingTitle}>Billed By</Text>
            <Text style={styles.billingName}>{data.companyDetails.name}</Text>
            {data.companyDetails.address ? (
              <Text style={styles.billingText}>
                {data.companyDetails.address}
              </Text>
            ) : null}
            {data.companyDetails.metadata.map((row) => (
              <Text
                key={`company-${row.label}`}
                style={styles.billingText}
              >
                {row.label}: {row.value}
              </Text>
            ))}
          </View>
          <View style={[styles.billingCol, styles.billingColRight]}>
            <Text style={styles.billingTitle}>Billed To</Text>
            <Text style={styles.billingName}>{data.clientDetails.name}</Text>
            {data.clientDetails.address ? (
              <Text style={styles.billingText}>
                {data.clientDetails.address}
              </Text>
            ) : null}
            {data.clientDetails.metadata.map((row) => (
              <Text key={`client-${row.label}`} style={styles.billingText}>
                {row.label}: {row.value}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colItem]}>Item</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.colPrice]}>Price</Text>
          <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
        </View>
        {data.items.map((item, index) => (
          <View
            key={`${item.name}-${index}`}
            style={[styles.tableRow, index % 2 === 0 ? styles.tableRowAlt : {}]}
          >
            <View style={styles.colItem}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.itemDescription}>{item.description}</Text>
              ) : null}
            </View>
            <Text style={[styles.colQty, styles.cell, { fontFamily: monoFamily }]}>
              {item.quantity}
            </Text>
            <Text
              style={[styles.colPrice, styles.cell, { fontFamily: monoFamily }]}
            >
              {formatCurrency(item.unitPrice, currency)}
            </Text>
            <Text
              style={[styles.colTotal, styles.cell, { fontFamily: monoFamily }]}
            >
              {formatCurrency(item.quantity * item.unitPrice, currency)}
            </Text>
          </View>
        ))}

        <View style={styles.bottom}>
          <View style={styles.bottomLeft}>
            {data.metadata.paymentInformation.length ? (
              <View>
                <Text style={styles.sectionTitle}>Payment Information</Text>
                {data.metadata.paymentInformation.map((row) => (
                  <View key={row.label} style={styles.metaLine}>
                    <Text style={styles.metaLabel}>{row.label}</Text>
                    <Text style={styles.metaValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {data.metadata.notes ? (
              <View>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.sectionText}>{data.metadata.notes}</Text>
              </View>
            ) : null}
            {data.metadata.terms ? (
              <View>
                <Text style={styles.sectionTitle}>Terms</Text>
                <Text style={styles.sectionText}>{data.metadata.terms}</Text>
              </View>
            ) : null}
            {signature ? (
              <Image src={signature} style={styles.signature} />
            ) : null}
            {payment ? (
              <View>
                <Text style={styles.sectionTitle}>Pay with crypto</Text>
                <Text style={styles.sectionText}>
                  {payment.amount} {payment.tokenSymbol} on {payment.networkLabel}
                </Text>
                <Text style={styles.sectionText}>{payment.url}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.bottomRight}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={[styles.totalValue, { fontFamily: monoFamily }]}>
                {formatCurrency(subtotal, currency)}
              </Text>
            </View>
            {data.invoiceDetails.billingDetails.map((row) => (
              <View key={row.label} style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {row.label}
                  {row.type === "percentage" ? ` (${row.value}%)` : ""}
                </Text>
                <Text style={[styles.totalValue, { fontFamily: monoFamily }]}>
                  {formatCurrency(
                    row.type === "percentage"
                      ? subtotal * (row.value / 100)
                      : row.value,
                    currency,
                  )}
                </Text>
              </View>
            ))}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Total</Text>
              <Text style={[styles.grandValue, { fontFamily: monoFamily }]}>
                {formatCurrency(total, currency)}
              </Text>
            </View>
            <Text style={styles.wordsLabel}>Invoice Total (in words)</Text>
            <Text style={styles.wordsValue}>{amountToWords(total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
